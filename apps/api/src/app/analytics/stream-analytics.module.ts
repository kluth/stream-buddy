import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StreamAnalyticsService } from './stream-analytics.service';
import { StreamAnalyticsController } from './stream-analytics.controller';
import { UserTokenEntity } from '../core/entities/user-token.entity';
import { TwitchAuthModule } from '../twitch-auth/twitch-auth.module';
import { YoutubeAuthModule } from '../youtube-auth/youtube-auth.module';
import { StreamEventsModule } from '../stream-events/stream-events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserTokenEntity]),
    TwitchAuthModule,
    YoutubeAuthModule,
    StreamEventsModule,
  ],
  controllers: [StreamAnalyticsController],
  providers: [StreamAnalyticsService],
  exports: [StreamAnalyticsService],
})
export class StreamAnalyticsModule {}
