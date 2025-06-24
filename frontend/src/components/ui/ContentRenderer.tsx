"use client";

import React from 'react';
import DOMPurify from 'dompurify';
import { normalizeImageUrl } from '@/utils/imageUtils';
import { createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import { stripUnderline } from '@/utils/stripUnderline';
import { useImageModal } from '@/hooks/useImageModal';
import ImageModal from './ImageModal';

// lowlight 인스턴스 생성
const lowlight = createLowlight();
lowlight.register({ javascript, typescript, js: javascript, ts: typescript });

interface ContentRendererProps {
  content: string;
  className?: string;
}

// HTML 엔티티 디코딩
const decodeHtmlEntities = (text: string): string => {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");
};

// 안전한 클래스 필터링
const filterSafeClasses = (classNames: string): string => {
  return classNames
    .split(/\s+/)
    .filter(className => 
      className.startsWith('hljs') ||
      className.startsWith('language-') ||
      className.startsWith('editor-') ||
      ['code-block', 'code', 'pre'].includes(className)
    )
    .join(' ');
};

// 이미지 URL 처리 (클릭 가능하게 수정)
const processImageUrls = (html: string): string => {
  return html.replace(
    /<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi,
    (match, beforeSrc, originalSrc, afterSrc) => {
      try {
        const normalizedSrc = normalizeImageUrl(originalSrc);
        
        // width, height 속성 추출
        const widthMatch = match.match(/width=["']([^"']+)["']/);
        const heightMatch = match.match(/height=["']([^"']+)["']/);
        
        const cleanedAttributes = (beforeSrc + afterSrc)
          .replace(/crossorigin=["'][^"']*["']/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        // 스타일 속성 구성 (클릭 가능한 스타일 추가)
        let styleAttr = 'max-width: 100%; height: auto; cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease;';
        if (widthMatch) {
          styleAttr += ` width: ${widthMatch[1]}px;`;
        }
        if (heightMatch) {
          styleAttr += ` height: ${heightMatch[1]}px;`;
        }
        
        // 클릭 가능한 이미지로 변경 (data-clickable 속성 추가)
        return `<img ${cleanedAttributes} src="${normalizedSrc}" loading="lazy" style="${styleAttr}" data-clickable="true" class="content-image hover:transform hover:scale-105 hover:shadow-lg rounded-lg">`;
      } catch (error) {
        console.error('Error processing image URL:', error);
        return match;
      }
    }
  );
};

// 신택스 하이라이팅 적용
const applySyntaxHighlighting = (html: string): string => {
  return html.replace(
    /<pre class="hljs"><code class="language-(typescript|javascript|ts|js)">([\s\S]*?)<\/code><\/pre>/gi,
    (match, language, codeContent) => {
      try {
        const decodedCode = decodeHtmlEntities(codeContent);
        const mappedLanguage = language === 'ts' ? 'typescript' : language === 'js' ? 'javascript' : language;
        
        const result = lowlight.highlight(mappedLanguage, decodedCode);
        
        if (result?.children) {
          const highlightedHtml = result.children.map((child: any) => {
            if (child.type === 'text') return child.value;
            if (child.type === 'element') {
              const className = child.properties?.className?.join(' ') || '';
              const content = child.children?.map((c: any) => {
                if (c.type === 'text') return c.value;
                if (c.type === 'element') {
                  const childClass = c.properties?.className?.join(' ') || '';
                  const childContent = c.children?.map((cc: any) => cc.value || '').join('') || '';
                  return `<span class="${childClass}">${childContent}</span>`;
                }
                return '';
              }).join('') || '';
              return `<span class="${className}">${content}</span>`;
            }
            return '';
          }).join('');
          
          return `<pre class="hljs"><code class="language-${language}">${highlightedHtml}</code></pre>`;
        }
      } catch (error) {
        console.error('Failed to highlight code:', error);
      }
      
      return match;
    }
  );
};

/**
 * HTML 콘텐츠를 안전하게 렌더링하는 컴포넌트
 * - XSS 보안 처리 (DOMPurify)
 * - 이미지 URL 프록시 처리
 * - 코드 블록 신택스 하이라이팅
 * - 안전한 클래스만 허용
 * - 이미지 클릭으로 모달 열기 (커스텀 훅 활용)
 */
export default function ContentRenderer({ content, className = '' }: ContentRendererProps) {
  const { modalImage, isModalOpen, closeModal, handleImageClick } = useImageModal();

  const processContent = (htmlContent: string): string => {
    if (!htmlContent) return '';

    try {
      // 0. <u> 태그, underline 스타일 제거 (sanitize 전)
      let sanitizedHtml = stripUnderline(htmlContent);
      // 1. HTML 보안 처리
      const cleanHtml = DOMPurify.sanitize(sanitizedHtml, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'code', 'pre', 'span', 'div'
        ],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel', 'data-*', 'width', 'height', 'class'],
        ALLOW_DATA_ATTR: true,
        FORBID_ATTR: ['style'],
      });
      // 2. sanitize 후에도 혹시 남은 밑줄 제거
      let processedHtml = stripUnderline(cleanHtml);
      // 3. 이미지 URL 처리 (클릭 가능하게)
      processedHtml = processImageUrls(processedHtml);
      // 4. 안전한 클래스만 유지
      processedHtml = processedHtml.replace(/class=["']([^"']*?)["']/gi, (match, classNames) => {
        const safeClasses = filterSafeClasses(classNames);
        return safeClasses ? `class=\"${safeClasses}\"` : '';
      });
      // 5. 신택스 하이라이팅 적용
      processedHtml = applySyntaxHighlighting(processedHtml);
      return processedHtml;
    } catch (error) {
      console.error('Error processing content:', error);
      return htmlContent;
    }
  };

  const processedContent = processContent(content);

  return (
    <>
      <div 
        className={`prose prose-lg max-w-none ${className}`}
        dangerouslySetInnerHTML={{ __html: processedContent }}
        onClick={handleImageClick}
        style={{ lineHeight: '1.7', fontSize: '16px' }}
      />
      
      {/* 이미지 모달 */}
      <ImageModal
        src={modalImage?.src || ''}
        alt={modalImage?.alt || ''}
        title={modalImage?.title}
        isOpen={isModalOpen}
        onClose={closeModal}
      />
    </>
  );
} 