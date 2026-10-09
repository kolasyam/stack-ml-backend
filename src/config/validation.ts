import * as Joi from 'joi';

/**
 * Runtime environment validation.
 *
 * Fails fast at boot if a required variable is missing or malformed.
 * Supabase vars are OPTIONAL so the API can run for local CRUD/dev without
 * a storage backend; storage endpoints surface a clear error only when used.
 */
export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(5000),
  API_PREFIX: Joi.string().default('api/v1'),
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
  AUTH_API_KEY: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().optional().allow(''),
  }),

  MONGODB_URI: Joi.string().required(),
  MONGODB_DB_NAME: Joi.string().default('ml_knowledge_hub'),
  MONGO_SYNC_INDEXES: Joi.boolean().truthy('true').falsy('false').default(false),

  SUPABASE_URL: Joi.string().optional().allow(''),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().optional().allow(''),
  SUPABASE_BUCKET_NAME: Joi.string().default('resources'),

  MAX_FILE_SIZE_MB: Joi.number().integer().min(1).max(500).default(100),
  MAX_EXTRACTION_SIZE_MB: Joi.number().min(1).default(20),
  ALLOWED_FILE_TYPES: Joi.string().default('pdf,doc,docx'),

  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly')
    .default('info'),

  THROTTLE_TTL: Joi.number().integer().min(1).default(60),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),

  OPENROUTER_API_KEY: Joi.string().optional().allow(''),
  OPENROUTER_MODEL: Joi.string().default('poolside/laguna-xs-2.1:free'),
});
