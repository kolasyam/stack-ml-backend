import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfig } from '../config/configuration';

/**
 * MongoDB connection (Mongoose).
 *
 * Connection string is read from typed config. `autoIndex` stays on in
 * development for convenience; in production it should be disabled and indexes
 * created via a migration / `syncIndexes()` on deploy.
 */
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const app = config.get<AppConfig>('app');
        if (!app?.mongoUri) {
          throw new Error('MONGODB_URI is required but was not provided.');
        }
        return {
          uri: app.mongoUri,
          dbName: app.mongoDbName,
          autoIndex: app.nodeEnv !== 'production',
        };
      },
    }),
  ],
})
export class DatabaseModule {}
