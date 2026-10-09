import { IsIn, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { TodoStatus, ResourcePriority } from '../../../common/constants/enums';

export const TodoSort = {
  NEWEST: 'newest',
  OLDEST: 'oldest',
  UPCOMING: 'upcoming',
  PRIORITY: 'priority',
  DUE_DATE: 'dueDate',
} as const;
export type TodoSort = (typeof TodoSort)[keyof typeof TodoSort];

/** Todo list query. */
export class QueryTodoDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(Object.values(TodoStatus))
  status?: TodoStatus;

  @IsOptional()
  @IsIn(Object.values(ResourcePriority))
  priority?: ResourcePriority;

  @IsOptional()
  @IsMongoId()
  resourceId?: string;

  @IsOptional()
  @IsIn(Object.values(TodoSort))
  sort?: TodoSort;
}
