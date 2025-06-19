"use client";

import React, { useState } from 'react';
import { getProxyImageUrl } from '../../utils/imageUtils';

interface ImageProxyProps {
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
 * S3 이미지를 프록시를 통해 안전하게 로딩하는 컴포넌트
 * - 자동으로 S3 URL을 프록시 URL로 변환
 * - CORS 문제 해결
 * - 에러 시 placeholder 표시
 */
export default function ImageProxy({
  src,
  alt,
  width,
  height,
  className = '',
  style = {},
  priority = false,
  onLoad,
  onError,
}: ImageProxyProps) {
  const [hasError, setHasError] = useState(false);

  if (!src) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
        <span className="text-gray-500 text-sm">이미지 없음</span>
      </div>
    );
  }

  // 핵심: ImageProxy 내부에서 getProxyImageUrl 자동 호출
  const proxyUrl = getProxyImageUrl(src);

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  const handleLoad = () => {
    setHasError(false);
    onLoad?.();
  };

  if (hasError) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
        <div className="text-center text-gray-500">
          <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-xs">이미지 로드 실패</p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={proxyUrl || src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      crossOrigin="anonymous" // 핵심: CORS 문제 해결
      loading={priority ? 'eager' : 'lazy'}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
} 