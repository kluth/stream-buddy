import { DataSource } from 'typeorm';
// import { databaseConfig } from './src/shared/database.config'; // No longer spreading databaseConfig directly
// import { UserEntity } from './src/app/core/entities/user.entity'; // Removed direct import
// import { UserTokenEntity } from './src/app/core/entities/user-token.entity'; // Removed direct import
// import { OverlayConfigEntity } from './src/app/core/entities/overlay-config.entity'; // Removed direct import

// This is a separate DataSource for TypeORM CLI to run migrations.
// It needs to explicitly list entities and migrations, and not rely on NestJS TypeOrmModule.
export const AppDataSource = new DataSource({
  type: 'sqlite', // Explicitly define type
  database: './db.sqlite',
  synchronize: false,
  logging: ['error'],
  entities: [
    'dist/apps/api/src/app/core/entities/*.entity.js', // Path to compiled entity files
  ],
  migrations: [
    'dist/apps/api/src/migrations/*.js', // Path to compiled migration files
  ],
  migrationsTableName: 'migrations',
  // cli: {
  //   migrationsDir: 'apps/api/src/migrations', // This is for `databaseConfig`, not `DataSource`
  // },
});
