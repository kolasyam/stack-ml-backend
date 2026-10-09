import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UploadResult } from './supabase-storage.service';
import { UploadManifest, UploadManifestDocument } from './schemas/upload-manifest.schema';
import { StorageCleanupService } from './storage-cleanup.service';

@Injectable()
export class UploadManifestService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectModel(UploadManifest.name)
    private readonly model: Model<UploadManifestDocument>,
    private readonly cleanup: StorageCleanupService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.cleanupExpired().catch(() => undefined), 60 * 60 * 1000);
    this.timer.unref?.();
    void this.cleanupExpired().catch(() => undefined);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async record(result: UploadResult): Promise<void> {
    await this.model.create({
      path: result.path,
      fileName: result.fileName,
      fileSize: result.fileSize,
      fileType: result.fileType,
      mimeType: result.mimeType,
      pages: result.pages,
      extractedText: result.extractedText,
      extractionStatus: result.extractionStatus,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
  }

  async get(path: string): Promise<UploadManifestDocument | null> {
    const manifest = await this.model.findOne({
      path,
      expiresAt: { $gt: new Date() },
    }).select('+extractedText').exec();
    return manifest;
  }

  async remove(path: string): Promise<void> {
    await this.model.deleteOne({ path }).exec();
  }

  private async cleanupExpired(): Promise<void> {
    const expired = await this.model.find({ expiresAt: { $lte: new Date() } }).select('path').limit(100).exec();
    for (const manifest of expired) {
      await this.cleanup.enqueue(manifest.path);
      await manifest.deleteOne();
    }
  }

  async exists(path: string): Promise<boolean> {
    return Boolean(await this.model.exists({ path, expiresAt: { $gt: new Date() } }));
  }
}
