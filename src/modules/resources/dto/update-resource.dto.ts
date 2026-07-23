import { PartialType } from '@nestjs/mapped-types';
import { CreateResourceDto } from './create-resource.dto';

/** All fields optional — partial update of a resource. */
export class UpdateResourceDto extends PartialType(CreateResourceDto) {}
