import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { AppConfig } from '../../config/configuration';
import {
  SupabaseStorageService,
  UploadResult,
} from './supabase-storage.service';
import { UploadManifestService } from './upload-manifest.service';
import { StorageCleanupService } from './storage-cleanup.service';

/**
 * Uploads orchestration: validates inbound files against allowed types/size,
 * delegates byte storage + content extraction to `SupabaseStorageService`, and
 * records a server-owned upload manifest for later resource attachment.
 */
@Injectable()
export class UploadsService {
  constructor(
    private readonly storage: SupabaseStorageService,
    private readonly config: ConfigService,
    @Optional() private readonly manifests?: UploadManifestService,
    @Optional() private readonly cleanup?: StorageCleanupService,
  ) {}

  async upload(file: Express.Multer.File): Promise<UploadResult> {
    let result: UploadResult | undefined;
    try {
      await this.validate(file);
      result = file.path
        ? await this.storage.uploadFile(file.path, file.originalname, file.mimetype, file.size)
        : await this.storage.upload(file.buffer, file.originalname, file.mimetype);
      await this.manifests?.record(result);
      return result;
    } catch (err) {
      if (result) {
        try { await this.storage.remove(result.path); }
        catch { await this.cleanup?.enqueue(result.path).catch(() => undefined); }
      }
      throw err;
    } finally {
      if (file.path) await fs.unlink(file.path).catch(() => undefined);
    }
  }

  async signedUrl(
    path: string,
    download = false,
  ): Promise<{ url: string; path: string }> {
    if (!path) {
      throw new BadRequestException('File path is required.');
    }
    this.assertSafePath(path);
    if (this.manifests && !(await this.manifests.exists(path))) {
      throw new BadRequestException('This upload reference is not owned by a pending upload.');
    }
    const url = await this.storage.createSignedUrl(path, download ? 300 : 3600, download);
    return { url, path };
  }

  async remove(path: string): Promise<{ deleted: true }> {
    if (!path) {
      throw new BadRequestException('File path is required.');
    }
    this.assertSafePath(path);
    if (this.manifests && !(await this.manifests.exists(path))) {
      throw new BadRequestException('This upload reference is not owned by a pending upload.');
    }
    await this.storage.remove(path);
    await this.manifests?.remove(path);
    return { deleted: true };
  }

  private async validate(file: Express.Multer.File): Promise<void> {
    if (!file || (!file.buffer && !file.path) || (file.size ?? file.buffer?.length ?? 0) === 0) {
      throw new BadRequestException('No file provided or file is empty.');
    }
    const app = this.config.get<AppConfig>('app');
    if (!app) {
      throw new BadRequestException('Server configuration error.');
    }
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    if (!app.allowedFileTypes.includes(ext)) {
      throw new BadRequestException(
        `Unsupported file type ".${ext}". Allowed: ${app.allowedFileTypes.join(', ')}`,
      );
    }
    const maxBytes = app.maxFileSizeMb * 1024 * 1024;
    const fileSize = file.size ?? file.buffer?.length ?? 0;
    if (fileSize > maxBytes) {
      throw new BadRequestException(
        `File exceeds the ${app.maxFileSizeMb}MB limit (got ${(
          fileSize /
          1024 /
          1024
        ).toFixed(1)}MB).`,
      );
    }

    const fileType = ext;
    let header: Buffer;
    if (file.buffer) {
      header = file.buffer.subarray(0, 8);
    } else {
      const handle = await fs.open(file.path, 'r');
      try {
        header = Buffer.alloc(8);
        await handle.read(header, 0, 8, 0);
      } finally {
        await handle.close();
      }
    }
    const signature = header.toString('latin1');
    const validSignature =
      (fileType === 'pdf' && signature.startsWith('%PDF-')) ||
      (fileType === 'docx' && signature.startsWith('PK')) ||
      (fileType === 'doc' && signature.startsWith('\u0000\u0001\u0002\u0003')) ||
      (fileType === 'doc' && header.equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])));
    if (!validSignature) {
      throw new BadRequestException(
        'The file contents do not match the selected document type.',
      );
    }
  }

  /** Prevent callers from addressing arbitrary objects in the storage bucket. */
  private assertSafePath(path: string): void {
    if (!this.storage.isSafeStoragePath(path)) {
      throw new BadRequestException('Invalid storage path.');
    }
  }
}
