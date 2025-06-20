import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { FileUpload, FileType, FileTypeType } from '@/types';
import { getErrorMessage } from '@/utils/queryHelpers';

// File Query Keys
export const fileQueryKeys = {
  all: ['files'] as const,
  lists: () => [...fileQueryKeys.all, 'list'] as const,
  list: (filters: { fileType?: string; page?: number; limit?: number }) => 
    [...fileQueryKeys.lists(), filters] as const,
  details: () => [...fileQueryKeys.all, 'detail'] as const,
  detail: (id: string | number) => [...fileQueryKeys.details(), id] as const,
};

// 파일 목록 조회 훅
export function useFiles(params?: {
  fileType?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: fileQueryKeys.list(params || {}),
    queryFn: () => apiClient.getUserFiles(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// 파일 업로드 뮤테이션 훅 - 타입 안전성 개선
export function useUploadFile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ file, fileType }: { file: File; fileType?: FileTypeType }) => {
      // 타입 안전성을 위한 유효성 검사
      const validFileType = fileType && Object.values(FileType).includes(fileType) 
        ? fileType 
        : FileType.GENERAL;
      return await apiClient.uploadFile(file, validFileType);
    },
    onSuccess: () => {
      // 파일 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: fileQueryKeys.lists() });
    },
    onError: (error) => {
      console.error('File upload error:', error);
    },
    retry: 1,
  });
}

// 파일 삭제 뮤테이션 훅
export function useDeleteFile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (fileId: string | number) => {
      const id = typeof fileId === 'string' ? parseInt(fileId, 10) : fileId;
      return apiClient.deleteFile(id);
    },
    onSuccess: (_, deletedFileId) => {
      // 삭제된 파일 캐시 제거
      queryClient.removeQueries({ queryKey: fileQueryKeys.detail(deletedFileId) });
      // 파일 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: fileQueryKeys.lists() });
    },
    retry: 1,
  });
}

// 이미지 검증 유틸리티
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  if (file.size > maxSize) {
    return { valid: false, error: '파일 크기가 10MB를 초과합니다.' };
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: '지원되지 않는 파일 형식입니다.' };
  }

  return { valid: true };
}

// 파일 크기 포맷팅 유틸리티
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
} 