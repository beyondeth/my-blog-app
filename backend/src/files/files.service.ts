import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { File } from './entities/file.entity';
import { S3Service, PresignedUrlResponse } from './services/s3.service';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { UploadCompleteDto } from './dto/upload-complete.dto';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @InjectRepository(File)
    private fileRepository: Repository<File>,
    private s3Service: S3Service,
  ) {}

  /**
   * 파일 업로드용 Presigned URL 생성
   */
  async createUploadUrl(
    userId: number, 
    createUploadUrlDto: CreateUploadUrlDto
  ): Promise<PresignedUrlResponse & { tempId: string }> {
    const { fileName, mimeType, fileSize, fileType } = createUploadUrlDto;

    try {
      // S3 Presigned URL 생성
      const presignedData = await this.s3Service.generatePresignedUploadUrl(
        fileName,
        mimeType,
        fileSize,
        fileType
      );

      // 임시 ID 생성 (업로드 완료 시 연결용)
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.logger.log(`Upload URL created for user ${userId}, file: ${fileName}`);

      return {
        ...presignedData,
        tempId,
      };
    } catch (error) {
      this.logger.error(`Failed to create upload URL: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 파일 업로드 완료 처리
   */
  async uploadComplete(
    userId: number,
    uploadCompleteDto: UploadCompleteDto
  ): Promise<File & { accessUrl: string }> {
    const { fileKey, fileUrl, fileName, mimeType, fileSize, fileType } = uploadCompleteDto;

    try {
      this.logger.log(`Upload complete request received:`, {
        userId,
        fileKey,
        fileUrl,
        fileName,
        mimeType,
        fileSize,
        fileType
      });

      // 이미지 파일인 경우 Presigned URL 생성 (1시간 유효)
      const accessUrl = await this.s3Service.generatePresignedDownloadUrl(fileKey);
      
      this.logger.log(`Generated access URL: ${accessUrl}`);

      // 파일 정보 DB에 저장 - fileUrl에는 S3 키를 저장 (Presigned URL이 아닌)
      const file = this.fileRepository.create({
        originalName: fileName,
        fileName: fileKey.split('/').pop(), // 파일명만 추출
        fileKey,
        fileUrl: fileKey, // ✅ S3 키를 저장 (Presigned URL 대신)
        fileSize,
        mimeType,
        fileType: fileType || 'general',
        userId,
      });

      const savedFile = await this.fileRepository.save(file);

      this.logger.log(`File upload completed for user ${userId}, fileId: ${savedFile.id}`);
      
      return {
        ...savedFile,
        accessUrl
      };
    } catch (error) {
      this.logger.error(`Failed to complete upload: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 사용자의 파일 목록 조회
   */
  async getUserFiles(
    userId: number,
    fileType?: string,
    page: number = 1,
    limit: number = 20
  ) {
    const queryBuilder = this.fileRepository
      .createQueryBuilder('file')
      .where('file.userId = :userId', { userId })
      .orderBy('file.createdAt', 'DESC');

    if (fileType) {
      queryBuilder.andWhere('file.fileType = :fileType', { fileType });
    }

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [files, total] = await queryBuilder.getManyAndCount();

    return {
      files,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 파일 정보 조회
   */
  async getFileById(fileId: number, userId?: number): Promise<File> {
    const file = await this.fileRepository.findOne({
      where: { id: fileId },
      relations: ['user'],
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // 소유자 확인 (필요한 경우)
    if (userId && file.userId !== userId) {
      throw new ForbiddenException('Access denied to this file');
    }

    return file;
  }

  /**
   * 파일 삭제
   */
  async deleteFile(fileId: number, userId: number): Promise<void> {
    const file = await this.getFileById(fileId, userId);

    try {
      // S3에서 파일 삭제
      await this.s3Service.deleteFile(file.fileKey);

      // DB에서 파일 정보 삭제
      await this.fileRepository.remove(file);

      this.logger.log(`File deleted: ${file.fileKey}`);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 파일 다운로드 URL 생성
   */
  async getDownloadUrl(fileId: number, userId?: number): Promise<string> {
    const file = await this.getFileById(fileId, userId);
    
    try {
      // 공개 파일이면 직접 URL 반환, 아니면 Presigned URL 생성
      if (file.fileType === 'image') {
        return this.s3Service.getPublicFileUrl(file.fileKey);
      } else {
        return await this.s3Service.generatePresignedDownloadUrl(file.fileKey);
      }
    } catch (error) {
      this.logger.error(`Failed to generate download URL: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 파일 통계 조회
   */
  async getFileStats(userId: number) {
    const stats = await this.fileRepository
      .createQueryBuilder('file')
      .select([
        'file.fileType as fileType',
        'COUNT(*) as count',
        'SUM(file.fileSize) as totalSize'
      ])
      .where('file.userId = :userId', { userId })
      .groupBy('file.fileType')
      .getRawMany();

    const totalFiles = await this.fileRepository.count({ where: { userId } });
    const totalSize = await this.fileRepository
      .createQueryBuilder('file')
      .select('SUM(file.fileSize)', 'totalSize')
      .where('file.userId = :userId', { userId })
      .getRawOne();

    return {
      totalFiles,
      totalSize: parseInt(totalSize.totalSize || '0'),
      byType: stats.map(stat => ({
        fileType: stat.fileType,
        count: parseInt(stat.count),
        totalSize: parseInt(stat.totalSize || '0'),
      })),
    };
  }

  async findOne(id: number, userId: number): Promise<File> {
    const file = await this.fileRepository.findOne({
      where: { id, userId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return file;
  }

  async findAll(limit: number = 20): Promise<File[]> {
    return this.fileRepository.find({
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }
} 