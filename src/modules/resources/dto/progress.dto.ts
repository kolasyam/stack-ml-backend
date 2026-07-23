import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

/**
 * Persists reader position. Sent frequently (debounced) by the document reader
 * so "Continue Reading" and progress % survive reloads / device switches.
 */
export class UpdateProgressDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  currentPage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  readingProgress?: number;
}
