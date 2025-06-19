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
import { Response } from 'express';
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
    @CurrentUser('id') userId: number,
    @Body() createUploadUrlDto: CreateUploadUrlDto,
  ) {
    return this.filesService.createUploadUrl(userId, createUploadUrlDto);
  }

  @Post('upload-complete')
  @ApiOperation({ summary: '파일 업로드 완료 처리' })
  @ApiResponse({ status: 201, description: '파일 업로드 완료' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  async uploadComplete(
    @CurrentUser('id') userId: number,
    @Body() uploadCompleteDto: UploadCompleteDto,
  ) {
    return this.filesService.uploadComplete(userId, uploadCompleteDto);
  }

  @Get()
  @ApiOperation({ summary: '사용자 파일 목록 조회' })
  @ApiQuery({ name: 'fileType', required: false, description: '파일 타입 필터' })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: '페이지 크기', example: 20 })
  @ApiResponse({ status: 200, description: '파일 목록 조회 성공' })
  async getUserFiles(
    @CurrentUser('id') userId: number,
    @Query('fileType') fileType?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.filesService.getUserFiles(userId, fileType, page, limit);
  }

  @Get('stats')
  @ApiOperation({ summary: '파일 통계 조회' })
  @ApiResponse({ status: 200, description: '파일 통계 조회 성공' })
  async getFileStats(@CurrentUser('id') userId: number) {
    return this.filesService.getFileStats(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: '파일 정보 조회' })
  @ApiResponse({ status: 200, description: '파일 정보 조회 성공' })
  @ApiResponse({ status: 404, description: '파일을 찾을 수 없음' })
  async getFile(
    @Param('id', ParseIntPipe) fileId: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.filesService.getFileById(fileId, userId);
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
    @Param('id', ParseIntPipe) fileId: number,
    @CurrentUser('id') userId: number,
  ) {
    const downloadUrl = await this.filesService.getDownloadUrl(fileId, userId);
    return { downloadUrl };
  }

  @Options('proxy/:fileKey(*)')
  @Public()
  @HttpCode(HttpStatus.OK)
  async proxyImageOptions(@Res() res: Response) {
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    });
    return res.send();
  }

  @Get('proxy/:fileKey(*)')
  @Public()
  @ApiOperation({ summary: '이미지 프록시 - S3 파일로 리다이렉트' })
  @ApiResponse({ 
    status: 302, 
    description: 'S3 파일로 리다이렉트',
  })
  @ApiResponse({ 
    status: 404, 
    description: '파일을 찾을 수 없음',
  })
  async proxyImage(@Param('fileKey') fileKey: string, @Res() res: Response) {
    try {
      // URL 디코딩하여 한글 파일명 처리 (이중 디코딩 처리)
      let decodedFileKey = fileKey;
      
      // 첫 번째 디코딩
      try {
        decodedFileKey = decodeURIComponent(fileKey);
      } catch (e) {
        this.logger.warn(`First decode failed for: ${fileKey}`);
      }
      
      // 두 번째 디코딩 (이중 인코딩된 경우 처리)
      try {
        const doubleDecoded = decodeURIComponent(decodedFileKey);
        // 실제로 디코딩이 일어났는지 확인
        if (doubleDecoded !== decodedFileKey) {
          decodedFileKey = doubleDecoded;
          this.logger.log(`🔄 [PROXY] Double decoding applied`);
        }
      } catch (e) {
        // 두 번째 디코딩 실패는 정상 (이미 디코딩된 상태)
      }
      
      // 이미 presigned URL 쿼리 파라미터가 붙어있는 경우 제거
      if (decodedFileKey.includes('?')) {
        decodedFileKey = decodedFileKey.split('?')[0];
        this.logger.log(`🧹 [PROXY] Cleaned fileKey (removed query params): ${decodedFileKey}`);
      }
      
      this.logger.log(`🔍 [PROXY] Original fileKey: ${fileKey}`);
      this.logger.log(`📁 [PROXY] Final decoded fileKey: ${decodedFileKey}`);
      
      const presignedUrl = await this.s3Service.generatePresignedDownloadUrl(decodedFileKey);
      
      this.logger.log(`🔗 [PROXY] Generated presigned URL: ${presignedUrl.substring(0, 100)}...`);
      
      // CORS 및 캐시 헤더 설정
      res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Expose-Headers': 'Content-Type, Content-Length',
        'Cache-Control': 'public, max-age=3600',
        'Content-Type': 'image/*',
      });
      
      // 302 리다이렉트 대신 이미지를 직접 스트리밍
      this.logger.log(`📡 [PROXY] Fetching image from S3...`);
      
      const s3Response = await fetch(presignedUrl);
      
      if (!s3Response.ok) {
        throw new Error(`S3 fetch failed: ${s3Response.status}`);
      }
      
      // S3 응답 헤더에서 Content-Type 가져오기
      const contentType = s3Response.headers.get('content-type') || 'image/*';
      const contentLength = s3Response.headers.get('content-length');
      
      // 최종 응답 헤더 설정
      res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Expose-Headers': 'Content-Type, Content-Length',
        'Cache-Control': 'public, max-age=3600',
        'Content-Type': contentType,
      });
      
      if (contentLength) {
        res.set('Content-Length', contentLength);
      }
      
      this.logger.log(`✅ [PROXY] Streaming image (${contentType})`);
      
      // 이미지 스트리밍
      const imageBuffer = await s3Response.arrayBuffer();
      res.send(Buffer.from(imageBuffer));
      
    } catch (error) {
      this.logger.error(`Proxy error for file key: ${fileKey}`, error.message);
      
      // CORS 헤더 추가하여 에러 응답
      res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Expose-Headers': 'Content-Type, Content-Length',
      });
      
      return res.status(404).json({ 
        statusCode: 404,
        message: 'File not found or access denied',
        error: 'Not Found'
      });
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '파일 삭제' })
  @ApiResponse({ status: 204, description: '파일 삭제 성공' })
  @ApiResponse({ status: 404, description: '파일을 찾을 수 없음' })
  async deleteFile(
    @Param('id', ParseIntPipe) fileId: number,
    @CurrentUser('id') userId: number,
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