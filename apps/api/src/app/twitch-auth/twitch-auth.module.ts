import { Module } from '@nestjs/common';
import { TwitchAuthService } from './twitch-auth.service';

@Module({
  providers: [TwitchAuthService],
  exports: [TwitchAuthService],
})
export class TwitchAuthModule {}
