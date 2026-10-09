import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SupabaseStorageService } from './supabase-storage.service';
import { StorageCleanup, StorageCleanupDocument } from './schemas/storage-cleanup.schema';

@Injectable()
export class StorageCleanupService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectModel(StorageCleanup.name)
    private readonly model: Model<StorageCleanupDocument>,
    private readonly storage: SupabaseStorageService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.process().catch(() => undefined), 60_000);
    this.timer.unref?.();
    void this.process().catch(() => undefined);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async enqueue(path: string): Promise<void> {
    await this.model.updateOne(
      { path },
      { $setOnInsert: { path, attempts: 0, nextAttemptAt: new Date() } },
      { upsert: true },
    ).exec();
  }

  private async process(): Promise<void> {
    const jobs = await this.model.find({ nextAttemptAt: { $lte: new Date() } }).limit(20).exec();
    for (const job of jobs) {
      try {
        await this.storage.remove(job.path);
        await job.deleteOne();
      } catch {
        const attempts = (job.attempts ?? 0) + 1;
        const delay = Math.min(60 * 60 * 1000, 2 ** Math.min(attempts, 10) * 1000);
        job.attempts = attempts;
        job.nextAttemptAt = new Date(Date.now() + delay);
        await job.save();
      }
    }
  }
}
