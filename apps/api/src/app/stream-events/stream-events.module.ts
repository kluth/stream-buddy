import { Module } from '@nestjs/common';
import { StreamEventsGateway } from './stream-events.gateway';

@Module({
  providers: [StreamEventsGateway],
  exports: [StreamEventsGateway], // Export if other modules need to inject/use it
})
export class StreamEventsModule {}
