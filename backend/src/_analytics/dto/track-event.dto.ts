import { IsString, IsOptional, IsObject, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TrackEventDto {
  @ApiProperty({
    description: '이벤트 타입',
    example: 'page_view',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  eventType: string;

  @ApiProperty({
    description: '이벤트 데이터 (JSON 객체)',
    example: { postId: '123', category: 'tech' },
    required: false,
  })
  @IsOptional()
  @IsObject()
  eventData?: Record<string, any>;

  @ApiProperty({
    description: '세션 ID',
    example: 'session_123456',
    required: false,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sessionId?: string;

  @ApiProperty({
    description: '사용자 에이전트',
    required: false,
  })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiProperty({
    description: 'IP 주소',
    example: '192.168.1.1',
    required: false,
    maxLength: 45,
  })
  @IsOptional()
  @IsString()
  @MaxLength(45)
  ipAddress?: string;

  @ApiProperty({
    description: '리퍼러 URL',
    required: false,
  })
  @IsOptional()
  @IsString()
  referrer?: string;
} 