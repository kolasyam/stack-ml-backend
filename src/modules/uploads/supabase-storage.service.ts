import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { createReadStream, existsSync, promises as fs } from 'fs';
import { join } from 'path';
import { Worker } from 'worker_threads';
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
  pages?: number;
  /** Extracted plain text (capped) for in-document search + content index. */
  extractedText?: string;
  extractionStatus: 'completed' | 'skipped' | 'failed' | 'not-applicable';
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
  private readonly MAX_CONCURRENT_EXTRACTIONS = 2;
  private readonly MAX_QUEUED_EXTRACTIONS = 4;
  private activeExtractions = 0;
  private extractionWaiters: Array<() => void> = [];

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
    const uuid = randomUUID();
    return `uploads/${y}/${m}/${uuid}-${safe}`;
  }

  async upload(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
  ): Promise<UploadResult> {
    return this.uploadBody(buffer, originalName, mimeType, buffer.length, buffer);
  }

  async uploadFile(
    filePath: string,
    originalName: string,
    mimeType: string,
    fileSize: number,
  ): Promise<UploadResult> {
    const stream = createReadStream(filePath);
    return this.uploadBody(stream as unknown as Buffer, originalName, mimeType, fileSize, undefined, filePath);
  }

  private async uploadBody(
    body: Buffer,
    originalName: string,
    mimeType: string,
    fileSize: number,
    extractionBuffer?: Buffer,
    sourcePath?: string,
  ): Promise<UploadResult> {
    const path = this.buildPath(originalName);
    const client = this.getClient();

    const { error } = await client.storage
      .from(this.bucket)
      .upload(path, body, {
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

    try {
      // Extract content (page count + text) to power the reader + search.
      // Large files are intentionally stored without parsing. This protects
      // the request process until extraction moves behind a durable worker.
      const maxExtractionBytes = (this.config.get<AppConfig>('app')?.maxExtractionSizeMb ?? 20) * 1024 * 1024;
      const bytesForExtraction = extractionBuffer ??
        (sourcePath && fileSize <= maxExtractionBytes ? await fs.readFile(sourcePath) : undefined);
      const extracted = bytesForExtraction
        ? await this.extractContent(bytesForExtraction, fileType)
        : { status: 'skipped' as const };
      return {
        path,
        fileName: originalName,
        fileSize,
        fileType,
        mimeType,
        extractionStatus: extracted.status,
        pages: extracted.pages,
        extractedText: extracted.extractedText,
      };
    } catch (error) {
      // Storage succeeded but metadata preparation failed. Best-effort cleanup
      // prevents a file that the application can no longer reference.
      try {
        await this.remove(path);
      } catch {
        // Preserve the original failure; a cleanup retry can be added later.
      }
      throw error;
    }
  }

  /** Generate a short-lived signed URL for reading / previewing. */
  async createSignedUrl(path: string, expiresIn = 3600, download = false): Promise<string> {
    this.assertSafePath(path);
    const client = this.getClient();
    const { data, error } = await client.storage
      .from(this.bucket)
      .createSignedUrl(path, expiresIn, download ? { download: true } : undefined);
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
        return { ok: false, configured: true, message: 'Supabase Storage is unavailable' };
      }
      return { ok: true, configured: true, message: 'Connected to Supabase Storage' };
    } catch {
      return { ok: false, configured: true, message: 'Supabase Storage is unavailable' };
    }
  }

  async remove(path: string): Promise<void> {
    this.assertSafePath(path);
    const client = this.getClient();
    const { error } = await client.storage.from(this.bucket).remove([path]);
    if (error) {
      // Non-fatal: the DB record is what matters for the user.
      throw new ServiceUnavailableException(
        `Failed to remove file from storage: ${error.message}`,
      );
    }
  }

  /** Public validation for other modules persisting a storage reference. */
  isSafeStoragePath(path: string): boolean {
    return (
      path.length <= 512 &&
      /^uploads\/[A-Za-z0-9._/-]+$/.test(path) &&
      !path.includes('..') &&
      path.split('/').every((segment) => segment.length > 0 && segment !== '.') &&
      !path.endsWith('/')
    );
  }

  private assertSafePath(path: string): void {
    if (!path || !this.isSafeStoragePath(path)) {
      throw new ServiceUnavailableException('Invalid storage path.');
    }
  }

  /** Read page count + text from a document buffer. Never throws. */
  private async extractContent(
    buffer: Buffer,
    fileType: string,
  ): Promise<{
    pages?: number;
    extractedText?: string;
    status: UploadResult['extractionStatus'];
  }> {
    const maxExtractionMb = this.config.get<AppConfig>('app')?.maxExtractionSizeMb ?? 20;
    if (buffer.length > maxExtractionMb * 1024 * 1024) {
      return { status: 'skipped' };
    }
    await this.acquireExtractionSlot();
    try {
      const workerPath = join(__dirname, 'document-extractor.worker.js');
      if (existsSync(workerPath)) {
        return await this.extractInWorker(buffer, fileType, workerPath);
      }
      return await this.extractInProcess(buffer, fileType);
    } finally {
      this.releaseExtractionSlot();
    }
  }

  private acquireExtractionSlot(): Promise<void> {
    if (this.activeExtractions < this.MAX_CONCURRENT_EXTRACTIONS) {
      this.activeExtractions += 1;
      return Promise.resolve();
    }
    if (this.extractionWaiters.length >= this.MAX_QUEUED_EXTRACTIONS) {
      throw new ServiceUnavailableException(
        'Document extraction is busy. Please retry the upload shortly.',
      );
    }
    return new Promise((resolve) => {
      this.extractionWaiters.push(resolve);
    });
  }

  private releaseExtractionSlot(): void {
    const next = this.extractionWaiters.shift();
    if (next) next();
    else this.activeExtractions = Math.max(0, this.activeExtractions - 1);
  }

  /** Parse outside the NestJS event loop so one document cannot stall requests. */
  private extractInWorker(
    buffer: Buffer,
    fileType: string,
    workerPath: string,
  ): Promise<{
    pages?: number;
    extractedText?: string;
    status: UploadResult['extractionStatus'];
  }> {
    const transferable = new Uint8Array(buffer.length);
    transferable.set(buffer);
    return new Promise((resolve) => {
      let settled = false;
      const worker = new Worker(workerPath, {
        workerData: {
          buffer: transferable.buffer,
          fileType,
          textCap: this.TEXT_CAP,
        },
        transferList: [transferable.buffer],
      });
      const finish = (result: {
        pages?: number;
        extractedText?: string;
        status: UploadResult['extractionStatus'];
      }) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      const timer = setTimeout(() => {
        void worker.terminate();
        finish({ status: 'failed' });
      }, 60_000);
      worker.once('message', (result) => {
        clearTimeout(timer);
        finish(result);
      });
      worker.once('error', () => {
        clearTimeout(timer);
        finish({ status: 'failed' });
      });
      worker.once('exit', (code) => {
        clearTimeout(timer);
        if (code !== 0) finish({ status: 'failed' });
      });
    });
  }

  /** Development/test fallback when the worker has not been compiled yet. */
  private async extractInProcess(
    buffer: Buffer,
    fileType: string,
  ): Promise<{
    pages?: number;
    extractedText?: string;
    status: UploadResult['extractionStatus'];
  }> {
    try {
      if (fileType === 'pdf') {
        const parsed = await pdfParse(buffer, {
          pagerender: async function (pageData: any) {
            const textContent = await pageData.getTextContent();
            const text = textContent.items.map((item: any) => item.str).join(' ');
            return text + '\f';
          },
        });
        return {
          pages: parsed.numpages,
          extractedText: this.capText(parsed.text),
          status: 'completed',
        };
      }
      if (fileType === 'doc' || fileType === 'docx') {
        const { value } = await mammoth.extractRawText({ buffer });
        return { extractedText: this.capText(value), status: 'completed' };
      }
    } catch (err) {
      // Content extraction is best-effort; the file is still uploaded.
      console.warn('Content extraction failed:', (err as Error).message);
      return { status: 'failed' };
    }
      return { status: 'not-applicable' };
  }

  private capText(text: string): string | undefined {
    if (!text) return undefined;
    // Compress whitespace but preserve form-feeds (\f) which mark page boundaries
    const trimmed = text.replace(/[^\S\f]+/g, ' ').trim();
    return trimmed.length > this.TEXT_CAP
      ? trimmed.slice(0, this.TEXT_CAP)
      : trimmed;
  }
}
