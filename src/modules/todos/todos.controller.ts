import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuccessResponse } from '../../common/dto/response.dto';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { QueryTodoDto } from './dto/query-todo.dto';
import { TodosService } from './todos.service';

/**
 * Personal-learning Todos. Always linked to a Resource. Quick actions:
 * `complete` and `start` map to the card's "Mark Completed" / "Start" buttons.
 */
@ApiTags('Todos')
@Controller('todos')
export class TodosController {
  constructor(private readonly todos: TodosService) {}

  @Post()
  @ApiOperation({ summary: 'Create a personal-learning todo' })
  async create(
    @Body() dto: CreateTodoDto,
  ): Promise<SuccessResponse<unknown>> {
    const todo = await this.todos.create(dto);
    return new SuccessResponse(todo, 'Todo created');
  }

  @Get()
  @ApiOperation({ summary: 'List todos (search / filter / sort / paginate)' })
  async findAll(
    @Query() query: QueryTodoDto,
  ): Promise<SuccessResponse<unknown>> {
    const result = await this.todos.findAll(query);
    return new SuccessResponse(result);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Todo dashboard summary' })
  async summary(): Promise<SuccessResponse<unknown>> {
    const result = await this.todos.summary();
    return new SuccessResponse(result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single todo' })
  async findOne(
    @Param('id') id: string,
  ): Promise<SuccessResponse<unknown>> {
    const todo = await this.todos.findOne(id);
    return new SuccessResponse(todo);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a todo' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTodoDto,
  ): Promise<SuccessResponse<unknown>> {
    const todo = await this.todos.update(id, dto);
    return new SuccessResponse(todo, 'Todo updated');
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Mark a todo completed' })
  async complete(
    @Param('id') id: string,
  ): Promise<SuccessResponse<unknown>> {
    const todo = await this.todos.markComplete(id);
    return new SuccessResponse(todo, 'Todo completed');
  }

  @Patch(':id/start')
  @ApiOperation({ summary: 'Start a todo (status → Studying)' })
  async start(
    @Param('id') id: string,
  ): Promise<SuccessResponse<unknown>> {
    const todo = await this.todos.start(id);
    return new SuccessResponse(todo, 'Todo started');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a todo' })
  async remove(
    @Param('id') id: string,
  ): Promise<SuccessResponse<{ deleted: true }>> {
    const result = await this.todos.remove(id);
    return new SuccessResponse(result, 'Todo deleted');
  }
}
