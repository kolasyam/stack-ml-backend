import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FilterQuery, Model, Types } from 'mongoose';
import { AppLogger } from '../../common/logger/logger.service';
import { Paginated, paginate } from '../../common/dto/response.dto';
import { toArray, toBoolean } from '../../common/dto/pagination.dto';
import {
  DOCUMENT_TYPES,
  isDocumentType,
  ResourceSort,
  ResourceStatus,
} from '../../common/constants/enums';
import { SupabaseStorageService } from '../uploads/supabase-storage.service';
import { UploadManifestService } from '../uploads/upload-manifest.service';
import { StorageCleanupService } from '../uploads/storage-cleanup.service';
import { Resource, ResourceDocument } from './schemas/resource.schema';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { QueryResourceDto } from './dto/query-resource.dto';
import { UpdateProgressDto } from './dto/progress.dto';
import { BookmarkDto } from './dto/bookmark.dto';
import { CreateHighlightDto, UpdateHighlightDto } from './dto/highlight.dto';

export interface ResourceStats {
  total: number;
  reading: number;
  completed: number;
  favorites: number;
  pdfs: number;
}

/**
 * Resource domain logic.
 *
 * Validates ObjectIds, builds the filter/sort/search query, persists reader
 * state (progress / current page / bookmarks) and emits `resource.deleted`
 * so the Todos module can cascade-clean linked study items without a direct
 * import (keeps modules decoupled).
 */
@Injectable()
export class ResourcesService {
  constructor(
    @InjectModel(Resource.name)
    private readonly resourceModel: Model<ResourceDocument>,
    private readonly storage: SupabaseStorageService,
    private readonly manifests: UploadManifestService,
    private readonly cleanup: StorageCleanupService,
    private readonly events: EventEmitter2,
    private readonly logger: AppLogger,
  ) {}

  async create(dto: CreateResourceDto): Promise<ResourceDocument> {
    const payload: Partial<CreateResourceDto> = { ...dto };
    if (payload.filePath && !isDocumentType(payload.type as (typeof dto)['type'])) {
      throw new BadRequestException('Only document resources may have an uploaded file.');
    }
    this.validateFilePath(payload.filePath);
    if (payload.filePath) {
      const manifest = await this.manifests.get(payload.filePath);
      if (!manifest) throw new BadRequestException('Upload reference is expired or not owned by this server.');
      payload.fileName = manifest.fileName;
      payload.fileSize = manifest.fileSize;
      payload.fileType = manifest.fileType;
      payload.pages = manifest.pages;
      payload.extractedText = manifest.extractedText;
    } else {
      delete payload.fileName;
      delete payload.fileSize;
      delete payload.fileType;
      delete payload.pages;
      delete payload.extractedText;
    }
    // Signed URLs are generated only by getFileUrl and are never persisted.
    const doc = new this.resourceModel(payload);
    const saved = await doc.save();
    if (payload.filePath) {
      try { await this.manifests.remove(payload.filePath); } catch (err) {
        this.logger.warn(`Failed to finalize upload manifest ${payload.filePath}: ${(err as Error).message}`, 'Resources');
      }
    }
    return saved;
  }

