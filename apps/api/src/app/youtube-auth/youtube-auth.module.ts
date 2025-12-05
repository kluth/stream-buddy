import { Module } from '@nestjs/common';
import { YoutubeAuthService } from './youtube-auth.service';

@Module({
  providers: [YoutubeAuthService],
  exports: [YoutubeAuthService],
})
export class YoutubeAuthModule {}
