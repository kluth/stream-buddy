import { IsString, IsNotEmpty, IsObject } from 'class-validator';

export class SimulateEventDto {
  @IsNotEmpty()
  @IsString()
  eventType: string; // e.g., 'chat-message', 'new-follower-alert'

  @IsNotEmpty()
  @IsString()
  internalUserId: string;

  @IsNotEmpty()
  @IsObject()
  payload: Record<string, any>;
}
