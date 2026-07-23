import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuccessResponse } from '../../common/dto/response.dto';
import { SearchService } from './search.service';

/**
 * Global search endpoint. Frontend calls this on each keystroke (debounced)
 * to power the instant, cross-module search experience.
 */
@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Global search across resources, todos, notes' })
  async search(
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ): Promise<SuccessResponse<unknown>> {
    const parsedLimit = limit ? parseInt(limit, 10) : 8;
    const result = await this.searchService.search(q, parsedLimit);
    return new SuccessResponse(result);
  }
}
