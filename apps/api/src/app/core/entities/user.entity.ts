import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { UserTokenEntity } from './user-token.entity';
import { OverlayConfigEntity } from './overlay-config.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  internalUserId: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  username: string;

  @OneToMany(() => UserTokenEntity, token => token.user)
  tokens: UserTokenEntity[];

  @OneToMany(() => OverlayConfigEntity, overlay => overlay.user)
  overlays: OverlayConfigEntity[];
}
