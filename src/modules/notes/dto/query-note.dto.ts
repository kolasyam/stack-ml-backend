import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { NoteStatus, NotePriority } from '../../../common/constants/enums';

export const NoteSort = {
  NEWEST: 'newest',
  OLDEST: 'oldest',
  PRIORITY: 'priority',
  PROJECT: 'project',
} as const;
export type NoteSort = (typeof NoteSort)[keyof typeof NoteSort];

/** Note list query. */
export class QueryNoteDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(Object.values(NoteStatus))
  status?: NoteStatus;

  @IsOptional()
  @IsIn(Object.values(NotePriority))
  priority?: NotePriority;

  @IsOptional()
  @IsString()
  projectName?: string;

  @IsOptional()
  @IsIn(Object.values(NoteSort))
  sort?: NoteSort;
}
