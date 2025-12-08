import { Controller, Get, Post, Body, Query, Param, Logger } from '@nestjs/common';
import { AIHighlightsService, HighlightDetectionConfig } from './ai-highlights.service';

@Controller('ai-highlights')
export class AIHighlightsController {
  private readonly logger = new Logger(AIHighlightsController.name);

  constructor(private readonly aiHighlightsService: AIHighlightsService) {}

  @Post('start')
  async startDetection(
    @Body('internalUserId') internalUserId: string,
    @Body('streamUrl') streamUrl: string,
    @Body('config') config?: Partial<HighlightDetectionConfig>,
  ) {
    this.logger.log(`Starting highlight detection for user: ${internalUserId}`);
    await this.aiHighlightsService.startHighlightDetection(internalUserId, streamUrl, config);
    return { success: true, message: 'Highlight detection started' };
  }

  @Post('stop')
  stopDetection(@Body('internalUserId') internalUserId: string) {
    this.logger.log(`Stopping highlight detection for user: ${internalUserId}`);
    this.aiHighlightsService.stopHighlightDetection(internalUserId);
    return { success: true, message: 'Highlight detection stopped' };
  }

  @Get('list')
  getHighlights(
    @Query('internalUserId') internalUserId: string,
    @Query('minConfidence') minConfidence?: number,
  ) {
    return this.aiHighlightsService.getHighlights(
      internalUserId,
      minConfidence ? parseFloat(minConfidence.toString()) : undefined
    );
  }

  @Post('manual')
  addManualHighlight(
    @Body('internalUserId') internalUserId: string,
    @Body('timestamp') timestamp: number,
    @Body('duration') duration: number,
    @Body('description') description: string,
  ) {
    const highlight = this.aiHighlightsService.addManualHighlight(
      internalUserId,
      timestamp,
      duration,
      description,
    );
    return { success: true, highlight };
  }

  @Post('create-clip')
  async createClip(
    @Body('internalUserId') internalUserId: string,
    @Body('highlightId') highlightId: string,
    @Body('sourceVideoPath') sourceVideoPath: string,
  ) {
    const clipPath = await this.aiHighlightsService.createClipFromHighlight(
      internalUserId,
      highlightId,
      sourceVideoPath,
    );

    if (clipPath) {
      return { success: true, clipPath };
    } else {
      return { success: false, message: 'Failed to create clip' };
    }
  }

  @Post('analyze-chat')
  async analyzeChat(
    @Body('internalUserId') internalUserId: string,
    @Body('messages') messages: Array<{ timestamp: number; user: string; message: string }>,
  ) {
    await this.aiHighlightsService.analyzeChatActivity(internalUserId, messages);
    return { success: true, message: 'Chat analyzed' };
  }

  @Post('clear')
  clearHighlights(@Body('internalUserId') internalUserId: string) {
    this.aiHighlightsService.clearHighlights(internalUserId);
    return { success: true, message: 'Highlights cleared' };
  }
}
