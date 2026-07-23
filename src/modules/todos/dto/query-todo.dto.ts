import { IsIn, IsOptional, IsString } from 'class-validator';
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
  search?: string;

  @IsOptional()
  @IsIn(Object.values(TodoStatus))
  status?: TodoStatus;

  @IsOptional()
  @IsIn(Object.values(ResourcePriority))
  priority?: ResourcePriority;

  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsIn(Object.values(TodoSort))
  sort?: TodoSort;
}
