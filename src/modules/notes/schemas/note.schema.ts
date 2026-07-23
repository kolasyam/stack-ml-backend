import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { NotePriority, NoteStatus } from '../../../common/constants/enums';

/**
 * Company task note (distinct from personal-learning Todos).
 *
 * Plain document store — no external references. `attachments` / `links` are
 * free-form URL arrays the user can paste from ticketing tools / docs.
 */
@Schema({
  timestamps: true,
  collection: 'notes',
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: any) => {
      delete ret._id;
      delete ret.__v;
    },
  },
  toObject: {
    virtuals: true,
    transform: (_doc, ret: any) => {
      delete ret._id;
      delete ret.__v;
    },
  },
})
export class Note {
  @Prop({ required: true, trim: true, index: true })
  taskName: string;

  @Prop({ default: '', trim: true })
  taskDescription: string;

  @Prop({
    enum: Object.values(NotePriority),
    default: NotePriority.MEDIUM,
    index: true,
  })
  priority: NotePriority;

  @Prop({
    enum: Object.values(NoteStatus),
    default: NoteStatus.NOT_STARTED,
    index: true,
  })
  status: NoteStatus;

  @Prop({ trim: true })
  assignedBy?: string;

  @Prop({ trim: true, index: true })
  projectName?: string;

  @Prop({ type: [String], default: [] })
  attachments: string[];

  @Prop({ type: [String], default: [] })
  links: string[];
}

export type NoteDocument = HydratedDocument<Note>;
export const NoteSchema = SchemaFactory.createForClass(Note);

NoteSchema.index({ taskName: 'text', taskDescription: 'text', projectName: 'text' });
