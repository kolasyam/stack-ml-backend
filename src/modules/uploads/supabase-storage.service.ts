import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { AppConfig } from '../../config/configuration';

/** Result of a successful storage upload. */
export interface UploadResult {
  path: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  mimeType: string;
  signedUrl: string;
  pages?: number;
  /** Extracted plain text (capped) for in-document search + content index. */
  extractedText?: string;
}

/** Connectivity probe result shared by the health endpoint. */
export interface ComponentStatus {
  ok: boolean;
  configured: boolean;
  message: string;
}

/**
 * Supabase Storage abstraction.
 *
 * Responsibilities:
 *  - Upload document buffers to the configured bucket (organised by upload date).
 *  - Generate time-limited signed URLs for in-browser reading / download
 *    (avoids exposing a public bucket and keeps hotlinking controlled).
 *  - Extract page count + plain text from PDF / DOC / DOCX so the reader can
 *    report progress and the search index can scan file *content*.
 *
 * Only metadata + URLs are persisted in MongoDB; raw bytes live in Supabase.
 * Degrades gracefully to a clear error when Supabase is not configured.
 */
@Injectable()
export class SupabaseStorageService {
  private client: SupabaseClient | null = null;
  private readonly TEXT_CAP = 1_000_000; // ~1MB of indexed text is plenty for search

  constructor(private readonly config: ConfigService) {}

  private get appConfig(): AppConfig {
    const app = this.config.get<AppConfig>('app');
    if (!app) {
      throw new ServiceUnavailableException('App configuration is missing.');
    }
    return app;
  }

  private getClient(): SupabaseClient {
    if (this.client) return this.client;
    const app = this.appConfig;
    if (!app.supabaseUrl || !app.supabaseServiceRoleKey) {
      throw new ServiceUnavailableException(
        'File storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing). ' +
          'Set these in .env to enable uploads.',
      );
    }
    this.client = createClient(app.supabaseUrl, app.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return this.client;
  }

  private get bucket(): string {
    return this.appConfig.supabaseBucket;
  }

  /** Build a safe, date-partitioned storage path. */
  private buildPath(originalName: string): string {
    const safe = originalName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 120);
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const uuid = createHash('sha1')
      .update(`${Date.now()}-${Math.random()}-${originalName}`)
      .digest('hex')
      .slice(0, 16);
    return `uploads/${y}/${m}/${uuid}-${safe}`;
  }

  async upload(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
  ): Promise<UploadResult> {
    const path = this.buildPath(originalName);
    const client = this.getClient();

    const { error } = await client.storage
      .from(this.bucket)
      .upload(path, buffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw new ServiceUnavailableException(
        `Supabase upload failed: ${error.message}`,
      );
    }

    const fileType = (originalName.split('.').pop() ?? 'file')
      .toLowerCase();

    // Extract content (page count + text) to power the reader + search.
    const extracted = await this.extractContent(buffer, fileType);

    const signedUrl = await this.createSignedUrl(path);

    return {
      path,
      fileName: originalName,
      fileSize: buffer.length,
      fileType,
      mimeType,
      signedUrl,
      ...extracted,
    };
  }

  /** Generate a short-lived signed URL for reading / previewing. */
  async createSignedUrl(path: string, expiresIn = 3600): Promise<string> {
    const client = this.getClient();
    const { data, error } = await client.storage
      .from(this.bucket)
      .createSignedUrl(path, expiresIn);
    if (error || !data?.signedUrl) {
      throw new ServiceUnavailableException(
        `Could not create signed URL: ${error?.message ?? 'unknown error'}`,
      );
    }
    return data.signedUrl;
  }

  /** Permanent public URL (only valid if the bucket is public). */
  getPublicUrl(path: string): string {
    const client = this.getClient();
    return client.storage.from(this.bucket).getPublicUrl(path).data.publicUrl;
  }

  /**
   * Lightweight connectivity probe for the health endpoint / startup banner.
   * Never throws — a misconfigured or unreachable Supabase is reported, not
   * fatal, so the rest of the API can still boot.
   */
  async healthCheck(): Promise<ComponentStatus> {
    if (!this.appConfig.supabaseUrl || !this.appConfig.supabaseServiceRoleKey) {
      return {
        ok: false,
        configured: false,
        message:
          'Not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)',
      };
    }
    try {
      const client = this.getClient();
      const { error } = await client.storage.listBuckets();
      if (error) {
        return { ok: false, configured: true, message: `Error: ${error.message}` };
      }
      return { ok: true, configured: true, message: 'Connected to Supabase Storage' };
    } catch (err) {
      return { ok: false, configured: true, message: (err as Error).message };
    }
  }

  async remove(path: string): Promise<void> {
    const client = this.getClient();
    const { error } = await client.storage.from(this.bucket).remove([path]);
    if (error) {
      // Non-fatal: the DB record is what matters for the user.
      throw new ServiceUnavailableException(
        `Failed to remove file from storage: ${error.message}`,
      );
    }
  }

  /** Read page count + text from a document buffer. Never throws. */
  private async extractContent(
    buffer: Buffer,
    fileType: string,
  ): Promise<{ pages?: number; extractedText?: string }> {
    try {
      if (fileType === 'pdf') {
        const parsed = await pdfParse(buffer);
        return {
          pages: parsed.numpages,
          extractedText: this.capText(parsed.text),
        };
      }
      if (fileType === 'doc' || fileType === 'docx') {
        const { value } = await mammoth.extractRawText({ buffer });
        return { extractedText: this.capText(value) };
      }
    } catch (err) {
      // Content extraction is best-effort; the file is still uploaded.
      // eslint-disable-next-line no-console
      console.warn('Content extraction failed:', (err as Error).message);
    }
    return {};
  }

  private capText(text: string): string | undefined {
    if (!text) return undefined;
    const trimmed = text.replace(/\s+/g, ' ').trim();
    return trimmed.length > this.TEXT_CAP
      ? trimmed.slice(0, this.TEXT_CAP)
      : trimmed;
  }
}
