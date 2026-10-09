import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppLogger } from '../../common/logger/logger.service';
import { SuccessResponse } from '../../common/dto/response.dto';
import { UploadsService } from './uploads.service';

/**
 * File upload / URL endpoints.
 *
 * Upload flow: client POSTs multipart → backend streams to Supabase → returns
 * metadata (path, signed URL, page count, extracted text). The client then
 * attaches that metadata to a Resource on creation.
 */
@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly uploads: UploadsService,
    private readonly logger: AppLogger,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Upload a document (PDF/DOC/DOCX) to storage' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (() => {
          const directory = join(tmpdir(), 'stackml-uploads');
          mkdirSync(directory, { recursive: true });
          return directory;
        })(),
        filename: (_req, file, callback) => {
          const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
          callback(null, `${randomUUID()}-${safeName}`);
        },
      }),
      // Enforced server-side as a hard ceiling regardless of client checks.
      limits: {
        fileSize:
          (parseInt(process.env.MAX_FILE_SIZE_MB ?? '100', 10) || 100) *
          1024 *
          1024,
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<SuccessResponse<unknown>> {
    if (!file) {
      throw new BadRequestException('No file provided under field "file".');
    }
    const result = await this.uploads.upload(file);
    this.logger.log(`Uploaded ${result.fileName} (${result.path})`, 'Uploads');
    return new SuccessResponse(result, 'File uploaded');
  }

  @Get('signed-url')
  @ApiOperation({ summary: 'Get a signed URL for an uploaded file' })
  async signedUrl(
    @Query('path') path: string,
    @Query('download') download?: string,
  ): Promise<SuccessResponse<{ url: string; path: string }>> {
    const result = await this.uploads.signedUrl(path, download === 'true');
    return new SuccessResponse(result, 'Signed URL generated');
  }

  @Delete()
  @ApiOperation({ summary: 'Delete an uploaded file from storage' })
  async remove(
    @Body('path') path: string,
  ): Promise<SuccessResponse<{ deleted: true }>> {
    const result = await this.uploads.remove(path);
    return new SuccessResponse(result, 'File deleted');
  }
}
