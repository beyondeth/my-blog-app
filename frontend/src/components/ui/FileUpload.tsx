'use client';

import { useState, useRef, useCallback } from 'react';
import { FiUpload, FiFile, FiImage, FiVideo, FiX, FiCheck } from 'react-icons/fi';
import { apiClient } from '@/lib/api';
import { FileUpload as FileUploadType } from '@/types';

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

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > maxSize) {
      return `파일 크기가 ${Math.round(maxSize / 1024 / 1024)}MB를 초과합니다.`;
    }

    // MIME 타입 검증
    const allowedTypes = {
      image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
      document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      video: ['video/mp4', 'video/mpeg', 'video/quicktime'],
      general: [] // 모든 타입 허용
    };

    if (fileType !== 'general' && allowedTypes[fileType]) {
      if (!allowedTypes[fileType].includes(file.type)) {
        return `지원하지 않는 파일 형식입니다. (${allowedTypes[fileType].join(', ')})`;
      }
    }

    return null;
  }, [maxSize, fileType]);

  const uploadFile = useCallback(async (file: File) => {
    try {
      setUploading(true);
      setProgress(0);
      onUploadStart?.();

      // 파일 검증
      const validationError = validateFile(file);
      if (validationError) {
        onUploadError?.(validationError);
        return;
      }

      // 파일 업로드
      const uploadedFile = await apiClient.uploadFile(file, fileType);
      
      setProgress(100);
      setUploadedFile(uploadedFile);
      onUploadComplete(uploadedFile);
    } catch (error) {
      console.error('Upload failed:', error);
      onUploadError?.(error instanceof Error ? error.message : '파일 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  }, [fileType, validateFile, onUploadComplete, onUploadStart, onUploadError]);

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