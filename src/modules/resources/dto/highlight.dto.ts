import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

/** A single bounding box as a fraction (0..1) of the page box. */
export class RectDto {
  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsNumber()
  w: number;

  @IsNumber()
  h: number;
}

/**
 * Create a highlight. `rects` are stored as fractions of the page so they stay
 * glued to the text across zoom levels and the dark-mode colour inversion.
 */
export class CreateHighlightDto {
  @IsNumber()
  @Min(1)
  page: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RectDto)
  rects: RectDto[];

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  note?: string;

  /** Plain text that was selected when the highlight was created. */
  @IsOptional()
  @IsString()
  text?: string;
}

/** Patch a highlight's colour and/or note. */
export class UpdateHighlightDto {
  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
