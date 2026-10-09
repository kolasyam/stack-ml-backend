import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { NotePriority, NoteStatus } from '../../../common/constants/enums';

/** Create a company task note. `taskName` is required. */
export class CreateNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  taskName: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  taskDescription?: string;

  @IsOptional()
  @IsIn(Object.values(NotePriority))
  priority?: NotePriority;

  @IsOptional()
  @IsIn(Object.values(NoteStatus))
  status?: NoteStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  assignedBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  projectName?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { each: true })
  attachments?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { each: true })
  links?: string[];
}
