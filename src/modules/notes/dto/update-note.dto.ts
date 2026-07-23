import { PartialType } from '@nestjs/mapped-types';
import { CreateNoteDto } from './create-note.dto';

/** Partial update of a note. */
export class UpdateNoteDto extends PartialType(CreateNoteDto) {}
