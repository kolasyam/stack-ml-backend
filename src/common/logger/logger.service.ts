import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';

/**
 * Production-grade structured logger (Winston).
 *
 * - JSON in production (easily ingested by Datadog / Logtail / Supabase Logs)
 * - Colourised, readable format in development
 * - Single transport (console) keeps the container log contract clean
 *
 * Injected via `AppLogger` (class provider) so any service can `private readonly
 * logger: AppLogger` and get consistent, leveled, context-aware logging.
 */
@Injectable()
export class AppLogger implements NestLoggerService {
  private readonly logger: winston.Logger;

  constructor() {
    const context = 'ML-Hub';
    const isProd = (process.env.NODE_ENV ?? 'development') === 'production';

    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ level, message, timestamp, context: ctx, trace }) => {
        return `${timestamp} [${level}] (${ctx ?? context}) ${message}${
          trace ? `\n${trace}` : ''
        }`;
      }),
    );

    const jsonFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    );

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL ?? 'info',
      format: isProd ? jsonFormat : consoleFormat,
      defaultMeta: { service: 'ml-knowledge-hub', context },
      transports: [new winston.transports.Console()],
    });
  }

  log(message: unknown, context?: string): void {
    this.logger.info(this.stringify(message), { context });
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.logger.error(this.stringify(message), { trace, context });
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn(this.stringify(message), { context });
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug(this.stringify(message), { context });
  }

  verbose(message: unknown, context?: string): void {
    this.logger.verbose(this.stringify(message), { context });
  }

  private stringify(message: unknown): string {
    if (typeof message === 'string') return message;
    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }
}
