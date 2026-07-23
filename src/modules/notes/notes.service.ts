import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { AppLogger } from '../../common/logger/logger.service';
import { Paginated, paginate } from '../../common/dto/response.dto';
import {
  PRIORITY_RANK,
  NoteStatus,
  NotePriority,
} from '../../common/constants/enums';
import { Note, NoteDocument } from './schemas/note.schema';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { QueryNoteDto, NoteSort } from './dto/query-note.dto';

export interface NoteSummary {
  total: number;
  completed: number;
  inProgress: number;
  blocked: number;
  notStarted: number;
  critical: number;
  remaining: number;
}

/**
 * Company task notes — CRUD + dashboard aggregation. No resource linkage and
 * no auth (personal use). Search uses the text index on task name / description
 * / project.
 */
@Injectable()
export class NotesService {
  constructor(
    @InjectModel(Note.name) private readonly noteModel: Model<NoteDocument>,
    private readonly logger: AppLogger,
  ) {}

  async create(dto: CreateNoteDto): Promise<NoteDocument> {
    const doc = new this.noteModel(dto);
    return doc.save();
  }

  async findAll(query: QueryNoteDto): Promise<Paginated<NoteDocument>> {
    const filter = this.buildFilter(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const total = await this.noteModel.countDocuments(filter);

    if (query.sort === NoteSort.PRIORITY) {
      const all = await this.noteModel.find(filter).exec();
      const sorted = [...all].sort(
        (a, b) =>
          (PRIORITY_RANK[b.priority ?? 'Low'] ?? 1) -
          (PRIORITY_RANK[a.priority ?? 'Low'] ?? 1),
      );
      const start = (page - 1) * limit;
      return paginate(sorted.slice(start, start + limit), total, page, limit);
    }

    const sort = this.buildSort(query.sort);
    const items = await this.noteModel
      .find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();
    return paginate(items, total, page, limit);
  }

  async findOne(id: string): Promise<NoteDocument> {
    return this.findByIdOrThrow(id);
  }

  async update(id: string, dto: UpdateNoteDto): Promise<NoteDocument> {
    const note = await this.findByIdOrThrow(id);
    Object.assign(note, dto);
    return note.save();
  }

  async remove(id: string): Promise<{ deleted: true }> {
    const note = await this.findByIdOrThrow(id);
    await note.deleteOne();
    return { deleted: true };
  }

  /** Dashboard counts for the Notes tab. */
  async summary(): Promise<NoteSummary> {
    const agg = await this.noteModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const row of agg) {
      byStatus[row._id] = row.count;
      total += row.count;
    }
    const completed = byStatus[NoteStatus.COMPLETED] ?? 0;
    const inProgress = byStatus[NoteStatus.IN_PROGRESS] ?? 0;
    const blocked = byStatus[NoteStatus.BLOCKED] ?? 0;
    const notStarted = byStatus[NoteStatus.NOT_STARTED] ?? 0;

    const critical = await this.noteModel.countDocuments({
      priority: NotePriority.CRITICAL,
    });
    const remaining = total - completed;

    return {
      total,
      completed,
      inProgress,
      blocked,
      notStarted,
      critical,
      remaining,
    };
  }

  // --------------------------- helpers ---------------------------

  async findByIdOrThrow(id: string): Promise<NoteDocument> {
    let doc: NoteDocument | null;
    try {
      doc = await this.noteModel.findById(id).exec();
    } catch {
      throw new NotFoundException(`Note "${id}" not found.`);
    }
    if (!doc) throw new NotFoundException(`Note "${id}" not found.`);
    return doc;
  }

  private buildFilter(query: QueryNoteDto): FilterQuery<NoteDocument> {
    const filter: FilterQuery<NoteDocument> = {};
    if (query.search) {
      filter.$text = { $search: query.search };
    }
    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.projectName) filter.projectName = query.projectName;
    return filter;
  }

  private buildSort(sort?: NoteSort): Record<string, 1 | -1> {
    switch (sort) {
      case NoteSort.OLDEST:
        return { createdAt: 1 };
      case NoteSort.PROJECT:
        return { projectName: 1, createdAt: -1 };
      case NoteSort.NEWEST:
      default:
        return { createdAt: -1 };
    }
  }
}
