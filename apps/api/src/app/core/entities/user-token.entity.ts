import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index } from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('user_tokens')
@Index(['platform', 'platformUserId'], { unique: true })
export class UserTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  platform: string; // e.g., 'twitch', 'youtube'

  @Column({ type: 'varchar' })
  platformUserId: string;

  @Column({ type: 'varchar' })
  accessToken: string;

  @Column({ type: 'varchar', nullable: true })
  refreshToken: string; // Encrypted

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Column({ type: 'simple-json', nullable: true })
  scopes: string[];

  @ManyToOne(() => UserEntity, user => user.tokens, { onDelete: 'CASCADE' })
  user: UserEntity;

  @Column({ type: 'varchar' })
  internalUserId: string; // Redundant but useful for direct queries
}
