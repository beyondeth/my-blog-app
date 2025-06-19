"use client";

import React from 'react';
import { createImageProps } from '../../utils/imageUtils';

interface OptimizedImageProps {
  src: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * TanStack Query를 사용한 최적화된 이미지 컴포넌트
 * DOM 조작 없이 상태 기반으로 이미지 로딩을 관리합니다.
 */
export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  style = {},
  priority = false,
  onLoad,
  onError,
}: OptimizedImageProps) {
  const imageProps = createImageProps(src);

  React.useEffect(() => {
    if (imageProps.loaded && onLoad) {
      onLoad();
    }
    if (imageProps.error && onError) {
      onError();
    }
  }, [imageProps.loaded, imageProps.error, onLoad, onError]);

  return (
    <div className={`relative ${className}`} style={style}>
      <img
        src={imageProps.src}
        alt={alt}
        width={width}
        height={height}
        style={{
          ...imageProps.style,
          width: width ? `${width}px` : 'auto',
          height: height ? `${height}px` : 'auto',
          maxWidth: '100%',
        }}
        loading={priority ? 'eager' : 'lazy'}
        className={`block ${imageProps.error ? 'opacity-50' : ''}`}
      />
      
      {imageProps.loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <div className="animate-pulse">
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          </div>
        </div>
      )}
      
      {imageProps.error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-xs">이미지를 불러올 수 없습니다</p>
          </div>
        </div>
      )}
    </div>
  );
} 