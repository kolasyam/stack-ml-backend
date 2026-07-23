import { Module } from '@nestjs/common';
import { ResourcesModule } from '../resources/resources.module';
import { TodosModule } from '../todos/todos.module';
import { NotesModule } from '../notes/notes.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [ResourcesModule, TodosModule, NotesModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
