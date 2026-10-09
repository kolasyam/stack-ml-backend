import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** Add or update a page bookmark in the reader. */
export class BookmarkDto {
  @IsInt()
  @Min(1)
  page: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
