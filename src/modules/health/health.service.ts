import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AppLogger } from '../../common/logger/logger.service';
import {
  ComponentStatus,
  SupabaseStorageService,
} from '../uploads/supabase-storage.service';

export interface SystemStatus {
  status: 'operational' | 'degraded' | 'offline';
  uptime: number;
  timestamp: string;
  mongodb: ComponentStatus;
  supabase: ComponentStatus;
}

/**
 * On-boot connectivity probe for MongoDB + Supabase.
 *
 * Runs during bootstrap (before the server starts accepting traffic), logs a
 * clear console banner, and exposes a snapshot consumed by both the JSON and
 * HTML health endpoints. A connection that is slow/unreachable is capped by a
 * timeout so startup is never blocked indefinitely.
 */
@Injectable()
export class HealthService implements OnModuleInit {
  private mongodb: ComponentStatus = {
    ok: false,
    configured: true,
    message: 'Not checked yet',
  };
  private supabase: ComponentStatus = {
    ok: false,
    configured: true,
    message: 'Not checked yet',
  };

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly storage: SupabaseStorageService,
    private readonly logger: AppLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    this.mongodb = await this.checkMongo();
    this.supabase = await this.storage.healthCheck();
    this.printBanner();
  }

  /** Snapshot of the last probe (safe to call any time after boot). */
  getStatus(): SystemStatus {
    const ok = this.mongodb.ok && this.supabase.ok;
    const status: SystemStatus['status'] = ok
      ? 'operational'
      : this.mongodb.ok || this.supabase.ok
        ? 'degraded'
        : 'offline';
    return {
      status,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      mongodb: this.mongodb,
      supabase: this.supabase,
    };
  }

  private async checkMongo(): Promise<ComponentStatus> {
    try {
      const db = this.connection.db;
      if (!db) throw new Error('Mongoose connection has no db handle');
      await this.withTimeout(db.admin().ping(), 5000, 'MongoDB');
      return { ok: true, configured: true, message: 'Connected to MongoDB' };
    } catch (err) {
      return { ok: false, configured: true, message: (err as Error).message };
    }
  }

  private withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    label: string,
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`${label} check timed out after ${ms}ms`)),
          ms,
        ),
      ),
    ]);
  }

  private printBanner(): void {
    const mongoStr =
      this.mongodb.ok
        ? `  MongoDB : ✅ ${this.mongodb.message}`
        : `  MongoDB : ❌ ${this.mongodb.message}`;
    const supaStr = this.supabase.ok
      ? `  Supabase: ✅ ${this.supabase.message}`
      : !this.supabase.configured
        ? `  Supabase: ⚠️  ${this.supabase.message}`
        : `  Supabase: ❌ ${this.supabase.message}`;

    const overall =
      this.mongodb.ok && this.supabase.ok
        ? 'OPERATIONAL'
        : this.mongodb.ok || this.supabase.ok
          ? 'DEGRADED'
          : 'OFFLINE';

    this.logger.log(
      [
        '',
        '  ┌──────────────────────────────────────────────┐',
        '  │              SYSTEM STATUS                   │',
        mongoStr,
        supaStr,
        `  Overall  : ${overall}`,
        '  └──────────────────────────────────────────────┘',
        '',
      ].join('\n'),
      'Bootstrap',
    );
  }
}
