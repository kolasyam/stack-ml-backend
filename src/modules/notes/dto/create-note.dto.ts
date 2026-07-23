import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { NotePriority, NoteStatus } from '../../../common/constants/enums';

/** Create a company task note. `taskName` is required. */
export class CreateNoteDto {
  @IsString()
  @IsNotEmpty()
  taskName: string;

  @IsOptional()
  @IsString()
  taskDescription?: string;

  @IsOptional()
  @IsIn(Object.values(NotePriority))
  priority?: NotePriority;

  @IsOptional()
  @IsIn(Object.values(NoteStatus))
  status?: NoteStatus;

  @IsOptional()
  @IsString()
  assignedBy?: string;

  @IsOptional()
  @IsString()
  projectName?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  links?: string[];
}
