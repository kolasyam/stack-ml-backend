import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Base pagination contract. Default page size of 12 suits a responsive card
 * grid (3–4 columns on desktop, 1–2 on mobile). Hard cap of 100 prevents
 * accidental over-fetching from the single-user client.
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 12;
}

/** Coerce a query-string boolean ('true'/'1' → true). */
export const toBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1';
};

/** Split a comma-separated query string into a trimmed, de-duped string array. */
export const toArray = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((v) => String(v).trim()).filter(Boolean)));
  }
  return Array.from(
    new Set(String(value).split(',').map((v) => v.trim()).filter(Boolean)),
  );
};

/** Escape user input before placing it in a Mongo regular expression. */
export const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
