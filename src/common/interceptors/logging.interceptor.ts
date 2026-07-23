import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { AppLogger } from '../logger/logger.service';

/**
 * Logs inbound requests and outbound responses with latency.
 * Respects a `X-Skip-Log` header so noisy health/poll endpoints can opt out.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    if (request.headers['x-skip-log'] === 'true') {
      return next.handle();
    }

    const now = Date.now();
    const { method, url } = request;

    return next.handle().pipe(
      tap({
        next: () => {
          const latency = Date.now() - now;
          this.logger.log(
            `${method} ${url} ${response.statusCode} ${latency}ms`,
            'Request',
          );
        },
        error: (err) => {
          const latency = Date.now() - now;
          this.logger.error(
            `${method} ${url} failed in ${latency}ms`,
            err?.stack,
            'Request',
          );
        },
      }),
    );
  }
}
