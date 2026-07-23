import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuccessResponse } from '../../common/dto/response.dto';
import { StatsService } from './stats.service';

/**
 * Aggregated dashboard data for the home screen — one call, fully composed.
 */
@ApiTags('Stats')
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Home dashboard summary (resources + todos + notes)' })
  async dashboard(): Promise<SuccessResponse<unknown>> {
    const result = await this.stats.dashboard();
    return new SuccessResponse(result);
  }
}
