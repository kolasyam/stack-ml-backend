import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Authentication guard — currently a SAFE PASS-THROUGH.
 *
 * Local development remains open when AUTH_API_KEY is empty. A deployed
 * single-user instance can enable a constant-time API-key check without
 * introducing a user database, JWT flow, or session store:
 *
 *  - `@Public()` routes always bypass the key check.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const expected = this.config.get<string>('app.authApiKey')?.trim();
    // Local development remains frictionless when no key is configured. A
    // deployed single-user instance can enable the same guard with AUTH_API_KEY
    // without introducing a user database or changing controller code.
    if (!expected) {
      const environment = this.config.get<string>('app.nodeEnv') ?? 'development';
      if (environment === 'production') {
        throw new UnauthorizedException('Authentication is not configured.');
      }
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const bearer = request.header('authorization');
    const provided = request.header('x-api-key') ??
      (bearer?.startsWith('Bearer ') ? bearer.slice(7) : undefined);
    if (!provided) throw new UnauthorizedException('Authentication required.');

    const expectedBytes = Buffer.from(expected);
    const providedBytes = Buffer.from(provided);
    const matches =
      expectedBytes.length === providedBytes.length &&
      timingSafeEqual(expectedBytes, providedBytes);
    if (!matches) throw new UnauthorizedException('Authentication required.');
    return true;
  }
}
