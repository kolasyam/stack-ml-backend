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
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { QueryNoteDto } from './dto/query-note.dto';
import { NotesService } from './notes.service';

/**
 * Company task notes. Separate from personal-learning Todos.
 */
@ApiTags('Notes')
@Controller('notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a company task note' })
  async create(
    @Body() dto: CreateNoteDto,
  ): Promise<SuccessResponse<unknown>> {
    const note = await this.notes.create(dto);
    return new SuccessResponse(note, 'Note saved');
  }

  @Get()
  @ApiOperation({ summary: 'List notes (search / filter / sort / paginate)' })
  async findAll(
    @Query() query: QueryNoteDto,
  ): Promise<SuccessResponse<unknown>> {
    const result = await this.notes.findAll(query);
    return new SuccessResponse(result);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Notes dashboard summary' })
  async summary(): Promise<SuccessResponse<unknown>> {
    const result = await this.notes.summary();
    return new SuccessResponse(result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single note' })
  async findOne(
    @Param('id') id: string,
  ): Promise<SuccessResponse<unknown>> {
    const note = await this.notes.findOne(id);
    return new SuccessResponse(note);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a note' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
  ): Promise<SuccessResponse<unknown>> {
    const note = await this.notes.update(id, dto);
    return new SuccessResponse(note, 'Note updated');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a note' })
  async remove(
    @Param('id') id: string,
  ): Promise<SuccessResponse<{ deleted: true }>> {
    const result = await this.notes.remove(id);
    return new SuccessResponse(result, 'Note deleted');
  }
}
