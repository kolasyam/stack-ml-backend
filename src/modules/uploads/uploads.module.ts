import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StorageModule } from './storage.module';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { UploadManifest, UploadManifestSchema } from './schemas/upload-manifest.schema';
import { UploadManifestService } from './upload-manifest.service';
import { StorageCleanup, StorageCleanupSchema } from './schemas/storage-cleanup.schema';
import { StorageCleanupService } from './storage-cleanup.service';

@Module({
  controllers: [UploadsController],
  imports: [StorageModule, MongooseModule.forFeature([
    { name: UploadManifest.name, schema: UploadManifestSchema },
    { name: StorageCleanup.name, schema: StorageCleanupSchema },
  ])],
  providers: [UploadsService, UploadManifestService, StorageCleanupService],
  exports: [UploadsService, UploadManifestService, StorageCleanupService],
})
export class UploadsModule {}
