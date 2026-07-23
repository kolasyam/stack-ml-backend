import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';

import configuration from './config/configuration';
import { validationSchema } from './config/validation';
import { AppConfig } from './config/configuration';
import { CoreModule } from './core/core.module';
import { LoggerModule } from './common/logger/logger.module';
import { DatabaseModule } from './database/database.module';

import { ResourcesModule } from './modules/resources/resources.module';
import { TodosModule } from './modules/todos/todos.module';
import { NotesModule } from './modules/notes/notes.module';
import { DescriptionModule } from './modules/description/description.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { StorageModule } from './modules/uploads/storage.module';
import { SearchModule } from './modules/search/search.module';
import { StatsModule } from './modules/stats/stats.module';
import { HealthModule } from './modules/health/health.module';

/**
 * Root application module.
 *
 * Composition root: wires configuration, throttling, logging, cross-cutting
 * concerns (`CoreModule`), persistence (`DatabaseModule`), and the three
 * feature domains plus uploads/search/stats/health.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: { allowUnknown: true, abortEarly: true },
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const app = config.get<AppConfig>('app');
        if (!app) {
          throw new Error('App configuration is missing.');
        }
        return {
          throttlers: [
            {
              name: 'global',
              ttl: app.throttleTtl * 1000,
              limit: app.throttleLimit,
            },
          ],
        };
      },
    }),
    LoggerModule,
    CoreModule,
    EventEmitterModule.forRoot(),
    StorageModule,
    DatabaseModule,
    ResourcesModule,
    TodosModule,
    NotesModule,
    DescriptionModule,
    UploadsModule,
    SearchModule,
    StatsModule,
    HealthModule,
  ],
  providers: [
    // Rate limiting applied globally (auth guard is provided in CoreModule).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
