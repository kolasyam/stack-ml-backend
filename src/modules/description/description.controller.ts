import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuccessResponse } from '../../common/dto/response.dto';
import { ImproveDescriptionDto } from './dto/improve-description.dto';
import { DescriptionService } from './description.service';

/**
 * Description API — a thin Grammarify wrapper that proofs/improves free-text
 * descriptions for resources, todos and notes.
 */
@ApiTags('Description')
@Controller('description')
export class DescriptionController {
  constructor(private readonly description: DescriptionService) {}

  @Post('improve')
  @ApiOperation({ summary: 'Proofread & improve a description with Grammarify' })
  async improve(
    @Body() dto: ImproveDescriptionDto,
  ): Promise<SuccessResponse<string>> {
    const improved = await this.description.improve(dto.text);
    return new SuccessResponse(improved);
  }
}