  async findAll(query: QueryResourceDto): Promise<Paginated<ResourceDocument>> {
    const filter = this.buildFilter(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const total = await this.resourceModel.countDocuments(filter);

    if (query.sort === ResourceSort.PROGRESS) {
      const items = await this.resourceModel.find(filter)
        .sort({ readingProgress: -1, updatedAt: -1 })
        .skip((page - 1) * limit).limit(limit).exec();
      return paginate(items, total, page, limit);
    }
    if (query.sort === ResourceSort.PRIORITY) {
      const raw = await this.resourceModel.aggregate([
        { $match: filter },
        { $addFields: { __priorityRank: { $switch: { branches: [
          { case: { $eq: ['$priority', 'Critical'] }, then: 4 },
          { case: { $eq: ['$priority', 'High'] }, then: 3 },
          { case: { $eq: ['$priority', 'Medium'] }, then: 2 },
          { case: { $eq: ['$priority', 'Low'] }, then: 1 },
        ], default: 0 } } } },
        { $sort: { __priorityRank: -1, createdAt: -1 } },
        { $skip: (page - 1) * limit }, { $limit: limit },
        { $project: { __priorityRank: 0, extractedText: 0, fileUrl: 0 } },
      ]).exec();
      return paginate(raw.map((item) => this.resourceModel.hydrate(item)), total, page, limit);
    }

    const sort = this.buildSort(query.sort, !!query.search);
    const items = await this.resourceModel
      .find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();
    return paginate(items, total, page, limit);
  }

  async findOne(id: string): Promise<ResourceDocument> {
    return this.findByIdOrThrow(id);
  }

  /** Issue a fresh signed URL for a resource's attached file. */
  async getFileUrl(id: string, download = false): Promise<{ url: string }> {
    const resource = await this.findByIdOrThrow(id);
    if (!resource.filePath) {
      throw new BadRequestException('This resource has no attached file.');
    }
    const url = await this.storage.createSignedUrl(resource.filePath, download ? 300 : 3600, download);
    return { url };
  }

  /** Search the extracted text array for a keyword and return matching page numbers using MongoDB aggregation. */
  async searchDocument(id: string, q: string): Promise<{ pages: number[] }> {
    const term = (q ?? '').trim();
    if (!term) return { pages: [] };

    if (!Types.ObjectId.isValid(id)) throw new NotFoundException(`Resource "${id}" not found.`);

    // Escape special regex characters and replace all spaces with a flexible whitespace/newline matcher
    // This solves the issue where PDF parsing introduces arbitrary newlines or double spaces mid-sentence.
    const regexStr = term
      .split(/\s+/)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[\\s\\-]*');

    const result = await this.resourceModel.aggregate([
      { $match: { _id: new Types.ObjectId(id) } },
      // 1. Split the massive extractedText string into an array of page strings using the \f delimiter
      { $project: { pages: { $split: [{ $ifNull: ['$extractedText', ''] }, '\f'] } } },
      // 2. Unwind the pages array and keep the array index so we know the exact page number
      { $unwind: { path: '$pages', includeArrayIndex: 'pageIndex' } },
      // 3. Perform a highly accurate, case-insensitive regex match against the page text
      { $match: { pages: { $regex: regexStr, $options: 'i' } } },
      // 4. Group the matched page indices back into an array, adding 1 so they are 1-indexed (page 1, 2, etc)
      { $group: { _id: '$_id', matchedPages: { $push: { $add: ['$pageIndex', 1] } } } }
    ]);

    return { pages: result.length > 0 ? result[0].matchedPages : [] };
  }

  async update(id: string, dto: UpdateResourceDto): Promise<ResourceDocument> {
    const resource = await this.findByIdOrThrow(id);
    this.validateFilePath(dto.filePath);
    const previousPath = resource.filePath;
    const updatePayload: Partial<UpdateResourceDto> = { ...dto };
    const nextType = dto.type ?? resource.type;
    if (dto.filePath && !isDocumentType(nextType)) {
      throw new BadRequestException('Only document resources may have an uploaded file.');
    }
    delete updatePayload.fileName;
    delete updatePayload.fileSize;
    delete updatePayload.fileType;
    delete updatePayload.pages;
    delete updatePayload.extractedText;
    if (dto.filePath && dto.filePath !== previousPath) {
      const manifest = await this.manifests.get(dto.filePath);
      if (!manifest) throw new BadRequestException('Upload reference is expired or not owned by this server.');
      updatePayload.fileName = manifest.fileName;
      updatePayload.fileSize = manifest.fileSize;
      updatePayload.fileType = manifest.fileType;
      updatePayload.pages = manifest.pages;
      updatePayload.extractedText = manifest.extractedText;
    }
    Object.assign(resource, updatePayload);
    if (!isDocumentType(nextType) && !dto.filePath) {
      resource.filePath = undefined;
      resource.fileUrl = undefined;
      resource.fileName = undefined;
      resource.fileSize = undefined;
      resource.fileType = undefined;
      resource.pages = undefined;
      resource.extractedText = undefined;
    }
    resource.fileUrl = undefined;
    const saved = await resource.save();
    if (dto.filePath && dto.filePath !== previousPath) {
      try { await this.manifests.remove(dto.filePath); } catch (err) {
        this.logger.warn(`Failed to finalize upload manifest ${dto.filePath}: ${(err as Error).message}`, 'Resources');
      }
    }
    if (previousPath && previousPath !== resource.filePath) {
      try {
        await this.storage.remove(previousPath);
      } catch (err) {
        try { await this.cleanup.enqueue(previousPath); } catch { /* retry queue unavailable; retain warning */ }
        this.logger.warn(
          `Failed to remove replaced file ${previousPath}: ${(err as Error).message}`,
          'Resources',
        );
      }
    }
    return saved;
  }

  /** Persist reader position + derive status from progress. */
  async updateProgress(
    id: string,
    dto: UpdateProgressDto,
  ): Promise<{ id: string }> {
    const resource = await this.findByIdOrThrow(id);
    if (typeof dto.currentPage === 'number') {
      this.validatePage(resource, dto.currentPage);
      resource.currentPage = dto.currentPage;
    }
    if (typeof dto.readingProgress === 'number') {
      resource.readingProgress = dto.readingProgress;
    }

    if (resource.readingProgress >= 100) {
      resource.readingProgress = 100;
      resource.status = ResourceStatus.COMPLETED;
    } else if (
      resource.readingProgress > 0 &&
      resource.status === ResourceStatus.NOT_STARTED
    ) {
      resource.status = ResourceStatus.READING;
    }
    resource.lastReadAt = new Date();
    await resource.save();
    return { id: String(resource._id) };
  }

  async toggleFavorite(id: string): Promise<ResourceDocument> {
    const resource = await this.findByIdOrThrow(id);
    resource.favorite = !resource.favorite;
    return resource.save();
  }

  async addBookmark(id: string, dto: BookmarkDto): Promise<ResourceDocument> {
    const resource = await this.findByIdOrThrow(id);
    this.validatePage(resource, dto.page);
    const existing = resource.bookmarks.find((b) => b.page === dto.page);
    if (existing) {
      if (dto.note !== undefined) existing.note = dto.note;
    } else {
      resource.bookmarks.push({
        page: dto.page,
        note: dto.note,
        createdAt: new Date(),
      });
    }
    resource.bookmarks.sort((a, b) => a.page - b.page);
    return resource.save();
  }

  async removeBookmark(id: string, page: number): Promise<ResourceDocument> {
    const resource = await this.findByIdOrThrow(id);
    this.validatePage(resource, page);
    resource.bookmarks = resource.bookmarks.filter((b) => b.page !== page);
    return resource.save();
  }

  async addHighlight(
    id: string,
    dto: CreateHighlightDto,
  ): Promise<ResourceDocument> {
    const resource = await this.findByIdOrThrow(id);
    this.validatePage(resource, dto.page);
    resource.highlights.push({
      page: dto.page,
      rects: dto.rects,
      color: dto.color ?? '#3cffd0',
      note: dto.note,
      text: dto.text,
      createdAt: new Date(),
    });
    return resource.save();
  }

  async updateHighlight(
    id: string,
    highlightId: string,
    dto: UpdateHighlightDto,
  ): Promise<ResourceDocument> {
    const resource = await this.findByIdOrThrow(id);
    const arr = resource.highlights as unknown as Types.DocumentArray<
      (typeof resource.highlights)[number] & { _id: Types.ObjectId }
    >;
    const highlight = arr.id(highlightId);
    if (!highlight) {
      throw new NotFoundException(`Highlight "${highlightId}" not found.`);
    }
    if (dto.color !== undefined) highlight.color = dto.color;
    if (dto.note !== undefined) highlight.note = dto.note;
    return resource.save();
  }

  async removeHighlight(
    id: string,
    highlightId: string,
  ): Promise<ResourceDocument> {
    const resource = await this.findByIdOrThrow(id);
    const arr = resource.highlights as unknown as Types.DocumentArray<
      (typeof resource.highlights)[number] & { _id: Types.ObjectId }
    >;
    const existing = arr.id(highlightId);
    if (!existing) {
      throw new NotFoundException(`Highlight "${highlightId}" not found.`);
    }
    arr.pull(highlightId);
    return resource.save();
  }

  async remove(id: string): Promise<{ deleted: true }> {
    const resource = await this.findByIdOrThrow(id);
    // Commit the authoritative MongoDB deletion first. Storage cleanup is
    // deliberately best-effort; a failed object deletion can be retried by a
    // cleanup worker, while deleting storage first could lose the only DB
    // reference when Mongo is temporarily unavailable.
    await resource.deleteOne();
    if (resource.filePath) {
      try {
        await this.storage.remove(resource.filePath);
      } catch (err) {
        try { await this.cleanup.enqueue(resource.filePath); } catch { /* retry queue unavailable; retain warning */ }
        this.logger.warn(
          `Failed to remove file ${resource.filePath}: ${(err as Error).message}`,
          'Resources',
        );
      }
    }
    try {
      await this.events.emitAsync('resource.deleted', id);
    } catch (err) {
      // The resource is already deleted; log cascade failures for retry/repair
      // instead of turning a successful delete into a misleading 500 response.
      this.logger.error(
        `Resource ${id} deleted but dependent cleanup failed: ${(err as Error).message}`,
        'Resources',
      );
    }
    this.logger.log(`Deleted resource ${id}`, 'Resources');
    return { deleted: true };
  }

  /** Aggregate counts for the home dashboard. */
  async stats(): Promise<ResourceStats> {
    const [total, reading, completed, favorites, pdfs] = await Promise.all([
      this.resourceModel.countDocuments(),
      this.resourceModel.countDocuments({ status: ResourceStatus.READING }),
      this.resourceModel.countDocuments({ status: ResourceStatus.COMPLETED }),
      this.resourceModel.countDocuments({ favorite: true }),
      this.resourceModel.countDocuments({ type: { $in: [...DOCUMENT_TYPES] } }),
    ]);
    return { total, reading, completed, favorites, pdfs };
  }

  /** The most recently read resource with progress — powers "Continue Reading". */
  async currentReading(): Promise<ResourceDocument | null> {
    return this.resourceModel
      .findOne({ readingProgress: { $gt: 0 } })
      .sort({ lastReadAt: -1 })
      .exec();
  }

  // --------------------------- helpers ---------------------------

  async findByIdOrThrow(id: string): Promise<ResourceDocument> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException(`Resource "${id}" not found.`);
    const doc = await this.resourceModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`Resource "${id}" not found.`);
    return doc;
  }

  private buildFilter(query: QueryResourceDto): FilterQuery<ResourceDocument> {
    const filter: FilterQuery<ResourceDocument> = {};
    if (query.search) {
      filter.$text = { $search: query.search.replace(/"/g, ' ').trim() };
    }
    if (query.type) filter.type = query.type;
    if (query.priority) filter.priority = query.priority;
    if (query.status) filter.status = query.status;
    const fav = toBoolean(query.favorite);
    if (fav !== undefined) filter.favorite = fav;
    const tags = toArray(query.tags);
    if (tags && tags.length) filter.tags = { $in: tags };
    return filter;
  }

  private validateFilePath(filePath?: string): void {
    if (filePath && !this.storage.isSafeStoragePath(filePath)) {
      throw new BadRequestException('Invalid uploaded file reference.');
    }
  }

  private validatePage(resource: ResourceDocument, page: number): void {
    if (!Number.isInteger(page) || page < 1 || (resource.pages && page > resource.pages)) {
      throw new BadRequestException(`Page must be between 1 and ${resource.pages}.`);
    }
  }

  private buildSort(
    sort?: ResourceSort,
    hasSearch = false,
  ): Record<string, 1 | -1> {
    if (hasSearch && !sort) {
      return { score: { $meta: 'textScore' } } as unknown as Record<
        string,
        1 | -1
      >;
    }
    switch (sort) {
      case ResourceSort.OLDEST:
        return { createdAt: 1 };
      case ResourceSort.RECENTLY_READ:
        return { lastReadAt: -1, updatedAt: -1 };
      case ResourceSort.ALPHABETICAL:
        return { title: 1 };
      case ResourceSort.NEWEST:
      default:
        return { createdAt: -1 };
    }
  }

}
