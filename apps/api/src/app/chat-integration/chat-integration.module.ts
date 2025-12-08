import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ChatIntegrationService } from './chat-integration.service';
import { ChatIntegrationController } from './chat-integration.controller';
import { ChatIntegrationGateway } from './chat-integration.gateway';
import { TwitchAuthModule } from '../twitch-auth/twitch-auth.module';
import { YoutubeAuthModule } from '../youtube-auth/youtube-auth.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    TwitchAuthModule,
    YoutubeAuthModule,
  ],
  controllers: [ChatIntegrationController],
  providers: [ChatIntegrationService, ChatIntegrationGateway],
  exports: [ChatIntegrationService],
})
export class ChatIntegrationModule {}
