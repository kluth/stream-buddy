import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserTokenEntity } from '../core/entities/user-token.entity';
import { TwitchAuthService } from './twitch-auth.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserTokenEntity])],
  providers: [TwitchAuthService, Logger],
  exports: [TwitchAuthService],
})
export class TwitchAuthModule {}
