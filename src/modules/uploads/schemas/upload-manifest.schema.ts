import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'upload_manifests', timestamps: true })
export class UploadManifest {
  @Prop({ required: true, unique: true, index: true })
  path: string;

  @Prop({ required: true })
  fileName: string;

  @Prop({ required: true, min: 1 })
  fileSize: number;

  @Prop({ required: true })
  fileType: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ min: 1 })
  pages?: number;

  @Prop({ type: String, select: false })
  extractedText?: string;

  @Prop({ required: true, enum: ['completed', 'skipped', 'failed', 'not-applicable'] })
  extractionStatus: string;

  // A pending upload must be attached to a resource within one hour.
  @Prop({ required: true, index: true })
  expiresAt: Date;
}

export type UploadManifestDocument = HydratedDocument<UploadManifest>;
export const UploadManifestSchema = SchemaFactory.createForClass(UploadManifest);
