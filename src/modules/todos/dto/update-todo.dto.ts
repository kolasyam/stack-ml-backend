import { PartialType } from '@nestjs/mapped-types';
import { CreateTodoDto } from './create-todo.dto';

/** Partial update of a todo (resourceId may be changed; re-validated). */
export class UpdateTodoDto extends PartialType(CreateTodoDto) {}
