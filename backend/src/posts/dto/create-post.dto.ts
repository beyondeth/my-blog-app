import { IsString, IsOptional, IsArray, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty({
    description: '게시글 제목',
    example: '블로그 포스트 제목',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: '게시글 내용',
    example: '게시글의 상세 내용...',
  })
  @IsString()
  content: string;

  @ApiPropertyOptional({
    description: '게시글 요약',
    example: '게시글의 간단한 요약...',
  })
  @IsOptional()
  @IsString()
  excerpt?: string;

  @ApiPropertyOptional({
    description: '썸네일 이미지 URL',
    example: 'https://example.com/thumbnail.jpg',
  })
  @IsOptional()
  @IsString()
  thumbnail?: string;

  @ApiPropertyOptional({
    description: '태그 배열',
    example: ['javascript', 'nodejs', 'nestjs'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: '카테고리',
    example: '개발',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: '첨부 파일 ID 배열',
    example: [1, 2, 3],
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  attachedFileIds?: number[];
} 