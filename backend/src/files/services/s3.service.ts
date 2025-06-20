import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  S3Client, 
  PutObjectCommand, 
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command 
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface PresignedUrlResponse {
  uploadUrl: string;
  fileKey: string;
  expiresIn: number;
}

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(private configService: ConfigService) {
    const s3Config = this.configService.get('s3');
    
    if (!s3Config.accessKeyId || !s3Config.secretAccessKey || !s3Config.bucket) {
      throw new Error('S3 configuration is incomplete');
    }

    this.s3Client = new S3Client({
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
      },
    });

    this.bucket = s3Config.bucket;
    this.logger.log(`S3 Service initialized with bucket: ${this.bucket}`);
  }

  /**
   * Presigned URL 생성 (파일 업로드용) - UUID 기반 S3 키 사용
   */
  async generatePresignedUploadUrl(
    s3Key: string, // UUID 기반 S3 키를 직접 받음
    mimeType: string,
    fileSize: number,
    fileType: string = 'general'
  ): Promise<PresignedUrlResponse> {
    try {
      // MIME 타입 검증
      this.validateMimeType(mimeType, fileType);

      // PutObject 명령 생성
      const putObjectCommand = new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        ContentType: mimeType,
        ContentLength: fileSize,
        // 메타데이터 추가
        Metadata: {
          'file-type': fileType,
          'upload-date': new Date().toISOString(),
        },
      });

      // Presigned URL 생성 (15분 유효)
      const expiresIn = 15 * 60; // 15분
      const uploadUrl = await getSignedUrl(this.s3Client, putObjectCommand, {
        expiresIn,
        signableHeaders: new Set(['content-type']),
      });

      this.logger.log(`Presigned URL generated for S3 key: ${s3Key}`);

      return {
        uploadUrl,
        fileKey: s3Key,
        expiresIn,
      };
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to generate upload URL');
    }
  }

  /**
   * 파일 접근용 Presigned URL 생성
   */
  async generatePresignedDownloadUrl(fileKey: string): Promise<string> {
    try {
      const getObjectCommand = new GetObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      });

      const url = await getSignedUrl(this.s3Client, getObjectCommand, {
        expiresIn: 3600, // 1시간
      });

      this.logger.log(`Download URL generated for file: ${fileKey}`);
      return url;
    } catch (error) {
      this.logger.error(`Failed to generate download URL: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to generate download URL');
    }
  }

  /**
   * 파일 존재 여부 확인
   */
  async checkFileExists(fileKey: string): Promise<boolean> {
    try {
      const headObjectCommand = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      });

      await this.s3Client.send(headObjectCommand);
      this.logger.log(`File exists: ${fileKey}`);
      return true;
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        this.logger.log(`File does not exist: ${fileKey}`);
        return false;
      }
      this.logger.error(`Failed to check file existence: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to check file existence');
    }
  }

  /**
   * S3에서 파일 삭제
   */
  async deleteFile(fileKey: string): Promise<void> {
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      });

      await this.s3Client.send(deleteCommand);
      this.logger.log(`File deleted from S3: ${fileKey}`);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to delete file');
    }
  }

  /**
   * 파일 URL 생성 (공개 접근용)
   */
  getPublicFileUrl(fileKey: string): string {
    const region = this.configService.get('s3.region');
    return `https://${this.bucket}.s3.${region}.amazonaws.com/${fileKey}`;
  }

  /**
   * S3 파일 목록 조회 (디버깅용)
   */
  async listFiles(prefix: string = ''): Promise<string[]> {
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: 100, // 최대 100개
      });

      const response = await this.s3Client.send(listCommand);
      const files = response.Contents?.map(obj => obj.Key || '') || [];
      
      this.logger.log(`Listed ${files.length} files with prefix: ${prefix}`);
      return files.filter(key => key !== ''); // 빈 키 제거
    } catch (error) {
      this.logger.error(`Failed to list files: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to list files');
    }
  }

  /**
   * MIME 타입 검증
   */
  private validateMimeType(mimeType: string, fileType: string): void {
    const allowedMimeTypes = {
      image: [
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml'
      ],
      document: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
      ],
      video: [
        'video/mp4',
        'video/mpeg',
        'video/quicktime',
        'video/x-msvideo'
      ],
      general: [] // 모든 타입 허용
    };

    if (fileType !== 'general' && allowedMimeTypes[fileType]) {
      if (!allowedMimeTypes[fileType].includes(mimeType)) {
        throw new BadRequestException(
          `Invalid MIME type ${mimeType} for file type ${fileType}`
        );
      }
    }
  }
} 