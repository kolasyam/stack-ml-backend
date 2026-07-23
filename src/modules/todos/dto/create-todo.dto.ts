import { IsDate, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import {
  TodoStatus,
  ResourcePriority,
  TodoEstimatedTime,
} from '../../../common/constants/enums';

/**
 * Create a personal-learning todo. `resourceId` is MANDATORY — a todo is
 * meaningless without the resource it tracks. Validated server-side against the
 * Resources collection.
 */
export class CreateTodoDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  resourceId: string;

  @IsOptional()
  @IsIn(Object.values(TodoStatus))
  status?: TodoStatus;

  @IsOptional()
  @IsIn(Object.values(ResourcePriority))
  priority?: ResourcePriority;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date;

  @IsOptional()
  @IsIn(Object.values(TodoEstimatedTime))
  estimatedTime?: TodoEstimatedTime;
}
