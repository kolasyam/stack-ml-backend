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
  authApiKey: process.env.AUTH_API_KEY ?? '',

  mongoUri: process.env.MONGODB_URI,
  mongoDbName: process.env.MONGODB_DB_NAME ?? 'ml_knowledge_hub',

  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseBucket: process.env.SUPABASE_BUCKET_NAME ?? 'resources',

  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB ?? '100', 10),
  // Extraction is deliberately capped independently from upload size. A user
  // can still store/read a large document, but the API will not attempt to
  // parse an unbounded buffer during the request.
  maxExtractionSizeMb: parseInt(
    process.env.MAX_EXTRACTION_SIZE_MB ?? '20',
    10,
  ),
  allowedFileTypes: (process.env.ALLOWED_FILE_TYPES ?? 'pdf,doc,docx')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),

  logLevel: process.env.LOG_LEVEL ?? 'info',

  throttleTtl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
  throttleLimit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),

  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
  openRouterModel: process.env.OPENROUTER_MODEL ?? 'poolside/laguna-xs-2.1:free',
}));

export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  corsOrigin: string;
  authApiKey: string;
  mongoUri?: string;
  mongoDbName: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  supabaseBucket: string;
  maxFileSizeMb: number;
  maxExtractionSizeMb: number;
  allowedFileTypes: string[];
  logLevel: string;
  throttleTtl: number;
  throttleLimit: number;
  openRouterApiKey?: string;
  openRouterModel?: string;
}
