import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsInt,
  Max,
  MaxLength,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

/** A single bounding box as a fraction (0..1) of the page box. */
export class RectDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  x: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  y: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  w: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  h: number;
}

/**
 * Create a highlight. `rects` are stored as fractions of the page so they stay
 * glued to the text across zoom levels and the dark-mode colour inversion.
 */
export class CreateHighlightDto {
  @IsInt()
  @Min(1)
  page: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RectDto)
  rects: RectDto[];

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  /** Plain text that was selected when the highlight was created. */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  text?: string;
}

/** Patch a highlight's colour and/or note. */
export class UpdateHighlightDto {
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
