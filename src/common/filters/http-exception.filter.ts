import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppLogger } from '../logger/logger.service';

/**
 * Handles known `HttpException`s (validation errors, 404s, 409s, …) with a
 * consistent JSON error envelope.
 *
 * Registered before `AllExceptionsFilter` so expected HTTP errors get a clean,
 * client-friendly shape and are not logged as server faults.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const body = exception.getResponse() as
      | string
      | { message?: string | string[]; error?: string };

    const message =
      typeof body === 'string'
        ? body
        : (body.message ?? exception.message);
    const requestId = (request as Request & { requestId?: string }).requestId;

    const errorResponse = {
      success: false,
      statusCode: status,
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
      requestId,
      error: typeof body === 'object' ? body.error : exception.name,
      message,
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${requestId ?? 'no-request-id'}] ${request.method} ${request.url} -> ${status}`,
        exception.stack,
        'HttpExceptionFilter',
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} -> ${status} ${JSON.stringify(message)}`,
        'HttpExceptionFilter',
      );
    }

    response.status(status).json(errorResponse);
  }
}
