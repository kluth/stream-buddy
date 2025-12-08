import { IsString, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { PlatformType } from '../interfaces'; // Assuming interfaces.ts is in the same directory

export class StreamDestinationDto {
  @IsString()
  internalUserId: string; // Added to match StreamDestination interface

  @IsString()
  platformType: PlatformType;

  @IsOptional()
  @IsString()
  streamKey?: string;

  @IsOptional()
  @IsString()
  ingestionAddress?: string;

  @IsOptional()
  @IsString()
  streamName?: string;
}

export class StartSimulcastDto {
  @IsString()
  internalUserId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StreamDestinationDto)
  destinations: StreamDestinationDto[];
}
