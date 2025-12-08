import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { UserEntity } from './user.entity';
import { OverlayElement } from '@broadboi/core/lib/models/overlay.types'; // Reverted to use path alias

@Entity('overlay_configs')
export class OverlayConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string; // Name of the overlay configuration

  @Column({ type: 'simple-json' }) // Stores the OverlayElement[] as JSONB or equivalent
  config: OverlayElement[];

  @ManyToOne(() => UserEntity, user => user.overlays, { onDelete: 'CASCADE' })
  user: UserEntity;

  @Column({ type: 'varchar' })
  internalUserId: string; // Redundant but useful for direct queries
}
