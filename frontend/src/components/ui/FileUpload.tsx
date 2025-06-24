'use client';

import { useState, useRef, useCallback } from 'react';
import { FiUpload, FiFile, FiImage, FiVideo, FiX, FiCheck } from 'react-icons/fi';
import { apiClient } from '@/lib/api';
import { FileUpload as FileUploadType } from '@/types';
import { convertImageToWebP, validateImageFile } from '@/utils/imageUtils';

interface FileUploadProps {
  onUploadComplete: (file: FileUploadType) => void;
  onUploadStart?: () => void;
  onUploadError?: (error: string) => void;
  accept?: string;
  maxSize?: number; // bytes
  fileType?: 'image' | 'document' | 'video' | 'general';
  className?: string;
  disabled?: boolean;
}

export default function FileUpload({
  onUploadComplete,
  onUploadStart,
  onUploadError,
  accept = "*/*",
  maxSize = 10 * 1024 * 1024, // 10MB
  fileType = 'general',
  className = '',
  disabled = false,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<FileUploadType | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    try {
      setUploading(true);
      setProgress(0);
      onUploadStart?.();

      // 파일 검증
      const validationResult = validateImageFile(file);
      if (!validationResult.valid) {
        onUploadError?.(validationResult.error || '파일 검증에 실패했습니다.');
        setUploading(false);
        return;
      }

      let fileToUpload = file;
      // 이미지이고 WebP가 아니면 변환
      if (fileType === 'image' && file.type !== 'image/webp') {
        try {
          fileToUpload = await convertImageToWebP(file);
        } catch (err) {
          onUploadError?.(typeof err === 'string' ? err : 'WebP 변환에 실패했습니다. 이미지는 WebP 형식만 업로드할 수 있습니다.');
          setUploading(false);
          return; // presigned URL 요청 자체를 하지 않음
        }
      }

      // presigned URL 요청 직전, 실제 업로드할 파일 정보 디버깅 출력 (눈에 띄게)
      console.log('==================== [DEBUG] presigned URL 요청 파일 정보 ====================');
      console.log('fileToUpload.name:', fileToUpload.name);
      console.log('fileToUpload.type:', fileToUpload.type);
      console.log('fileToUpload.size:', fileToUpload.size);
      console.log('=============================================================================');

      // 반드시 변환된 WebP 파일 정보로 업로드 진행
      const uploadedFile = await apiClient.uploadFile(fileToUpload, fileType);
      setProgress(100);
      setUploadedFile(uploadedFile);
      onUploadComplete(uploadedFile);
    } catch (error) {
      console.error('Upload failed:', error);
      onUploadError?.(error instanceof Error ? error.message : '파일 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  }, [fileType, onUploadComplete, onUploadStart, onUploadError]);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    uploadFile(file);
  }, [uploadFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    
    if (!disabled) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, [disabled, handleFileSelect]);

  const handleClick = useCallback(() => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click();
    }
  }, [disabled, uploading]);

  const resetUpload = useCallback(() => {
    setUploadedFile(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <FiImage className="w-6 h-6" />;
    if (type.startsWith('video/')) return <FiVideo className="w-6 h-6" />;
    return <FiFile className="w-6 h-6" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
        disabled={disabled}
      />

      {uploadedFile ? (
        // 업로드 완료 상태
        <div className="border-2 border-green-200 bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FiCheck className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  {uploadedFile.originalName}
                </p>
                <p className="text-xs text-green-600">
                  {formatFileSize(uploadedFile.fileSize)} • 업로드 완료
                </p>
              </div>
            </div>
            <button
              onClick={resetUpload}
              className="text-green-600 hover:text-green-800"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        // 업로드 대기/진행 상태
        <div
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${uploading ? 'bg-gray-50' : ''}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          {uploading ? (
            <div className="space-y-3">
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
              <div>
                <p className="text-sm text-gray-600">파일 업로드 중...</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">{progress}%</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-center">
                <FiUpload className="w-8 h-8 text-gray-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600">
                  파일을 드래그하거나 <span className="text-blue-600 font-medium">클릭하여 업로드</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  최대 {Math.round(maxSize / 1024 / 1024)}MB
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 

// 123