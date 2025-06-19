"use client";

import React, { useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import RichTextEditor, { BaseKit } from 'reactjs-tiptap-editor';
import { Image } from 'reactjs-tiptap-editor/image';
import { Bold } from 'reactjs-tiptap-editor/bold';
import { Italic } from 'reactjs-tiptap-editor/italic';
import { Strike } from 'reactjs-tiptap-editor/strike';
import { Heading } from 'reactjs-tiptap-editor/heading';
import { BulletList } from 'reactjs-tiptap-editor/bulletlist';
import { OrderedList } from 'reactjs-tiptap-editor/orderedlist';
import { Blockquote } from 'reactjs-tiptap-editor/blockquote';
import { CodeBlock } from 'reactjs-tiptap-editor/codeblock';
import { Link } from 'reactjs-tiptap-editor/link';
import 'reactjs-tiptap-editor/style.css';

// 기존 API 클라이언트 재사용
import { apiClient } from '../../lib/api';
import { getProxyImageUrl } from '../../utils/imageUtils';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onFilesChange?: (fileIds: string[]) => void;
  placeholder?: string;
  className?: string;
}

interface UploadResponse {
  id: number;
  fileUrl: string;
}

export default function BlogRichTextEditor({ 
  content, 
  onChange, 
  onFilesChange,
  placeholder = "내용을 입력하세요...",
  className = ""
}: RichTextEditorProps) {
  const queryClient = useQueryClient();
  const [uploadedFiles, setUploadedFiles] = React.useState<string[]>([]);

  // 파일 업로드 뮤테이션
  const uploadMutation = useMutation({
    mutationFn: async (file: File): Promise<UploadResponse> => {
      // 파일 검증
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('파일 크기는 10MB를 초과할 수 없습니다.');
      }

      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('지원되지 않는 파일 형식입니다. (JPEG, PNG, GIF, WebP만 허용)');
      }

      return await apiClient.uploadFile(file, 'image');
    },
    retry: 1,
    retryDelay: 1000,
    onSuccess: (result) => {
      // 성공 시 파일 ID 추가
      const fileId = result.id.toString();
      setUploadedFiles(prev => [...prev, fileId]);
      onFilesChange?.([...uploadedFiles, fileId]);
      
      // 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
    onError: (error) => {
      // 사용자 친화적인 에러 처리
      let errorMessage = '파일 업로드에 실패했습니다.';
      
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          errorMessage = '로그인이 필요합니다. 다시 로그인해주세요.';
        } else if (error.message.includes('413') || error.message.includes('too large')) {
          errorMessage = '파일 크기가 너무 큽니다. 10MB 이하의 파일을 선택해주세요.';
        } else if (error.message.includes('415') || error.message.includes('format')) {
          errorMessage = '지원되지 않는 파일 형식입니다.';
        } else if (error.message.includes('403')) {
          errorMessage = 'S3 권한 설정에 문제가 있습니다. 관리자에게 문의하세요.';
        } else if (error.message) {
          errorMessage = error.message;
        }
      }
      
      if (typeof window !== 'undefined') {
        alert(errorMessage);
      }
    },
  });

  // 개선된 업로드 함수
  const handleFileUpload = useCallback(async (file: File): Promise<string> => {
    try {
      const result = await uploadMutation.mutateAsync(file);
      const proxyUrl = getProxyImageUrl(result.fileUrl);
      return proxyUrl || result.fileUrl;
    } catch (error) {
      throw error; // 뮤테이션에서 이미 에러 처리됨
    }
  }, [uploadMutation]);

  // 에디터 확장 기능 설정
  const extensions = useMemo(() => [
    BaseKit.configure({
      placeholder: {
        placeholder: placeholder,
      },
    }),
    
    // 기본 텍스트 스타일링
    Bold,
    Italic,
    Strike,
    
    // 제목
    Heading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
    
    // 리스트
    BulletList,
    OrderedList,
    
    // 기타
    Blockquote,
    CodeBlock,
    Link,
    
    // 이미지 업로드 설정
    Image.configure({
      upload: handleFileUpload,
      acceptMimes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
      maxSize: 10 * 1024 * 1024, // 10MB
      resourceImage: 'upload', // 업로드만 허용
    }),
  ], [handleFileUpload, placeholder]);

  return (
    <div className={`border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800 ${className}`}>
      <RichTextEditor
        output="html"
        content={content}
        onChangeContent={onChange}
        extensions={extensions}
        dark={false}
      />
      
      {/* 업로드 상태 표시 */}
      {uploadMutation.isPending && (
        <div className="p-2 text-sm text-blue-600 bg-blue-50 border-t">
          파일 업로드 중...
        </div>
      )}
      
      {uploadMutation.isError && (
        <div className="p-2 text-sm text-red-600 bg-red-50 border-t flex justify-between items-center">
          <span>업로드 실패</span>
          <button 
            onClick={() => uploadMutation.reset()}
            className="text-xs underline hover:no-underline"
          >
            닫기
          </button>
        </div>
      )}
    </div>
  );
}

// 업로드된 파일들 정리 유틸리티 함수 (DOM 조작 제거)
export const extractFileIdsFromContent = (htmlContent: string): string[] => {
  if (typeof window === 'undefined') return [];
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    const fileIds: string[] = [];
    
    // 이미지에서 파일 ID 추출
    const images = doc.querySelectorAll('img[data-file-id]');
    images.forEach(img => {
      const fileId = img.getAttribute('data-file-id');
      if (fileId) fileIds.push(fileId);
    });
    
    // 첨부파일에서 파일 ID 추출
    const attachments = doc.querySelectorAll('[data-file-id]');
    attachments.forEach(attachment => {
      const fileId = attachment.getAttribute('data-file-id');
      if (fileId) fileIds.push(fileId);
    });
    
    return [...new Set(fileIds)]; // 중복 제거
  } catch (error) {
    return []; // 에러 시 빈 배열 반환
  }
}; 