import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuccessResponse } from '../../common/dto/response.dto';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { QueryResourceDto } from './dto/query-resource.dto';
import { UpdateProgressDto } from './dto/progress.dto';
import { BookmarkDto } from './dto/bookmark.dto';
import { CreateHighlightDto, UpdateHighlightDto } from './dto/highlight.dto';
import { ResourcesService } from './resources.service';

/**
 * Resources API — CRUD + reader state (progress / bookmarks / favourite) +
 * signed file-URL issuance for the integrated document reader.
 */
@ApiTags('Resources')
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a learning resource' })
  async create(
    @Body() dto: CreateResourceDto,
  ): Promise<SuccessResponse<unknown>> {
    const resource = await this.resources.create(dto);
    return new SuccessResponse(resource, 'Resource added successfully');
  }

  @Get()
  @ApiOperation({ summary: 'List resources (search / filter / sort / paginate)' })
  async findAll(
    @Query() query: QueryResourceDto,
  ): Promise<SuccessResponse<unknown>> {
    const result = await this.resources.findAll(query);
    return new SuccessResponse(result);
  }

  @Get(':id/file-url')
  @ApiOperation({ summary: 'Get a signed URL for the resource file' })
  async fileUrl(
    @Param('id') id: string,
  ): Promise<SuccessResponse<{ url: string }>> {
    const url = await this.resources.getFileUrl(id);
    return new SuccessResponse(url);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single resource' })
  async findOne(
    @Param('id') id: string,
  ): Promise<SuccessResponse<unknown>> {
    const resource = await this.resources.findOne(id);
    return new SuccessResponse(resource);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a resource' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateResourceDto,
  ): Promise<SuccessResponse<unknown>> {
    const resource = await this.resources.update(id, dto);
    return new SuccessResponse(resource, 'Resource updated');
  }

  @Patch(':id/progress')
  @ApiOperation({ summary: 'Persist reader progress + current page' })
  async updateProgress(
    @Param('id') id: string,
    @Body() dto: UpdateProgressDto,
  ): Promise<SuccessResponse<unknown>> {
    const resource = await this.resources.updateProgress(id, dto);
    return new SuccessResponse(resource);
  }

  @Patch(':id/favorite')
  @ApiOperation({ summary: 'Toggle favourite' })
  async toggleFavorite(
    @Param('id') id: string,
  ): Promise<SuccessResponse<unknown>> {
    const resource = await this.resources.toggleFavorite(id);
    return new SuccessResponse(resource, 'Favorite updated');
  }

  @Post(':id/bookmarks')
  @ApiOperation({ summary: 'Add or update a page bookmark' })
  async addBookmark(
    @Param('id') id: string,
    @Body() dto: BookmarkDto,
  ): Promise<SuccessResponse<unknown>> {
    const resource = await this.resources.addBookmark(id, dto);
    return new SuccessResponse(resource, 'Bookmark saved');
  }

  @Delete(':id/bookmarks/:page')
  @ApiOperation({ summary: 'Remove a page bookmark' })
  async removeBookmark(
    @Param('id') id: string,
    @Param('page', ParseIntPipe) page: number,
  ): Promise<SuccessResponse<unknown>> {
    const resource = await this.resources.removeBookmark(id, page);
    return new SuccessResponse(resource, 'Bookmark removed');
  }

  @Post(':id/highlights')
  @ApiOperation({ summary: 'Add a text highlight' })
  async addHighlight(
    @Param('id') id: string,
    @Body() dto: CreateHighlightDto,
  ): Promise<SuccessResponse<unknown>> {
    const resource = await this.resources.addHighlight(id, dto);
    return new SuccessResponse(resource, 'Highlight saved');
  }

  @Patch(':id/highlights/:highlightId')
  @ApiOperation({ summary: 'Update a highlight (colour / note)' })
  async updateHighlight(
    @Param('id') id: string,
    @Param('highlightId') highlightId: string,
    @Body() dto: UpdateHighlightDto,
  ): Promise<SuccessResponse<unknown>> {
    const resource = await this.resources.updateHighlight(id, highlightId, dto);
    return new SuccessResponse(resource, 'Highlight updated');
  }

  @Delete(':id/highlights/:highlightId')
  @ApiOperation({ summary: 'Remove a highlight' })
  async removeHighlight(
    @Param('id') id: string,
    @Param('highlightId') highlightId: string,
  ): Promise<SuccessResponse<unknown>> {
    const resource = await this.resources.removeHighlight(id, highlightId);
    return new SuccessResponse(resource, 'Highlight removed');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a resource (and its file)' })
  async remove(
    @Param('id') id: string,
  ): Promise<SuccessResponse<{ deleted: true }>> {
    const result = await this.resources.remove(id);
    return new SuccessResponse(result, 'Resource deleted');
  }
}
