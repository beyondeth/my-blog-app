"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';

// 리팩토링된 훅들 사용
import { useUploadFile, validateImageFile } from '@/hooks/useFiles';
import { getProxyImageUrl, normalizeImageUrl, debugLog } from '@/utils/imageUtils';
import { getErrorMessage } from '@/utils/queryHelpers';
import EditorToolbar from './EditorToolbar';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onFilesChange?: (fileIds: string[]) => void;
  placeholder?: string;
  className?: string;
}

export default function BlogRichTextEditor({ 
  content, 
  onChange, 
  onFilesChange,
  placeholder = "내용을 입력하세요...",
  className = ""
}: RichTextEditorProps) {
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // 리팩토링된 파일 업로드 훅 사용
  const uploadMutation = useUploadFile();



  // 파일 업로드 핸들러
  const handleImageUpload = useCallback(async (file: File): Promise<string> => {
    try {
      setIsUploading(true);
      
      // 파일 검증
      const validation = validateImageFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const result = await uploadMutation.mutateAsync({ 
        file, 
        fileType: 'image' 
      });
      
      // 성공 시 파일 ID 추가
      const fileId = result.id.toString();
      setUploadedFiles(prev => {
        const newFiles = [...prev, fileId];
        onFilesChange?.(newFiles);
        return newFiles;
      });
      
      // 프록시 URL 생성
      const proxyUrl = result.fileKey 
        ? getProxyImageUrl(result.fileKey)
        : getProxyImageUrl(result.fileUrl);
      
      debugLog('Image upload completed', {
        originalUrl: result.fileUrl,
        fileKey: result.fileKey,
        proxyUrl: proxyUrl,
      });
      
      return proxyUrl || result.fileUrl;
    } catch (error) {
      debugLog('Image upload failed', error);
      
      // 사용자 친화적인 에러 처리
      const errorMessage = getErrorMessage(error);
      if (typeof window !== 'undefined') {
        alert(errorMessage);
      }
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, [uploadMutation, onFilesChange]);

  // TipTap 에디터 설정
  const editor = useEditor({
    extensions: [
      StarterKit,
      // 이미지 확장 - TipTap 공식 문서 권장 설정
      Image.configure({
        inline: true, // 텍스트와 함께 인라인으로 표시
        allowBase64: true, // base64 이미지 허용
        HTMLAttributes: {
          class: 'editor-image',
          style: 'max-width: 100%; height: auto; display: inline-block; margin: 4px 0; border-radius: 4px;',
          loading: 'lazy',
        },
      }),
      // 링크 확장
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'editor-link',
        },
      }),
      // 텍스트 스타일과 색상
      TextStyle,
      Color.configure({
        types: [TextStyle.name],
      }),
      // 플레이스홀더
      Placeholder.configure({
        placeholder: placeholder,
      }),
    ],
    content: '',
    // TipTap 공식 문서 권장: parseOptions 설정
    parseOptions: {
      preserveWhitespace: 'full',
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[300px] p-4',
      },
      handleDrop: (view, event, slice, moved) => {
        const files = Array.from(event.dataTransfer?.files || []);
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length > 0) {
          event.preventDefault();
          
          imageFiles.forEach(async (file) => {
            try {
              const imageUrl = await handleImageUpload(file);
              
              // TipTap 공식 문서 권장: setImage 명령어 사용
              editor?.chain().focus().setImage({ 
                src: imageUrl, 
                alt: file.name,
                title: file.name
              }).run();
            } catch (error) {
              console.error('Failed to upload dropped image:', error);
            }
          });
          
          return true;
        }
        
        return false;
      },
      handlePaste: (view, event, slice) => {
        const files = Array.from(event.clipboardData?.files || []);
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length > 0) {
          event.preventDefault();
          
          imageFiles.forEach(async (file) => {
            try {
              const imageUrl = await handleImageUpload(file);
              
              // TipTap 공식 문서 권장: setImage 명령어 사용
              editor?.chain().focus().setImage({ 
                src: imageUrl, 
                alt: file.name,
                title: file.name
              }).run();
    } catch (error) {
              console.error('Failed to upload pasted image:', error);
            }
          });
          
          return true;
        }
        
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
    },
  }, [onChange]);

  // 에디터 초기 콘텐츠 설정
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      // 에디터가 포커스되어 있지 않을 때만 내용 업데이트
      if (!editor.isFocused) {
        editor.commands.setContent(content);
      }
    }
  }, [editor, content]);

  // 이미지 업로드 트리거 (툴바에서 사용)
  const triggerImageUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const imageUrl = await handleImageUpload(file);
          editor?.chain().focus().setImage({ 
            src: imageUrl, 
            alt: file.name,
            title: file.name
          }).run();
        } catch (error) {
          console.error('Failed to upload image:', error);
        }
      }
    };
    input.click();
  }, [editor, handleImageUpload]);

  if (!editor) {
    return (
      <div className="border border-gray-300 rounded-md p-4 min-h-[300px] flex items-center justify-center">
        <div className="text-gray-500">에디터를 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className={`border border-gray-300 rounded-md ${className}`}>
      <EditorToolbar 
        editor={editor} 
        onImageUpload={triggerImageUpload}
        isUploading={isUploading}
      />
      <EditorContent editor={editor} />
      {isUploading && (
        <div className="p-2 bg-blue-50 border-t border-gray-300">
          <div className="flex items-center text-sm text-blue-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            이미지를 업로드하는 중...
        </div>
        </div>
      )}
    </div>
  );
}

// 컨텐츠에서 파일 ID 추출 함수 (기존 유지)
export const extractFileIdsFromContent = (htmlContent: string): string[] => {
    const fileIds: string[] = [];
  const imgRegex = /<img[^>]+src="[^"]*\/files\/([^"/]+)"/g;
  let match;
  
  while ((match = imgRegex.exec(htmlContent)) !== null) {
    fileIds.push(match[1]);
  }
    
  return fileIds;
}; 