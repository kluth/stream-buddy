import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { UserEntity } from '../app/core/entities/user.entity';
import { UserTokenEntity } from '../app/core/entities/user-token.entity';
import { OverlayConfigEntity } from '../app/core/entities/overlay-config.entity';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'sqlite',
  database: './db.sqlite', // SQLite database file
  entities: [UserEntity, UserTokenEntity, OverlayConfigEntity],
  synchronize: false, // Set to false for production with migrations.
  logging: ['error'], // Log only errors
  migrationsTableName: 'migrations',
  migrations: ['apps/api/src/migrations/*.ts'], // Path to your migration files
};
