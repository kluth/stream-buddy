import { Module } from '@nestjs/common';
import { OverlayRenderController } from './overlay-render.controller';
import { OverlayRenderService } from './overlay-render.service';

@Module({
  controllers: [OverlayRenderController],
  providers: [OverlayRenderService]
})
export class OverlayRenderModule {}
