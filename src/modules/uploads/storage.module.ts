import { Global, Module } from '@nestjs/common';
import { SupabaseStorageService } from './supabase-storage.service';

/**
 * Shared storage provider. Imported by both `UploadsModule` (upload endpoints)
 * and `ResourcesModule` (cascade file deletion) so there is a single Supabase
 * client/configuration source of truth.
 */
@Global()
@Module({
  providers: [SupabaseStorageService],
  exports: [SupabaseStorageService],
})
export class StorageModule {}
