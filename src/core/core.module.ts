import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../common/interceptors/response.interceptor';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
import { AuthGuard } from '../common/guards/auth.guard';

/**
 * App-wide cross-cutting concerns, wired as global providers so they apply to
 * every route without per-controller boilerplate.
 *
 * Registration order matters:
 *  - Global filters execute in REVERSE registration order, so `AllExceptionsFilter`
 *    is registered first (runs last, as the catch-all fallback) and
 *    `HttpExceptionFilter` is registered last (runs first, giving expected HTTP
 *    errors — validation 400s, 404s — a clean, correctly-labelled client shape).
 *  - `LoggingInterceptor` runs first (times the request), then `ResponseInterceptor`
 *    wraps the payload.
 *  - `AuthGuard` is the global guard seam (currently pass-through).
 */
@Global()
@Module({
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class CoreModule {}
