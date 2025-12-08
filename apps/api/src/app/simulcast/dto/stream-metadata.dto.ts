import { IsString, IsOptional, IsNotEmpty, IsNumber } from 'class-validator';
import { PlatformType } from '../interfaces';

export class StreamMetadataDto {
  @IsNotEmpty()
  @IsString()
  internalUserId: string;

  @IsNotEmpty()
  @IsString()
  platformType: PlatformType;

  @IsOptional()
  @IsString()
  title?: string;

  // Twitch specific
  @IsOptional()
  @IsString()
  gameId?: string; // Twitch category ID

  // YouTube specific
  @IsOptional()
  @IsString()
  youtubeCategoryId?: string; // YouTube category ID

  @IsOptional()
  @IsString()
  description?: string;
}
