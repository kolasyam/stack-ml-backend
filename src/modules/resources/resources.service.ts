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
  PRIORITY_RANK,
  ResourceSort,
  ResourceStatus,
} from '../../common/constants/enums';
import { SupabaseStorageService } from '../uploads/supabase-storage.service';
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
    private readonly events: EventEmitter2,
    private readonly logger: AppLogger,
  ) {}

  async create(dto: CreateResourceDto): Promise<ResourceDocument> {
    const payload: Partial<CreateResourceDto> = { ...dto };
    if (payload.filePath && !payload.fileUrl) {
      try {
        payload.fileUrl = await this.storage.createSignedUrl(payload.filePath);
      } catch (err) {
        this.logger.warn(
          `Could not sign uploaded file ${payload.filePath}: ${(err as Error).message}`,
          'Resources',
        );
      }
    }
    const doc = new this.resourceModel(payload);
    return doc.save();
  }

  async findAll(query: QueryResourceDto): Promise<Paginated<ResourceDocument>> {
    const filter = this.buildFilter(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const total = await this.resourceModel.countDocuments(filter);

    // Priority / progress sorting is computed in-memory: ideal for a personal
    // library (hundreds of docs) and keeps DB pagination correct without a
    // fragile aggregation. Everything else sorts in the DB.
    if (
      query.sort === ResourceSort.PRIORITY ||
      query.sort === ResourceSort.PROGRESS
    ) {
      const all = await this.resourceModel.find(filter).exec();
      const sorted = this.sortInMemory(all, query.sort);
      const start = (page - 1) * limit;
      const items = sorted.slice(start, start + limit);
      return paginate(items, total, page, limit);
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
  async getFileUrl(id: string): Promise<{ url: string }> {
    const resource = await this.findByIdOrThrow(id);
    if (!resource.filePath) {
      throw new BadRequestException('This resource has no attached file.');
    }
    const url = await this.storage.createSignedUrl(resource.filePath);
    return { url };
  }

  async update(id: string, dto: UpdateResourceDto): Promise<ResourceDocument> {
    const resource = await this.findByIdOrThrow(id);
    Object.assign(resource, dto);
    return resource.save();
  }

  /** Persist reader position + derive status from progress. */
  async updateProgress(
    id: string,
    dto: UpdateProgressDto,
  ): Promise<ResourceDocument> {
    const resource = await this.findByIdOrThrow(id);
    if (typeof dto.currentPage === 'number') resource.currentPage = dto.currentPage;
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
    return resource.save();
  }

  async toggleFavorite(id: string): Promise<ResourceDocument> {
    const resource = await this.findByIdOrThrow(id);
    resource.favorite = !resource.favorite;
    return resource.save();
  }

  async addBookmark(id: string, dto: BookmarkDto): Promise<ResourceDocument> {
    const resource = await this.findByIdOrThrow(id);
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
    resource.bookmarks = resource.bookmarks.filter((b) => b.page !== page);
    return resource.save();
  }

  async addHighlight(
    id: string,
    dto: CreateHighlightDto,
  ): Promise<ResourceDocument> {
    const resource = await this.findByIdOrThrow(id);
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
    if (resource.filePath) {
      try {
        await this.storage.remove(resource.filePath);
      } catch (err) {
        this.logger.warn(
          `Failed to remove file ${resource.filePath}: ${(err as Error).message}`,
          'Resources',
        );
      }
    }
    await resource.deleteOne();
    this.events.emit('resource.deleted', id);
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
    let doc: ResourceDocument | null;
    try {
      doc = await this.resourceModel.findById(id).exec();
    } catch {
      throw new NotFoundException(`Resource "${id}" not found.`);
    }
    if (!doc) throw new NotFoundException(`Resource "${id}" not found.`);
    return doc;
  }

  private buildFilter(query: QueryResourceDto): FilterQuery<ResourceDocument> {
    const filter: FilterQuery<ResourceDocument> = {};
    if (query.search) {
      filter.$text = { $search: query.search };
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

  private sortInMemory(
    docs: ResourceDocument[],
    sort: ResourceSort,
  ): ResourceDocument[] {
    const arr = [...docs];
    if (sort === ResourceSort.PRIORITY) {
      arr.sort((a, b) => {
        const ra = PRIORITY_RANK[a.priority ?? 'Low'] ?? 1;
        const rb = PRIORITY_RANK[b.priority ?? 'Low'] ?? 1;
        if (rb !== ra) return rb - ra;
        return (
          (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
        );
      });
    } else if (sort === ResourceSort.PROGRESS) {
      arr.sort((a, b) => {
        if (b.readingProgress !== a.readingProgress) {
          return b.readingProgress - a.readingProgress;
        }
        return (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0);
      });
    }
    return arr;
  }
}
