import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { OnEvent } from '@nestjs/event-emitter';
import { FilterQuery, Model, Types } from 'mongoose';
import { AppLogger } from '../../common/logger/logger.service';
import { Paginated, paginate } from '../../common/dto/response.dto';
import { escapeRegex } from '../../common/dto/pagination.dto';
import { TodoStatus } from '../../common/constants/enums';
import { ResourcesService } from '../resources/resources.service';
import { Todo, TodoDocument } from './schemas/todo.schema';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { QueryTodoDto, TodoSort } from './dto/query-todo.dto';

export interface TodoSummary {
  total: number;
  completed: number;
  reading: number;
  studying: number;
  notStarted: number;
  remaining: number;
  completionPct: number;
  upcoming: number;
  recentlyAdded: number;
}

/**
 * Todo domain logic. Each todo MUST reference an existing Resource; the link is
 * validated on create/update. List queries populate a light resource snapshot.
 * Listens for `resource.deleted` to cascade-remove linked study todos.
 */
@Injectable()
export class TodosService {
  constructor(
    @InjectModel(Todo.name) private readonly todoModel: Model<TodoDocument>,
    private readonly resources: ResourcesService,
    private readonly logger: AppLogger,
  ) {}

  async create(dto: CreateTodoDto): Promise<TodoDocument> {
    await this.resources.findByIdOrThrow(dto.resourceId);
    const doc = new this.todoModel(dto);
    return doc.save();
  }

  async findAll(query: QueryTodoDto): Promise<Paginated<TodoDocument>> {
    const filter = this.buildFilter(query);

    // "Upcoming" restricts to items still due (and not done) and orders by due date.
    if (query.sort === TodoSort.UPCOMING) {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      filter.dueDate = { $gte: startOfToday };
      filter.status = { $ne: TodoStatus.COMPLETED };
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const total = await this.todoModel.countDocuments(filter);

    if (query.sort === TodoSort.PRIORITY) {
      const raw = await this.todoModel.aggregate([
        { $match: filter },
        { $addFields: { __priorityRank: { $switch: { branches: [
          { case: { $eq: ['$priority', 'Critical'] }, then: 4 },
          { case: { $eq: ['$priority', 'High'] }, then: 3 },
          { case: { $eq: ['$priority', 'Medium'] }, then: 2 },
          { case: { $eq: ['$priority', 'Low'] }, then: 1 },
        ], default: 0 } } } },
        { $sort: { __priorityRank: -1, createdAt: -1 } },
        { $skip: (page - 1) * limit }, { $limit: limit },
        { $project: { __priorityRank: 0 } },
      ]).exec();
      const items = raw.map((item) => this.todoModel.hydrate(item));
      await this.todoModel.populate(items, { path: 'resourceId', select: 'title type status filePath currentPage' });
      return paginate(items, total, page, limit);
    }

    const sort = this.buildSort(query.sort);
    const items = await this.todoModel
      .find(filter)
      .populate('resourceId', 'title type status filePath currentPage')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();
    return paginate(items, total, page, limit);
  }

  async findOne(id: string): Promise<TodoDocument> {
    return this.findByIdOrThrow(id);
  }

  async update(id: string, dto: UpdateTodoDto): Promise<TodoDocument> {
    const todo = await this.findByIdOrThrow(id);
    if (dto.resourceId && dto.resourceId !== String(todo.resourceId)) {
      await this.resources.findByIdOrThrow(dto.resourceId);
    }
    Object.assign(todo, dto);
    if (todo.status === TodoStatus.COMPLETED && !todo.completedAt) {
      todo.completedAt = new Date();
    } else if (todo.status !== TodoStatus.COMPLETED) {
      todo.completedAt = undefined;
    }
    return todo.save();
  }

  async markComplete(id: string): Promise<TodoDocument> {
    const todo = await this.findByIdOrThrow(id);
    todo.status = TodoStatus.COMPLETED;
    todo.completedAt = new Date();
    return todo.save();
  }

  async start(id: string): Promise<TodoDocument> {
    const todo = await this.findByIdOrThrow(id);
    todo.status = TodoStatus.STUDYING;
    todo.completedAt = undefined;
    return todo.save();
  }

  async remove(id: string): Promise<{ deleted: true }> {
    const todo = await this.findByIdOrThrow(id);
    await todo.deleteOne();
    return { deleted: true };
  }

  /** Aggregated counts for the Todo dashboard. */
  async summary(): Promise<TodoSummary> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const agg = await this.todoModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const row of agg) {
      byStatus[row._id] = row.count;
      total += row.count;
    }
    const completed = byStatus[TodoStatus.COMPLETED] ?? 0;
    const reading = byStatus[TodoStatus.READING] ?? 0;
    const studying = byStatus[TodoStatus.STUDYING] ?? 0;
    const notStarted = byStatus[TodoStatus.NOT_STARTED] ?? 0;
    const remaining = total - completed;
    const completionPct = total ? Math.round((completed / total) * 100) : 0;

    const [upcoming, recentlyAdded] = await Promise.all([
      this.todoModel.countDocuments({
        dueDate: { $gte: startOfToday },
        status: { $ne: TodoStatus.COMPLETED },
      }),
      this.todoModel.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    return {
      total,
      completed,
      reading,
      studying,
      notStarted,
      remaining,
      completionPct,
      upcoming,
      recentlyAdded,
    };
  }

  @OnEvent('resource.deleted')
  async handleResourceDeleted(resourceId: string): Promise<void> {
    if (!Types.ObjectId.isValid(resourceId)) return;
    // Match both the canonical ObjectId form and any legacy string-typed value
    // so cascade cleanup is robust across schema history.
    const res = await this.todoModel
      .deleteMany({
        $or: [
          { resourceId: new Types.ObjectId(resourceId) },
          { resourceId: resourceId as unknown as Types.ObjectId },
        ],
      })
      .exec();
    this.logger.log(
      `Cascade-deleted ${res.deletedCount} todos for resource ${resourceId}`,
      'Todos',
    );
  }

  // --------------------------- helpers ---------------------------

  async findByIdOrThrow(id: string): Promise<TodoDocument> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException(`Todo "${id}" not found.`);
    const doc = await this.todoModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`Todo "${id}" not found.`);
    return doc;
  }

  private buildFilter(query: QueryTodoDto): FilterQuery<TodoDocument> {
    const filter: FilterQuery<TodoDocument> = {};
    if (query.search) {
      filter.$or = [
        { title: { $regex: escapeRegex(query.search), $options: 'i' } },
        { description: { $regex: escapeRegex(query.search), $options: 'i' } },
      ];
    }
    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.resourceId) {
      filter.resourceId = new Types.ObjectId(query.resourceId);
    }
    return filter;
  }

  private buildSort(sort?: TodoSort): Record<string, 1 | -1> {
    switch (sort) {
      case TodoSort.OLDEST:
        return { createdAt: 1 };
      case TodoSort.UPCOMING:
      case TodoSort.DUE_DATE:
        return { dueDate: 1, createdAt: -1 };
      case TodoSort.NEWEST:
      default:
        return { createdAt: -1 };
    }
  }
}
