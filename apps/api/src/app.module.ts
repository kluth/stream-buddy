import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app/app.controller';
import { AppService } from './app/app.service';
import { ChatIntegrationModule } from './app/chat-integration/chat-integration.module';
import { TwitchAuthModule } from './app/twitch-auth/twitch-auth.module';
import { YoutubeAuthModule } from './app/youtube-auth/youtube-auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ChatIntegrationModule,
    TwitchAuthModule,
    YoutubeAuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
