import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Authentication guard — currently a SAFE PASS-THROUGH.
 *
 * This is a personal, single-user application, so authentication is intentionally
 * NOT implemented (no login, JWT, OAuth, or sessions). The architecture leaves a
 * clean seam:
 *
 *  - `@Public()` routes are always allowed.
 *  - When auth is enabled in the future, replace the `return true` below with a
 *    real token/session check; `@Public()` routes will still bypass it. No
 *    controller code needs to change.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // AUTH DISABLED. Future: validate request.user from a JWT/session here.
    return true;
  }
}
