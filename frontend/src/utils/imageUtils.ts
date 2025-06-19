/**
 * 이미지 URL 처리 유틸리티
 * TanStack Query를 사용한 효율적인 이미지 로딩 및 상태 관리
 */

import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * S3 직접 URL을 프록시 URL로 변환
 * @param originalUrl - 원본 이미지 URL
 * @returns 프록시 URL 또는 원본 URL
 */
export const getProxyImageUrl = (originalUrl: string | null | undefined): string | null => {
  if (!originalUrl) return null;
  
  try {
    // 이미 프록시 URL인지 확인
    if (originalUrl.includes('/api/v1/files/proxy/')) {
      // 쿼리 파라미터가 있다면 제거하여 깔끔한 프록시 URL 반환
      const cleanUrl = originalUrl.split('?')[0];
      return cleanUrl;
    }
    
    // S3 키인지 확인 (uploads/로 시작하는 경우)
    if (originalUrl.startsWith('uploads/')) {
      let baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      
      // 이미 /api/v1이 포함되어 있다면 제거
      if (baseUrl.includes('/api/v1')) {
        baseUrl = baseUrl.replace('/api/v1', '');
      }
      
      const proxyUrl = `${baseUrl}/api/v1/files/proxy/${originalUrl}`;
      return proxyUrl;
    }
    
    // S3 URL인지 확인
    const s3Pattern = /https:\/\/[^\/]+\.s3\.[^\/]+\.amazonaws\.com\/(.+)/;
    const match = originalUrl.match(s3Pattern);
    
    if (match) {
      const fileKey = match[1];
      // 쿼리 파라미터 제거 (presigned URL의 경우)
      const cleanFileKey = fileKey.split('?')[0];
      
      let baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      
      // 이미 /api/v1이 포함되어 있다면 제거
      if (baseUrl.includes('/api/v1')) {
        baseUrl = baseUrl.replace('/api/v1', '');
      }
      
      const proxyUrl = `${baseUrl}/api/v1/files/proxy/${cleanFileKey}`;
      return proxyUrl;
    }
    
    // S3 URL이 아니면 원본 반환
    return originalUrl;
    
  } catch (error) {
    console.error('❌ [getProxyImageUrl] Error processing URL:', error);
    return originalUrl;
  }
};

/**
 * 이미지 로딩 상태 관리를 위한 기본 이미지 URL
 */
export const DEFAULT_IMAGE_URL = '/images/placeholder.svg';

/**
 * 이미지 로딩 상태를 확인하는 쿼리 함수
 */
const checkImageLoad = async (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });
};

/**
 * TanStack Query를 사용한 이미지 로딩 상태 관리
 */
export function useImageQuery(imageUrl: string | null | undefined) {
  const processedUrl = getProxyImageUrl(imageUrl);
  
  return useQuery({
    queryKey: ['image', processedUrl],
    queryFn: () => checkImageLoad(processedUrl!),
    enabled: !!processedUrl,
    retry: 1, // 한 번만 재시도
    retryDelay: 500,
    staleTime: 1000 * 60 * 5, // 5분간 캐시
    gcTime: 1000 * 60 * 10, // 10분간 가비지 컬렉션 방지
  });
}

/**
 * 이미지 상태 관리를 위한 React Hook
 */
export function useImageLoader(imageUrl: string | null | undefined) {
  const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  
  const { isLoading, isError, data } = useImageQuery(imageUrl);
  
  // 상태 업데이트
  React.useEffect(() => {
    if (isLoading) {
      setLoadingState('loading');
    } else if (isError) {
      setLoadingState('error');
      setFinalUrl(DEFAULT_IMAGE_URL);
    } else if (data) {
      setLoadingState('loaded');
      setFinalUrl(data);
    }
  }, [isLoading, isError, data]);
  
  const resetError = useCallback(() => {
    setLoadingState('idle');
    setFinalUrl(null);
  }, []);
  
  return {
    isLoading: loadingState === 'loading',
    isError: loadingState === 'error',
    isLoaded: loadingState === 'loaded',
    imageUrl: finalUrl,
    resetError,
  };
}

/**
 * 이미지 컴포넌트를 위한 props 생성 유틸리티
 */
export function createImageProps(imageUrl: string | null | undefined) {
  const { isLoading, isError, isLoaded, imageUrl: finalUrl } = useImageLoader(imageUrl);
  
  return {
    src: finalUrl || DEFAULT_IMAGE_URL,
    loading: isLoading,
    error: isError,
    loaded: isLoaded,
    style: {
      opacity: isLoaded ? 1 : 0.7,
      transition: 'opacity 0.3s ease-in-out',
    },
  };
} 