import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/** Add or update a page bookmark in the reader. */
export class BookmarkDto {
  @IsInt()
  @Min(1)
  page: number;

  @IsOptional()
  @IsString()
  note?: string;
}
