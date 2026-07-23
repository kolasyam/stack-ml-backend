import { Injectable } from '@nestjs/common';
import { ResourceSort } from '../../common/constants/enums';
import { ResourcesService, ResourceStats } from '../resources/resources.service';
import { TodosService, TodoSummary } from '../todos/todos.service';
import { TodoSort } from '../todos/dto/query-todo.dto';
import { NotesService, NoteSummary } from '../notes/notes.service';
import { NoteSort } from '../notes/dto/query-note.dto';

export interface DashboardData {
  resources: ResourceStats;
  todos: TodoSummary;
  notes: NoteSummary;
  currentReading: unknown | null;
  recentResources: unknown[];
  recentTodos: unknown[];
  recentNotes: unknown[];
}

/**
 * Home dashboard aggregation. Reuses the feature services' `stats`/`summary`
 * methods plus lightweight "recent" lists so the dashboard is a single call.
 */
@Injectable()
export class StatsService {
  constructor(
    private readonly resources: ResourcesService,
    private readonly todos: TodosService,
    private readonly notes: NotesService,
  ) {}

  async dashboard(): Promise<DashboardData> {
    const [resources, currentReading, recentUploads, todos, recentTodos, notes, recentNotes] =
      await Promise.all([
        this.resources.stats(),
        this.resources.currentReading(),
        this.resources.findAll({ limit: 5, sort: ResourceSort.NEWEST }),
        this.todos.summary(),
        this.todos.findAll({ limit: 5, sort: TodoSort.NEWEST }),
        this.notes.summary(),
        this.notes.findAll({ limit: 5, sort: NoteSort.NEWEST }),
      ]);

    return {
      resources,
      todos,
      notes,
      currentReading,
      recentResources: recentUploads.items,
      recentTodos: recentTodos.items,
      recentNotes: recentNotes.items,
    };
  }
}
