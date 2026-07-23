import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

/**
 * Health / connectivity probes. Imports `DatabaseModule` so the service can
 * inject the Mongoose `Connection`; `SupabaseStorageService` is global.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
