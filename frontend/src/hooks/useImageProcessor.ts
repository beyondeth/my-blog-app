import { useMemo } from 'react';
import { getProxyImageUrl } from '@/utils/imageUtils';

interface AttachedFile {
  id: number;
  fileKey: string;
  fileUrl: string;
  originalName: string;
  fileType: string;
}

interface UseImageProcessorOptions {
  content?: string;
  attachedFiles?: AttachedFile[];
}

/**
 * Context7 권장 패턴: 목적별로 분리된 커스텀 훅
 * 이미지 처리와 컨텐츠 전처리를 담당하는 훅
 */
export function useImageProcessor({ content = '', attachedFiles = [] }: UseImageProcessorOptions) {
  
  // Context7 권장: useMemo로 비싼 연산 최적화
  const processedContent = useMemo(() => {
    if (!content && !attachedFiles.length) return '';
    
    let processedContent = content || '';
    
    // 첨부된 이미지 파일들을 내용에 자동 추가 (편집 가능하도록)
    if (attachedFiles.length > 0) {
      const imageFiles = attachedFiles.filter(file => file.fileType === 'image');
      
      if (imageFiles.length > 0) {
        console.log('🖼️ [IMAGE PROCESSOR] Found attached images:', imageFiles.length);
        
        // 내용에 이미지가 없는 경우에만 자동 추가
        const hasImagesInContent = /<img[^>]*>/i.test(processedContent);
        
        if (!hasImagesInContent) {
          console.log('🔄 [IMAGE PROCESSOR] Auto-adding attached images for editing');
          
          // 이미지들을 HTML로 변환하여 내용에 추가
          const imageHtml = imageFiles.map(file => {
            const imageUrl = getProxyImageUrl(file.fileKey) || getProxyImageUrl(file.fileUrl) || file.fileUrl;
            return `<p><img src="${imageUrl}" alt="${file.originalName}" style="max-width: 100%; height: auto;" data-file-id="${file.id}" /></p>`;
          }).join('\n');
          
          // 기존 내용이 있으면 적절한 위치에, 없으면 이미지만 추가
          if (processedContent.trim()) {
            processedContent = imageHtml + '\n\n' + processedContent;
          } else {
            processedContent = imageHtml;
          }
          
          console.log('✅ [IMAGE PROCESSOR] Images auto-added to content for editing');
        } else {
          // 기존 이미지들의 URL을 프록시 URL로 업데이트
          processedContent = processedContent.replace(
            /<img([^>]*?)src="([^"]*)"([^>]*?)>/g,
            (match, beforeSrc, srcUrl, afterSrc) => {
              const normalizedUrl = getProxyImageUrl(srcUrl) || srcUrl;
              const spaceBefore = beforeSrc && !beforeSrc.endsWith(' ') ? ' ' : '';
              return `<img${beforeSrc}${spaceBefore}src="${normalizedUrl}"${afterSrc}>`;
            }
          );
          console.log('✅ [IMAGE PROCESSOR] Updated existing image URLs to proxy URLs');
        }
      }
    }
    
    return processedContent;
  }, [content, attachedFiles]); // Context7 권장: 최소한의 의존성만 포함

  // Context7 권장: useMemo로 첨부 파일 ID 목록 최적화
  const attachedFileIds = useMemo(() => {
    return attachedFiles.map(file => file.id.toString());
  }, [attachedFiles]);

  // Context7 권장: useMemo로 이미지 파일 필터링 최적화
  const imageFiles = useMemo(() => {
    return attachedFiles.filter(file => file.fileType === 'image');
  }, [attachedFiles]);

  return {
    processedContent,
    attachedFileIds,
    imageFiles,
    hasImages: imageFiles.length > 0,
    hasImagesInContent: /<img[^>]*>/i.test(processedContent),
  };
} 