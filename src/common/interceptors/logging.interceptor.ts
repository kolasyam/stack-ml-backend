import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { AppLogger } from '../logger/logger.service';

/**
 * Logs inbound requests and outbound responses with latency.
 * Every request is logged so callers cannot suppress audit records.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Accept a caller-provided correlation id for end-to-end tracing, but do
    // not trust arbitrary values or allow unbounded header data into logs.
    const incomingId = request.header('x-request-id');
    const requestId =
      incomingId && /^[A-Za-z0-9._:-]{1,128}$/.test(incomingId)
        ? incomingId
        : randomUUID();
    response.setHeader('x-request-id', requestId);
    (request as Request & { requestId?: string }).requestId = requestId;

    const now = Date.now();
    const { method, url } = request;

    return next.handle().pipe(
      tap({
        next: () => {
          const latency = Date.now() - now;
          this.logger.log(
            `[${requestId}] ${method} ${url} ${response.statusCode} ${latency}ms`,
            'Request',
          );
        },
        error: (err) => {
          const latency = Date.now() - now;
          this.logger.error(
            `[${requestId}] ${method} ${url} failed in ${latency}ms`,
            err?.stack,
            'Request',
          );
        },
      }),
    );
  }
}
