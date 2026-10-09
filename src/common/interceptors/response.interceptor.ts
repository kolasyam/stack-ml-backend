import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';
import { SuccessResponse } from '../dto/response.dto';

/**
 * Wraps every successful response in a uniform envelope:
 * `{ success, data, message?, timestamp, path }`.
 *
 * - A controller returning a raw value → wrapped as `data`.
 * - A controller returning a `SuccessResponse` → uses its `message` too.
 * - Streams / already-sent responses are passed through untouched.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        if (response.headersSent) return data;

        // Pass through if the controller explicitly returned a pre-built envelope.
        if (
          data &&
          typeof data === 'object' &&
          'success' in (data as Record<string, unknown>) &&
          'data' in (data as Record<string, unknown>)
        ) {
          return data;
        }

        const timestamp = new Date().toISOString();
        const requestId = (request as Request & { requestId?: string }).requestId;
        if (data instanceof SuccessResponse) {
          return {
            success: true,
            data: data.data,
            message: data.message,
            timestamp,
            path: request.url,
            requestId,
          };
        }

        return {
          success: true,
          data,
          timestamp,
          path: request.url,
          requestId,
        };
      }),
    );
  }
}
