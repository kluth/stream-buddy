import { Controller, Get, Post, Body, Query, Logger } from '@nestjs/common';
import { StreamAnalyticsService, StreamHealthMetrics } from './stream-analytics.service';

@Controller('analytics')
export class StreamAnalyticsController {
  private readonly logger = new Logger(StreamAnalyticsController.name);

  constructor(private readonly analyticsService: StreamAnalyticsService) {}

  @Get('metrics')
  async getMetrics(
    @Query('internalUserId') internalUserId: string,
    @Query('platforms') platforms: string,
  ) {
    this.logger.log(`Getting metrics for user: ${internalUserId}`);
    const platformList = platforms ? platforms.split(',') : ['twitch', 'youtube'];
    return await this.analyticsService.collectMetrics(internalUserId, platformList);
  }

  @Get('health')
  getStreamHealth(@Query('internalUserId') internalUserId: string) {
    return this.analyticsService.getStreamHealth(internalUserId);
  }

  @Post('health/update')
  async updateStreamHealth(
    @Body('internalUserId') internalUserId: string,
    @Body('health') health: Partial<StreamHealthMetrics>,
  ) {
    await this.analyticsService.updateStreamHealth(internalUserId, health);
    return { success: true };
  }

  @Get('history')
  getHistoricalMetrics(
    @Query('internalUserId') internalUserId: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const timeRange = start && end
      ? { start: new Date(start), end: new Date(end) }
      : undefined;

    return this.analyticsService.getHistoricalMetrics(internalUserId, timeRange);
  }
}
