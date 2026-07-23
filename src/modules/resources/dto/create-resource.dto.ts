import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';
import {
  ResourceType,
  ResourceDifficulty,
  ResourcePriority,
  ResourceStatus,
} from '../../../common/constants/enums';

/**
 * Payload to create a resource. `title` + `type` are required; everything else
 * (including file metadata returned by the Uploads endpoint) is optional so
 * link-only resources and uploaded documents share one shape.
 */
export class CreateResourceDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(Object.values(ResourceType))
  type: ResourceType;

  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  link?: string;

  // File metadata (supplied by Uploads endpoint when a document was uploaded)
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  filePath?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fileSize?: number;

  @IsOptional()
  @IsString()
  fileType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  pages?: number;

  @IsOptional()
  @IsString()
  extractedText?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsIn(Object.values(ResourceDifficulty))
  difficulty?: ResourceDifficulty;

  @IsOptional()
  @IsIn(Object.values(ResourcePriority))
  priority?: ResourcePriority;

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedReadingTime?: number;

  @IsOptional()
  @IsIn(Object.values(ResourceStatus))
  status?: ResourceStatus;

  @IsOptional()
  @IsBoolean()
  favorite?: boolean;
}
