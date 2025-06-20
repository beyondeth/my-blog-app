"use client";

import React from 'react';
import DOMPurify from 'dompurify';
import { normalizeImageUrl } from '@/utils/imageUtils';

interface ContentRendererProps {
  content: string;
  className?: string;
}

/**
 * HTML 콘텐츠 내의 이미지 URL을 프록시 URL로 변환하여 렌더링하는 컴포넌트
 * ImageProxy와 동일한 getProxyImageUrl 로직 재사용
 */
export default function ContentRenderer({ content, className = '' }: ContentRendererProps) {
  const processContent = (htmlContent: string): string => {
    if (!htmlContent) return '';

    try {
      // HTML 정리 및 보안 처리
      const cleanHtml = DOMPurify.sanitize(htmlContent, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'code', 'pre', 'span', 'div'
        ],
        ALLOWED_ATTR: [
          'href', 'src', 'alt', 'title', 'target', 'rel',
          'data-*', 'width', 'height'
        ],
        ALLOW_DATA_ATTR: true,
        // 외부 스타일 제거를 위해 style, class 속성 금지
        FORBID_ATTR: ['style', 'class'],
      });

      // 이미지 URL 정규화 (UUID 기반)
      const processedHtml = cleanHtml.replace(
        /<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi,
        (match: string, beforeSrc: string, originalSrc: string, afterSrc: string) => {
          try {
            const normalizedSrc = normalizeImageUrl(originalSrc);

            
            // crossorigin 속성 제거하여 CORS 문제 방지
            const cleanedAttributes = (beforeSrc + afterSrc)
              .replace(/crossorigin=["'][^"']*["']/gi, '')
              .replace(/\s+/g, ' ')
              .trim();
            
            return `<img ${cleanedAttributes} src="${normalizedSrc}" loading="lazy" style="max-width: 100%; height: auto;">`;
          } catch (error) {
            console.error('Error processing image URL:', error);
            return match; // 오류 시 원본 반환
          }
        }
      );

      return processedHtml;
    } catch (error) {
      console.error('Error processing content:', error);
      return htmlContent; // 오류 시 원본 반환
    }
  };

  const processedContent = processContent(content);

  return (
    <div 
      className={`prose prose-lg max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: processedContent }}
      style={{
        lineHeight: '1.7',
        fontSize: '16px',
      }}
    />
  );
} 