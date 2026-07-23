/**
 * Unified API response envelope.
 *
 * The `ResponseInterceptor` wraps every successful controller return value in
 * `{ success, data, message?, timestamp, path }`. Controllers may return a raw
 * value (wrapped as-is) or a `SuccessResponse` to attach a human message used
 * by the frontend for Sonner toasts.
 */
export class SuccessResponse<T> {
  constructor(
    public readonly data: T,
    public readonly message?: string,
  ) {}
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Build a paginated envelope (typed helper for services). */
export function paginate<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): Paginated<T> {
  return {
    items,
    total,
    page,
    limit,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}
