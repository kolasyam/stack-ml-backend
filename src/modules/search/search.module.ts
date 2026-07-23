import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Resource, ResourceSchema } from '../resources/schemas/resource.schema';
import { Todo, TodoSchema } from '../todos/schemas/todo.schema';
import { Note, NoteSchema } from '../notes/schemas/note.schema';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Resource.name, schema: ResourceSchema },
      { name: Todo.name, schema: TodoSchema },
      { name: Note.name, schema: NoteSchema },
    ]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
