import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

/**
 * 파일 확장자 추출
 */
export function getFileExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

/**
 * MIME 타입에서 확장자 추출
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'application/pdf': '.pdf',
    'text/plain': '.txt',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  };
  
  return mimeToExt[mimeType] || '.bin';
}

/**
 * UUID 기반 파일명 생성
 * @param originalName 원본 파일명
 * @param mimeType MIME 타입
 * @param fileType 파일 타입 (image, document, etc.)
 * @returns UUID 기반 파일명
 */
export function generateUuidFileName(
  originalName: string,
  mimeType: string,
  fileType: string = 'general'
): string {
  const uuid = uuidv4();
  const extension = getFileExtension(originalName) || getExtensionFromMimeType(mimeType);
  
  // 파일명 형식: {uuid}{extension}
  return `${uuid}${extension}`;
}

/**
 * S3 키 생성 (폴더 구조 포함)
 * @param fileName UUID 파일명
 * @param fileType 파일 타입
 * @returns S3 키
 */
export function generateS3Key(fileName: string, fileType: string = 'general'): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  return `uploads/${fileType}/${year}/${month}/${fileName}`;
}

/**
 * 파일 크기를 사람이 읽기 쉬운 형태로 변환
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 이미지 MIME 타입 검증
 */
export function isImageMimeType(mimeType: string): boolean {
  const imageMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ];
  
  return imageMimeTypes.includes(mimeType.toLowerCase());
}

/**
 * 파일 MIME 타입 검증
 */
export function validateMimeType(mimeType: string, allowedTypes: string[]): boolean {
  return allowedTypes.includes(mimeType.toLowerCase());
}

/**
 * 안전한 파일명 생성 (특수문자 제거)
 */
export function sanitizeFileName(fileName: string): string {
  // 확장자 분리
  const ext = path.extname(fileName);
  const name = path.basename(fileName, ext);
  
  // 특수문자 제거 및 공백을 하이픈으로 변경
  const sanitized = name
    .replace(/[^a-zA-Z0-9가-힣\s-_]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
    
  return `${sanitized}${ext}`;
}

/**
 * 파일 크기 검증
 */
export function validateFileSize(size: number, maxSize: number = 10 * 1024 * 1024): boolean {
  return size <= maxSize;
}

/**
 * 이미지 파일 검증 (크기 + MIME 타입)
 */
export function validateImageFile(file: { size: number; type: string }, maxSize: number = 10 * 1024 * 1024): { valid: boolean; error?: string } {
  // MIME 타입 검증
  if (!isImageMimeType(file.type)) {
    return {
      valid: false,
      error: `지원하지 않는 이미지 형식입니다. (${file.type})`
    };
  }

  // 파일 크기 검증
  if (!validateFileSize(file.size, maxSize)) {
    return {
      valid: false,
      error: `파일 크기가 너무 큽니다. 최대 ${formatFileSize(maxSize)}까지 업로드 가능합니다.`
    };
  }

  return { valid: true };
}

/**
 * S3 키에서 파일명 추출
 */
export function extractFileNameFromS3Key(s3Key: string): string {
  return s3Key.split('/').pop() || s3Key;
}

/**
 * S3 키에서 파일 타입 추출
 */
export function extractFileTypeFromS3Key(s3Key: string): string {
  const parts = s3Key.split('/');
  if (parts.length >= 2 && parts[0] === 'uploads') {
    return parts[1];
  }
  return 'general';
} 