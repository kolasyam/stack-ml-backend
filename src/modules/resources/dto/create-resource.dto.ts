import {
  ArrayMaxSize,
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
  MaxLength,
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
  @MaxLength(300)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @IsIn(Object.values(ResourceType))
  type: ResourceType;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl({ require_tld: false, protocols: ['http', 'https'], require_protocol: true })
  link?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @IsUrl({ require_tld: false, protocols: ['http', 'https'], require_protocol: true }, { each: true })
  @MaxLength(2048, { each: true })
  links?: string[];

  // File metadata (supplied by Uploads endpoint when a document was uploaded)
  @IsOptional()
  @IsString()
  @MaxLength(512)
  filePath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fileSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  fileType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  pages?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000000)
  extractedText?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
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
