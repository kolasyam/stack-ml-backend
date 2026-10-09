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
 * Catch-all filter for unexpected errors (DB failures, undefined throws, …).
 *
 * Never leaks stack traces to the client. Logs with full stack for diagnosis.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // If a more specific filter already handled an HttpException, this still
    // runs as a fallback but should not double-write the response.
    if (response.headersSent) return;

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? (exception.getResponse() as { message?: string } | string)
        : 'Internal server error';
    const requestId = (request as Request & { requestId?: string }).requestId;

    this.logger.error(
      `[${requestId ?? 'no-request-id'}] Unhandled error on ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : String(exception),
      'AllExceptionsFilter',
    );

    response.status(status).json({
      success: false,
      statusCode: status,
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
      requestId,
      error: 'InternalServerError',
      message:
        typeof message === 'string'
          ? message
          : (message.message ?? 'Internal server error'),
    });
  }
}
