import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

/**
 * Payload for the Grammarify-powered description improver.
 * Only `text` is accepted — the endpoint returns the improved string only.
 */
export class ImproveDescriptionDto {
  @IsString()
  @IsNotEmpty({ message: 'Description cannot be empty.' })
  @MaxLength(5000, { message: 'Description is too long (max 5000 characters).' })
  text: string;
}
