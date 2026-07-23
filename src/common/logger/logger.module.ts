import { Global, Module } from '@nestjs/common';
import { AppLogger } from './logger.service';

/**
 * Global logger module. Exports `AppLogger` for the whole app so every module
 * can inject it without re-importing.
 */
@Global()
@Module({
  providers: [AppLogger],
  exports: [AppLogger],
})
export class LoggerModule {}
