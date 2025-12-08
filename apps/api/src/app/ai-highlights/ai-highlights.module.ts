import { Module } from '@nestjs/common';
import { AIHighlightsService } from './ai-highlights.service';
import { AIHighlightsController } from './ai-highlights.controller';

@Module({
  controllers: [AIHighlightsController],
  providers: [AIHighlightsService],
  exports: [AIHighlightsService],
})
export class AIHighlightsModule {}
