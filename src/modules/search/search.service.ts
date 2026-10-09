import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Resource, ResourceDocument } from '../resources/schemas/resource.schema';
import { Todo, TodoDocument } from '../todos/schemas/todo.schema';
import { Note, NoteDocument } from '../notes/schemas/note.schema';
import { escapeRegex } from '../../common/dto/pagination.dto';

export interface SearchResult {
  query: string;
  resources: ResourceDocument[];
  todos: TodoDocument[];
  notes: NoteDocument[];
  counts: { resources: number; todos: number; notes: number };
}

/**
 * Global instant search across all three domains.
 *
 * - Resources + Notes use the MongoDB text index (covers title / description /
 *   tags / file name / extracted PDF-DOC text).
 * - Todos search on title/description via regex (small collection, no text
 *   index needed) and return a light resource snapshot for context.
 */
@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Resource.name)
    private readonly resourceModel: Model<ResourceDocument>,
    @InjectModel(Todo.name) private readonly todoModel: Model<TodoDocument>,
    @InjectModel(Note.name) private readonly noteModel: Model<NoteDocument>,
  ) {}

  async search(q: string, limit = 8): Promise<SearchResult> {
    const term = (q ?? '').trim();
    if (!term) {
      return {
        query: '',
        resources: [],
        todos: [],
        notes: [],
        counts: { resources: 0, todos: 0, notes: 0 },
      };
    }

    try {
      // 1. Attempt advanced Atlas Search ($search) with fuzzy matching and highlighting
      const [resources, todos, notes] = await Promise.all([
        this.resourceModel.aggregate([
          {
            $search: {
              index: 'default',
              text: { query: term, path: { wildcard: '*' } as any, fuzzy: { maxEdits: 1 } },
              highlight: { path: { wildcard: '*' } as any }
            }
          },
          { $limit: limit },
          { $addFields: { score: { $meta: 'searchScore' }, highlights: { $meta: 'searchHighlights' } } },
          { $project: { extractedText: 0 } }
        ]).exec(),
        this.todoModel.aggregate([
          {
            $search: {
              index: 'default',
              text: { query: term, path: { wildcard: '*' } as any, fuzzy: { maxEdits: 1 } },
              highlight: { path: { wildcard: '*' } as any }
            }
          },
          { $limit: limit },
          { $addFields: { score: { $meta: 'searchScore' }, highlights: { $meta: 'searchHighlights' } } }
        ]).exec(),
        this.noteModel.aggregate([
          {
            $search: {
              index: 'default',
              text: { query: term, path: { wildcard: '*' } as any, fuzzy: { maxEdits: 1 } },
              highlight: { path: { wildcard: '*' } as any }
            }
          },
          { $limit: limit },
          { $addFields: { score: { $meta: 'searchScore' }, highlights: { $meta: 'searchHighlights' } } }
        ]).exec(),
      ]);

      await this.todoModel.populate(todos, { path: 'resourceId', select: 'title type' });

      return {
        query: term,
        resources,
        todos,
        notes,
        counts: { resources: resources.length, todos: todos.length, notes: notes.length },
      };
    } catch (err) {
      // 2. Fallback to legacy $text / $regex search if Atlas Search indexes are not configured
      const escapedTerm = escapeRegex(term);
      const [resources, todos, notes] = await Promise.all([
        this.resourceModel.find({ $text: { $search: term } }).limit(limit).exec(),
        this.todoModel
          .find({
            $or: [
              { title: { $regex: escapedTerm, $options: 'i' } },
              { description: { $regex: escapedTerm, $options: 'i' } },
            ],
          })
          .limit(limit)
          .populate('resourceId', 'title type')
          .exec(),
        this.noteModel.find({ $text: { $search: term } }).limit(limit).exec(),
      ]);

      return {
        query: term,
        resources,
        todos,
        notes,
        counts: { resources: resources.length, todos: todos.length, notes: notes.length },
      };
    }
  }
}
