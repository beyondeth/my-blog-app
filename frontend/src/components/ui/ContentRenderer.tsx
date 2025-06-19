"use client";

import React, { useMemo } from 'react';
import { getProxyImageUrl } from '../../utils/imageUtils';

interface ContentRendererProps {
  content: string;
  className?: string;
}

/**
 * HTML 콘텐츠 내의 이미지 URL을 프록시 URL로 변환하여 렌더링하는 컴포넌트
 * ImageProxy와 동일한 getProxyImageUrl 로직 재사용
 */
export default function ContentRenderer({ content, className = '' }: ContentRendererProps) {
  const processedContent = useMemo(() => {
    if (!content) return '';

    // 모든 이미지 src 속성을 찾아서 프록시 URL로 변환
    // ImageProxy와 동일한 로직 재사용 - 정규식 개선 (공백 있는 경우와 없는 경우 모두 처리)
    const processed = content.replace(
      /<img([^>]*?)(?:\s+)?src="([^"]*)"([^>]*)>/g,
      (match, beforeSrc, srcUrl, afterSrc) => {
        const processedUrl = getProxyImageUrl(srcUrl);
        
        // beforeSrc에 공백이 없다면 추가
        const spaceBefore = beforeSrc && !beforeSrc.endsWith(' ') ? ' ' : '';
        return `<img${beforeSrc}${spaceBefore}src="${processedUrl || srcUrl}" crossorigin="anonymous"${afterSrc}>`;
      }
    );
    return processed;
  }, [content]);

  return (
    <div 
      className={`prose prose-lg prose-gray max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  );
} 