import { IsString } from 'class-validator';

export class StopSimulcastDto {
  @IsString()
  streamPath: string;
}
