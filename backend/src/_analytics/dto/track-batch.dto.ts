import { Type } from 'class-transformer';
import { IsArray, IsString, IsObject, ValidateNested, IsOptional } from 'class-validator';

class EventDto {
  @IsString()
  eventType: string;

  @IsObject()
  eventData: Record<string, any>;

  @IsString()
  timestamp: string;
}

export class TrackBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventDto)
  events: EventDto[];

  @IsString()
  sessionId: string;

  @IsString()
  @IsOptional()
  userAgent?: string;

  @IsString()
  @IsOptional()
  referrer?: string;
} 