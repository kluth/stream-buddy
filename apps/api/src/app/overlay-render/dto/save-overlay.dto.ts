import { IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { OverlayElement } from '@broadboi/core/lib/models/overlay.types'; // Updated relative path

export class SaveOverlayDto {
  @IsString()
  overlayName: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object) // Use Object for nested validation since OverlayElement is a union type
  overlayConfig: OverlayElement[];
}
