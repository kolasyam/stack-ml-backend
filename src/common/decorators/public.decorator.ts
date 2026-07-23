import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route as publicly accessible.
 *
 * The `AuthGuard` (currently a pass-through stub because auth is disabled for
 * this single-user personal app) honours this flag. When authentication is
 * enabled in the future, only routes WITHOUT `@Public()` will require a session,
 * so no controller changes are needed.
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
