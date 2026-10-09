import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'storage_cleanup', timestamps: true })
export class StorageCleanup {
  @Prop({ required: true, unique: true, index: true })
  path: string;

  @Prop({ default: 0 })
  attempts: number;

  @Prop({ required: true, index: true })
  nextAttemptAt: Date;
}

export type StorageCleanupDocument = HydratedDocument<StorageCleanup>;
export const StorageCleanupSchema = SchemaFactory.createForClass(StorageCleanup);
