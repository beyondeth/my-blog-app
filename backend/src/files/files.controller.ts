import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpStatus,
  HttpCode,
  Res,
  Req,
  Options,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { FilesService } from './files.service';
import { S3Service } from './services/s3.service';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { UploadCompleteDto } from './dto/upload-complete.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Response, Request } from 'express';
import { Logger } from '@nestjs/common';

@ApiTags('Files')
@Controller('files')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FilesController {
  private readonly logger = new Logger(FilesController.name);

  constructor(
    private readonly filesService: FilesService,
    private readonly s3Service: S3Service,
  ) {}

  @Post('upload-url')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '파일 업로드용 Presigned URL 생성' })
  @ApiResponse({ 
    status: 201, 
    description: 'Presigned URL 생성 성공',
    schema: {
      type: 'object',
      properties: {
        uploadUrl: { type: 'string', description: '파일 업로드용 URL' },
        fileKey: { type: 'string', description: 'S3 파일 키' },
        expiresIn: { type: 'number', description: '만료 시간(초)' },
        tempId: { type: 'string', description: '임시 ID' },
      },
    },
  })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  async createUploadUrl(
    @CurrentUser('id') userId: string,
    @Body() createUploadUrlDto: CreateUploadUrlDto,
  ) {
    return this.filesService.createUploadUrl(userId as any, createUploadUrlDto);
  }

  @Post('upload-complete')
  @ApiOperation({ summary: '파일 업로드 완료 처리' })
  @ApiResponse({ status: 201, description: '파일 업로드 완료' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  async uploadComplete(
    @CurrentUser('id') userId: string,
    @Body() uploadCompleteDto: UploadCompleteDto,
  ) {
    return this.filesService.uploadComplete(userId as any, uploadCompleteDto);
  }

  @Get()
  @ApiOperation({ summary: '사용자 파일 목록 조회' })
  @ApiQuery({ name: 'fileType', required: false, description: '파일 타입 필터' })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: '페이지 크기', example: 20 })
  @ApiResponse({ status: 200, description: '파일 목록 조회 성공' })
  async getUserFiles(
    @CurrentUser('id') userId: string,
    @Query('fileType') fileType?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.filesService.getUserFiles(userId as any, fileType, page, limit);
  }

  @Get('stats')
  @ApiOperation({ summary: '파일 통계 조회' })
  @ApiResponse({ status: 200, description: '파일 통계 조회 성공' })
  async getFileStats(@CurrentUser('id') userId: string) {
    return this.filesService.getFileStats(userId as any);
  }

  @Get(':id')
  @ApiOperation({ summary: '파일 정보 조회' })
  @ApiResponse({ status: 200, description: '파일 정보 조회 성공' })
  @ApiResponse({ status: 404, description: '파일을 찾을 수 없음' })
  async getFile(
    @Param('id') fileId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.filesService.getFileById(fileId as any, userId as any);
  }

  @Get(':id/download-url')
  @ApiOperation({ summary: '파일 다운로드 URL 생성' })
  @ApiResponse({ 
    status: 200, 
    description: '다운로드 URL 생성 성공',
    schema: {
      type: 'object',
      properties: {
        downloadUrl: { type: 'string', description: '파일 다운로드 URL' },
      },
    },
  })
  @ApiResponse({ status: 404, description: '파일을 찾을 수 없음' })
  async getDownloadUrl(
    @Param('id') fileId: string,
    @CurrentUser('id') userId: string,
  ) {
    const downloadUrl = await this.filesService.getDownloadUrl(fileId as any, userId as any);
    return { downloadUrl };
  }

  @Options('proxy/*')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  async proxyImageOptions(@Res() res: Response) {
    // OPTIONS 요청에 명시적 CORS 헤더 설정
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    return res.send();
  }

  @Get('proxy/*')
  @Public()
  @ApiOperation({ summary: '이미지 프록시 - S3 파일로 리다이렉트 (UUID 기반)' })
  @ApiResponse({ 
    status: 302, 
    description: 'S3 파일로 리다이렉트',
  })
  @ApiResponse({ 
    status: 404, 
    description: '파일을 찾을 수 없음',
  })
  async proxyImage(@Param('0') fileKey: string, @Res() res: Response, @Req() req: Request) {
    try {
      // UUID 기반 S3 키 처리
      let processedFileKey = fileKey;
      
      this.logger.log(`🔍 [PROXY] Raw fileKey from URL: ${fileKey}`);
      
      // URL 디코딩 (UUID는 일반적으로 ASCII이므로 간단한 처리)
      try {
        processedFileKey = decodeURIComponent(fileKey);
        this.logger.log(`🔄 [PROXY] After decode: ${processedFileKey}`);
      } catch (e) {
        this.logger.warn(`❌ [PROXY] Decode failed for: ${fileKey}`, e.message);
        processedFileKey = fileKey; // 디코딩 실패 시 원본 사용
      }
      
      // 쿼리 파라미터 제거 (presigned URL 파라미터가 있을 수 있음)
      if (processedFileKey.includes('?')) {
        processedFileKey = processedFileKey.split('?')[0];
        this.logger.log(`🧹 [PROXY] Cleaned fileKey (removed query params): ${processedFileKey}`);
      }
      
      // uploads/ 접두사 확인 및 추가
      if (!processedFileKey.startsWith('uploads/')) {
        processedFileKey = `uploads/${processedFileKey}`;
        this.logger.log(`📁 [PROXY] Added uploads/ prefix: ${processedFileKey}`);
      }
      
      this.logger.log(`📁 [PROXY] Final processed fileKey: ${processedFileKey}`);
      
      // S3에서 파일 존재 여부 확인 (선택사항 - 성능을 위해 생략 가능)
      // const exists = await this.s3Service.checkFileExists(processedFileKey);
      // if (!exists) {
      //   throw new Error('File not found in S3');
      // }
      
      const presignedUrl = await this.s3Service.generatePresignedDownloadUrl(processedFileKey);
      
      this.logger.log(`🔗 [PROXY] Generated presigned URL: ${presignedUrl.substring(0, 100)}...`);
      
      // S3에서 이미지를 직접 스트리밍
      this.logger.log(`📡 [PROXY] Fetching image from S3...`);
      
      const s3Response = await fetch(presignedUrl);
      
      if (!s3Response.ok) {
        this.logger.error(`❌ [PROXY] S3 fetch failed: ${s3Response.status} ${s3Response.statusText}`);
        throw new Error(`S3 fetch failed: ${s3Response.status}`);
      }
      
      // S3 응답 헤더에서 Content-Type 가져오기
      const contentType = s3Response.headers.get('content-type') || 'image/*';
      const contentLength = s3Response.headers.get('content-length');
      
      // 캐시 및 컨텐츠 헤더 설정 (명시적 CORS 헤더 추가)
      res.set({
        'Cache-Control': 'public, max-age=3600, immutable',
        'Content-Type': contentType,
        'ETag': `"${processedFileKey}"`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      });
      
      if (contentLength) {
        res.set('Content-Length', contentLength);
      }
      
      this.logger.log(`✅ [PROXY] Streaming image (${contentType}, ${contentLength || 'unknown'} bytes)`);
      
      // 이미지 스트리밍
      const imageBuffer = await s3Response.arrayBuffer();
      res.send(Buffer.from(imageBuffer));
      
    } catch (error) {
      this.logger.error(`❌ [PROXY] Error for file key: ${fileKey}`, error.message);
      
      // 에러 응답 헤더 설정 (명시적 CORS 헤더 추가)
      res.set({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      
      return res.status(404).json({ 
        statusCode: 404,
        message: 'File not found or access denied',
        error: 'Not Found',
        fileKey: fileKey
      });
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '파일 삭제' })
  @ApiResponse({ status: 204, description: '파일 삭제 성공' })
  @ApiResponse({ status: 404, description: '파일을 찾을 수 없음' })
  async deleteFile(
    @Param('id') fileId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.filesService.deleteFile(fileId, userId);
  }

  @Get('test/s3-connection')
  @Public()
  @ApiOperation({ summary: 'S3 연결 테스트' })
  @ApiResponse({ 
    status: 200, 
    description: 'S3 연결 테스트 성공',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'S3 connection test successful' },
        bucket: { type: 'string', example: 'your-bucket-name' },
        region: { type: 'string', example: 'us-east-1' },
        testResult: { type: 'object' },
      },
    },
  })
  async testS3Connection() {
    try {
      // 테스트용 presigned URL 생성
      const testResult = await this.s3Service.generatePresignedUploadUrl(
        'test-file.txt',
        'text/plain',
        1024,
        'general'
      );

      return {
        status: 'success',
        message: 'S3 connection test successful',
        bucket: process.env.AWS_S3_BUCKET,
        region: process.env.AWS_REGION,
        testResult: {
          uploadUrlGenerated: !!testResult.uploadUrl,
          fileKey: testResult.fileKey,
          expiresIn: testResult.expiresIn,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'S3 connection test failed',
        error: error.message,
        bucket: process.env.AWS_S3_BUCKET,
        region: process.env.AWS_REGION,
      };
    }
  }

  @Get('test/s3-files')
  @Public()
  @ApiOperation({ summary: 'S3 파일 목록 조회 (디버깅용)' })
  async listS3Files(@Query('prefix') prefix: string = 'uploads/image/2025/06/') {
    try {
      const files = await this.s3Service.listFiles(prefix);
      return {
        status: 'success',
        prefix,
        files: files.slice(0, 20), // 최대 20개만 반환
        total: files.length,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to list S3 files',
        error: error.message,
      };
    }
  }

  @Get('test/db-files')
  @Public()
  async getDbFiles(@Query('limit') limit: string = '20') {
    try {
      const files = await this.filesService.findAll(parseInt(limit));
      return {
        status: 'success',
        total: files.length,
        files: files.map(file => ({
          id: file.id,
          fileName: file.fileName,
          fileUrl: file.fileUrl,
          userId: file.userId,
          createdAt: file.createdAt,
        })),
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
      };
    }
  }
} 