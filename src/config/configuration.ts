import { registerAs } from '@nestjs/config';

/**
 * Typed application configuration.
 *
 * Centralised so every module reads env via `ConfigService.get('app.*')`
 * instead of touching `process.env` directly — keeps the codebase testable
 * and type-safe, and makes future secret rotation trivial.
 */
export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '5000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',

  mongoUri: process.env.MONGODB_URI,
  mongoDbName: process.env.MONGODB_DB_NAME ?? 'ml_knowledge_hub',

  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseBucket: process.env.SUPABASE_BUCKET_NAME ?? 'resources',

  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB ?? '100', 10),
  allowedFileTypes: (process.env.ALLOWED_FILE_TYPES ?? 'pdf,doc,docx')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),

  logLevel: process.env.LOG_LEVEL ?? 'info',

  throttleTtl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
  throttleLimit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
}));

export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  corsOrigin: string;
  mongoUri?: string;
  mongoDbName: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  supabaseBucket: string;
  maxFileSizeMb: number;
  allowedFileTypes: string[];
  logLevel: string;
  throttleTtl: number;
  throttleLimit: number;
}
