import { Module } from '@nestjs/common';
import { SimulcastController } from './simulcast.controller';
import { SimulcastService } from './simulcast.service';

@Module({
  controllers: [SimulcastController],
  providers: [SimulcastService]
})
export class SimulcastModule {}
