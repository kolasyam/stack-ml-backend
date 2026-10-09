import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuccessResponse } from '../../common/dto/response.dto';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';

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
    @Query() query: SearchQueryDto,
  ): Promise<SuccessResponse<unknown>> {
    const result = await this.searchService.search(query.q, query.limit);
    return new SuccessResponse(result);
  }
}
