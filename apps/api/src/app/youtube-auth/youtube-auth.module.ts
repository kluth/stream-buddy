import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserTokenEntity } from '../core/entities/user-token.entity';
import { YoutubeAuthService } from './youtube-auth.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserTokenEntity])],
  providers: [YoutubeAuthService, Logger],
  exports: [YoutubeAuthService],
})
export class YoutubeAuthModule {}
