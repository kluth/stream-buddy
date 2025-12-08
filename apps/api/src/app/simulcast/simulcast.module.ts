import { Module } from '@nestjs/common';
import { SimulcastController } from './simulcast.controller';
import { SimulcastService } from './simulcast.service';
import { ConfigModule } from '@nestjs/config';
import { TwitchAuthModule } from '../twitch-auth/twitch-auth.module';
import { YoutubeAuthModule } from '../youtube-auth/youtube-auth.module';

@Module({
  imports: [ConfigModule, TwitchAuthModule, YoutubeAuthModule],
  controllers: [SimulcastController],
  providers: [SimulcastService],
  exports: [SimulcastService],
})
export class SimulcastModule {}
