import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import {
  TodoStatus,
  ResourcePriority,
  TodoEstimatedTime,
} from '../../../common/constants/enums';

/**
 * Personal learning todo. ALWAYS linked to a Resource (the thing to study).
 *
 * `resourceId` references `Resource`. On delete we populate a lightweight
 * projection (title/type/status) so the card shows "Resource Name" and the
 * "Open Resource" action has what it needs without a second round-trip.
 */
@Schema({
  timestamps: true,
  collection: 'todos',
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret._id;
      delete ret.__v;
    },
  },
  toObject: {
    virtuals: true,
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret._id;
      delete ret.__v;
    },
  },
})
export class Todo {
  @Prop({ required: true, trim: true, index: true })
  title: string;

  @Prop({ default: '', trim: true })
  description: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Resource',
    required: true,
    index: true,
  })
  resourceId: Types.ObjectId;

  @Prop({
    enum: Object.values(TodoStatus),
    default: TodoStatus.NOT_STARTED,
    index: true,
  })
  status: TodoStatus;

  @Prop({
    enum: Object.values(ResourcePriority),
    default: ResourcePriority.MEDIUM,
    index: true,
  })
  priority: ResourcePriority;

  @Prop()
  dueDate?: Date;

  @Prop({ enum: Object.values(TodoEstimatedTime) })
  estimatedTime?: TodoEstimatedTime;

  @Prop()
  completedAt?: Date;
}

export type TodoDocument = HydratedDocument<Todo>;
export const TodoSchema = SchemaFactory.createForClass(Todo);
TodoSchema.index({ priority: 1, createdAt: -1 });
