import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  ResourceType,
  ResourceDifficulty,
  ResourcePriority,
  ResourceStatus,
} from '../../../common/constants/enums';

/** A single page bookmark in the integrated document reader. */
export interface Bookmark {
  page: number;
  note?: string;
  createdAt: Date;
}

/**
 * A persisted text highlight in the PDF reader. Each rect is stored as a
 * fraction (0..1) of the page box so highlights stay aligned across zoom and
 * the dark-mode colour inversion.
 */
export interface Highlight {
  page: number;
  rects: { x: number; y: number; w: number; h: number }[];
  color: string;
  note?: string;
  /** Plain text that was selected when the highlight was created. */
  text?: string;
  createdAt?: Date;
}

/**
 * Learning resource.
 *
 * Indexing strategy:
 *  - `type`, `priority`, `status`, `favorite`, `tags` indexed for filter speed.
 *  - A compound text index over title/description/tags/fileName/extractedText
 *    powers global + in-document content search.
 *  - `extractedText` is `select:false` so it never travels to list/detail
 *    responses; it exists purely for the text index + search snippet.
 *  - `timestamps` supplies createdAt / updatedAt automatically.
 */
@Schema({
  timestamps: true,
  collection: 'resources',
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: any) => {
      delete ret._id;
      delete ret.__v;
      // `extractedText` is `select: false`: keep it out of serialised
      // responses so large documents never ship their full text to clients
      // (it exists only for the text index + server-side search).
      delete ret.extractedText;
    },
  },
  toObject: {
    virtuals: true,
    transform: (_doc, ret: any) => {
      delete ret._id;
      delete ret.__v;
      delete ret.extractedText;
    },
  },
})
export class Resource {
  @Prop({ required: true, trim: true, index: true })
  title: string;

  @Prop({ default: '', trim: true })
  description: string;

  @Prop({ required: true, enum: Object.values(ResourceType), index: true })
  type: ResourceType;

  @Prop({ trim: true })
  link?: string;

  // ---- File metadata (actual bytes live in Supabase) ----
  @Prop()
  fileUrl?: string;

  @Prop({ index: true })
  filePath?: string;

  @Prop()
  fileName?: string;

  @Prop({ type: Number, min: 0 })
  fileSize?: number;

  @Prop()
  fileType?: string;

  @Prop({ type: Number, min: 1 })
  pages?: number;

  @Prop({ type: String, select: false })
  extractedText?: string;

  // ---- Organisation ----
  @Prop({ type: [String], default: [], index: true })
  tags: string[];

  @Prop({ enum: Object.values(ResourceDifficulty), index: true })
  difficulty?: ResourceDifficulty;

  @Prop({ enum: Object.values(ResourcePriority), index: true })
  priority?: ResourcePriority;

  @Prop({ type: Number, min: 0 })
  estimatedReadingTime?: number;

  @Prop({
    enum: Object.values(ResourceStatus),
    default: ResourceStatus.NOT_STARTED,
    index: true,
  })
  status: ResourceStatus;

  @Prop({ default: false, index: true })
  favorite: boolean;

  // ---- Reader state (persisted across sessions) ----
  @Prop({ type: Number, default: 0, min: 0, max: 100 })
  readingProgress: number;

  @Prop({ type: Number, default: 1, min: 1 })
  currentPage: number;

  @Prop({
    type: [
      {
        page: { type: Number, required: true },
        note: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    _id: true,
    default: [],
  })
  bookmarks: Bookmark[];

  @Prop({
    type: [
      {
        page: { type: Number, required: true, min: 1 },
        rects: {
          type: [
            {
              x: { type: Number, required: true },
              y: { type: Number, required: true },
              w: { type: Number, required: true },
              h: { type: Number, required: true },
            },
          ],
          required: true,
        },
        color: { type: String, default: '#3cffd0' },
        note: { type: String, default: '' },
        text: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    _id: true,
    default: [],
  })
  highlights: Highlight[];

  @Prop()
  lastReadAt?: Date;

  // Supplied by `timestamps: true` on the schema.
  createdAt?: Date;
  updatedAt?: Date;
}

export type ResourceDocument = HydratedDocument<Resource>;
export const ResourceSchema = SchemaFactory.createForClass(Resource);

ResourceSchema.index({
  title: 'text',
  description: 'text',
  tags: 'text',
  fileName: 'text',
  extractedText: 'text',
});
