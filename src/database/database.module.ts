import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InjectConnection, MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AppConfig } from '../config/configuration';

/**
 * MongoDB connection (Mongoose).
 *
 * Connection string is read from typed config. `autoIndex` stays on in
 * development for convenience; in production it should be disabled and indexes
 * created via a migration / `syncIndexes()` on deploy.
 */
@Injectable()
class DatabaseIndexSync implements OnModuleInit {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async onModuleInit(): Promise<void> {
    // Index changes are explicit in production; this avoids silently dropping
    // an index during every deploy while still providing a repeatable sync.
    if (process.env.MONGO_SYNC_INDEXES !== 'true') return;
    await this.connection.syncIndexes();
  }
}

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
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000,
          socketTimeoutMS: 45000,
          maxPoolSize: 10,
          minPoolSize: 1,
          retryAttempts: 5,
          retryDelay: 1000,
        };
      },
    }),
  ],
  providers: [DatabaseIndexSync],
})
export class DatabaseModule {}
