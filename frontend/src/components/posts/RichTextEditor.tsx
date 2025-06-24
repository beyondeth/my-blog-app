"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';

// 리팩토링된 훅들 사용
import { useUploadFile, validateImageFile } from '@/hooks/useFiles';
import { getProxyImageUrl, normalizeImageUrl, debugLog } from '@/utils/imageUtils';
import { getErrorMessage } from '@/utils/queryHelpers';
import EditorToolbar from './EditorToolbar';
import { stripUnderline } from '@/utils/stripUnderline';

// lowlight 인스턴스 생성 및 언어 등록 - Context7 권장사항
const lowlight = createLowlight(common);
lowlight.register({ javascript, typescript, js: javascript, ts: typescript });

// 커스텀 이미지 확장 - 리사이징 지원
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: element => element.getAttribute('width'),
        renderHTML: attributes => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        },
      },
      height: {
        default: null,
        parseHTML: element => element.getAttribute('height'),
        renderHTML: attributes => {
          if (!attributes.height) return {};
          return { height: attributes.height };
        },
      },
    };
  },

  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const container = document.createElement('div');
      container.className = 'image-resizer';
      container.style.cssText = `
        position: relative;
        display: inline-block;
        max-width: 100%;
        margin: 8px 0;
      `;

      const img = document.createElement('img');
      Object.assign(img, HTMLAttributes);
      img.src = node.attrs.src;
      img.alt = node.attrs.alt || '';
      img.title = node.attrs.title || '';
      img.className = 'editor-image';
      img.style.cssText = `
        max-width: 100%;
        height: auto;
        border-radius: 4px;
        cursor: pointer;
        ${node.attrs.width ? `width: ${node.attrs.width}px;` : ''}
        ${node.attrs.height ? `height: ${node.attrs.height}px;` : ''}
      `;

      // 리사이즈 핸들
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'resize-handle';
      resizeHandle.style.cssText = `
        position: absolute;
        bottom: 0;
        right: 0;
        width: 12px;
        height: 12px;
        background: #3b82f6;
        cursor: se-resize;
        border-radius: 2px;
        opacity: 0;
        transition: opacity 0.2s;
      `;

      // 마우스 호버 시 리사이즈 핸들 표시
      container.addEventListener('mouseenter', () => {
        resizeHandle.style.opacity = '1';
      });
      container.addEventListener('mouseleave', () => {
        resizeHandle.style.opacity = '0';
      });

      // 리사이즈 기능
      let isResizing = false;
      let startX = 0;
      let startY = 0;
      let startWidth = 0;
      let startHeight = 0;

      resizeHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = img.offsetWidth;
        startHeight = img.offsetHeight;
        
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
      });

      const handleResize = (e: MouseEvent) => {
        if (!isResizing) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        const newWidth = Math.max(100, startWidth + deltaX);
        const aspectRatio = startHeight / startWidth;
        const newHeight = newWidth * aspectRatio;
        
        img.style.width = `${newWidth}px`;
        img.style.height = `${newHeight}px`;
      };

      const stopResize = () => {
        if (!isResizing) return;
        isResizing = false;
        
        const newWidth = img.offsetWidth;
        const newHeight = img.offsetHeight;
        
        // TipTap 노드 업데이트
        if (typeof getPos === 'function') {
          editor.chain()
            .setNodeSelection(getPos())
            .updateAttributes('image', {
              width: newWidth,
              height: newHeight,
            })
            .run();
        }
        
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
      };

      container.appendChild(img);
      container.appendChild(resizeHandle);

      return {
        dom: container,
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'image') return false;
          
          img.src = updatedNode.attrs.src;
          img.alt = updatedNode.attrs.alt || '';
          img.title = updatedNode.attrs.title || '';
          
          if (updatedNode.attrs.width) {
            img.style.width = `${updatedNode.attrs.width}px`;
          }
          if (updatedNode.attrs.height) {
            img.style.height = `${updatedNode.attrs.height}px`;
          }
          
          return true;
        },
      };
    };
  },
});

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

  // onChange 핸들러를 useCallback으로 메모이제이션
  const handleEditorUpdate = useCallback((html: string) => {
    onChange(html);
  }, [onChange]);

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

  // TipTap 에디터 설정 - onChange 의존성 제거로 성능 최적화
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // StarterKit의 기본 codeBlock을 비활성화하여 CodeBlockLowlight와 충돌 방지
        codeBlock: false,
      }),
      // 이미지 확장 - TipTap 공식 문서 권장 설정
      ResizableImage.configure({
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
      // 텍스트 정렬 - Context7 권장 설정
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
        defaultAlignment: null,
      }),
      // 코드 블록 하이라이팅 - Context7 권장 설정
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'hljs',
        },
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
        // 텍스트/HTML 붙여넣기 시 밑줄 제거
        if (event.clipboardData?.types.includes('text/html')) {
          event.preventDefault();
          const html = event.clipboardData.getData('text/html');
          const sanitized = stripUnderline(html);
          editor?.commands.insertContent(sanitized);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      handleEditorUpdate(html);
    },
  }, []); // 의존성 배열을 빈 배열로 변경하여 성능 최적화

  // onChange 핸들러 업데이트를 위한 별도 useEffect
  useEffect(() => {
    if (editor) {
      // 기존 onUpdate 핸들러 제거 후 새로운 핸들러 등록
      editor.off('update');
      editor.on('update', ({ editor }) => {
        const html = editor.getHTML();
        handleEditorUpdate(html);
      });
    }
  }, [editor, handleEditorUpdate]);

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