import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import {
  ResourceType,
  ResourcePriority,
  ResourceStatus,
  ResourceSort,
} from '../../../common/constants/enums';

/**
 * Resources list query.
 *
 * `favorite` and `tags` arrive as strings from the query string and are
 * normalised in the service (`'true'` → boolean, `'a,b'` → string[]).
 */
export class QueryResourceDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(Object.values(ResourceType))
  type?: ResourceType;

  @IsOptional()
  @IsIn(Object.values(ResourcePriority))
  priority?: ResourcePriority;

  @IsOptional()
  @IsIn(Object.values(ResourceStatus))
  status?: ResourceStatus;

  @IsOptional()
  @IsString()
  favorite?: string; // 'true' | 'false'

  @IsOptional()
  @IsString()
  tags?: string; // comma-separated

  @IsOptional()
  @IsIn(Object.values(ResourceSort))
  sort?: ResourceSort;
}
