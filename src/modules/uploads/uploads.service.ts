import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import {
  SupabaseStorageService,
  UploadResult,
} from './supabase-storage.service';

/**
 * Uploads orchestration: validates inbound files against allowed types/size,
 * delegates byte storage + content extraction to `SupabaseStorageService`, and
 * issues signed URLs for reading / download.
 */
@Injectable()
export class UploadsService {
  constructor(
    private readonly storage: SupabaseStorageService,
    private readonly config: ConfigService,
  ) {}

  async upload(file: Express.Multer.File): Promise<UploadResult> {
    this.validate(file);
    return this.storage.upload(file.buffer, file.originalname, file.mimetype);
  }

  async signedUrl(
    path: string,
    download = false,
  ): Promise<{ url: string; path: string }> {
    if (!path) {
      throw new BadRequestException('File path is required.');
    }
    const url = await this.storage.createSignedUrl(path, download ? 300 : 3600);
    return { url, path };
  }

  async remove(path: string): Promise<{ deleted: true }> {
    if (!path) {
      throw new BadRequestException('File path is required.');
    }
    await this.storage.remove(path);
    return { deleted: true };
  }

  private validate(file: Express.Multer.File): void {
    if (!file || !file.buffer || file.buffer.length === 0) {
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
    if (file.buffer.length > maxBytes) {
      throw new BadRequestException(
        `File exceeds the ${app.maxFileSizeMb}MB limit (got ${(
          file.buffer.length /
          1024 /
          1024
        ).toFixed(1)}MB).`,
      );
    }
  }
}
