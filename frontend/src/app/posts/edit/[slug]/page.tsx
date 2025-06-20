"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api';
import { FiEdit3, FiType, FiAlignLeft, FiImage } from 'react-icons/fi';
import BlogRichTextEditor from '@/components/posts/RichTextEditor';
import { getProxyImageUrl } from '@/utils/imageUtils';

// 디버그 모드 설정
const DEBUG_MODE = process.env.NODE_ENV === 'development';
const debugLog = (message: string, data?: any) => {
  if (DEBUG_MODE) {
    console.log(message, data || '');
  }
};

export default function EditPostPage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [attachedFileIds, setAttachedFileIds] = useState<string[]>([]);
  const [isFormInitialized, setIsFormInitialized] = useState(false); // 폼 초기화 상태 추적
  
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const slugOrId = params.slug as string;

  // slug인지 ID인지 판단 (숫자면 ID, 아니면 slug)
  const isNumericId = /^\d+$/.test(slugOrId);
  
  // 게시글 데이터 조회 - 통합된 로직으로 ID와 slug 모두 처리
  const { data: post, isLoading: isLoadingPost, error: postError } = useQuery({
    queryKey: ['post-edit', slugOrId],
    queryFn: async () => {
      let result;
      
      try {
        if (isNumericId) {
          debugLog('🔍 [UNIFIED EDIT] Loading post by ID:', slugOrId);
          result = await apiClient.getPost(parseInt(slugOrId));
          debugLog('📋 [UNIFIED EDIT] Post loaded by ID:', {
            id: result.id,
            title: result.title,
            slug: result.slug,
            hasContent: !!result.content,
          });
        } else {
          debugLog('🔍 [UNIFIED EDIT] Loading post by slug:', slugOrId);
          // slug로 먼저 조회해서 ID를 얻은 다음 ID로 재조회 (수정 권한 체크를 위해)
          const slugResult = await apiClient.getPostBySlug(slugOrId);
          debugLog('🔄 [UNIFIED EDIT] Got post from slug, re-fetching by ID for edit mode:', slugResult.id);
          result = await apiClient.getPost(slugResult.id);
          debugLog('📋 [UNIFIED EDIT] Post loaded by slug->ID:', {
            id: result.id,
            title: result.title,
            slug: result.slug,
            hasContent: !!result.content,
          });
        }
        
        debugLog('📦 [UNIFIED EDIT] Final post data for editing:', {
          id: result.id,
          title: result.title,
          slug: result.slug,
          contentLength: result.content?.length || 0,
          hasContent: !!result.content,
          attachedFilesCount: result.attachedFiles?.length || 0,
          isPublished: result.isPublished,
          authorId: result.author?.id,
          canEdit: result.author?.id === user?.id || user?.role === 'admin',
        });
        
        return result;
      } catch (error) {
        console.error('❌ [UNIFIED EDIT] Failed to load post:', {
          slugOrId,
          isNumericId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
    enabled: !!slugOrId && !!user,
    retry: 1, // 한 번만 재시도
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    refetchOnWindowFocus: false, // 윈도우 포커스 시 재요청 방지
  });

  // 게시글 수정 뮤테이션
  const updatePostMutation = useMutation({
    mutationFn: (updateData: any) => {
      // post.id를 사용하여 수정 (ID는 항상 필요)
      if (!post?.id) {
        throw new Error('게시글 ID를 찾을 수 없습니다.');
      }
      console.log('📝 [UNIFIED EDIT] Updating post with ID:', post.id);
      return apiClient.updatePost(post.id, updateData);
    },
    onSuccess: (updatedPost) => {
      console.log('✅ [UNIFIED EDIT] Post updated successfully:', {
        id: updatedPost.id,
        title: updatedPost.title,
        slug: updatedPost.slug,
      });
      
      // 캐시 업데이트 - 모든 가능한 키로 업데이트
      queryClient.setQueryData(['post-edit', slugOrId], updatedPost);
      queryClient.setQueryData(['post', updatedPost.id], updatedPost);
      if (updatedPost.slug) {
        queryClient.setQueryData(['post', updatedPost.slug], updatedPost);
      }
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      
      // 상세 페이지로 이동 (slug 우선, 없으면 ID)
      const redirectPath = updatedPost.slug || updatedPost.id;
      console.log('🔄 [UNIFIED EDIT] Redirecting to:', `/posts/${redirectPath}`);
      router.push(`/posts/${redirectPath}`);
    },
    onError: (error: any) => {
      console.error('❌ [UNIFIED EDIT] Update failed:', error);
      setError(error.message || '게시글 수정에 실패했습니다.');
    },
  });

  // 게시글 데이터가 로드되면 폼에 설정 (한 번만 실행)
  useEffect(() => {
    if (post && !isFormInitialized) { // 폼이 초기화되지 않은 경우에만 실행
      debugLog('📄 [UNIFIED EDIT] Post data loaded for form:', {
        id: post.id,
        title: post.title,
        contentLength: post.content?.length || 0,
        category: post.category,
        slug: post.slug,
        attachedFiles: post.attachedFiles?.length || 0,
        accessMethod: isNumericId ? 'by-id' : 'by-slug',
      });
      
      setTitle(post.title || '');
      setCategory(post.category || '');
      
      // 첨부된 파일 ID들 설정 (있다면)
              if (post.attachedFiles && post.attachedFiles.length > 0) {
                  const fileIds = post.attachedFiles.map(file => file.id.toString());
        debugLog('📎 [UNIFIED EDIT] Setting attached file IDs:', fileIds);
        setAttachedFileIds(fileIds);
      } else {
        debugLog('📎 [UNIFIED EDIT] No attached files found');
        setAttachedFileIds([]);
      }
      
      // 게시글 내용 설정 - 첨부된 이미지들을 내용에 자동 삽입
      let processedContent = post.content || '';
      
      // 첨부된 이미지 파일들을 내용에 자동 추가 (편집 가능하도록)
      if (post.attachedFiles && post.attachedFiles.length > 0) {
        const imageFiles = post.attachedFiles.filter(file => file.fileType === 'image');
        
        if (imageFiles.length > 0) {
          debugLog('🖼️ [UNIFIED EDIT] Found attached images:', imageFiles.length);
          
          // 내용에 이미지가 없는 경우에만 자동 추가
          const hasImagesInContent = /<img[^>]*>/i.test(processedContent);
          
          if (!hasImagesInContent) {
            debugLog('🔄 [UNIFIED EDIT] No images in content, auto-adding attached images for editing');
            
            // 이미지들을 HTML로 변환하여 내용에 추가 (편집 가능하도록)
            const imageHtml = imageFiles.map(file => {
              const imageUrl = getProxyImageUrl(file.fileKey) || getProxyImageUrl(file.fileUrl) || file.fileUrl;
              return `<p><img src="${imageUrl}" alt="${file.originalName}" style="max-width: 100%; height: auto;" data-file-id="${file.id}" /></p>`;
            }).join('\n');
            
            // 기존 내용이 있으면 적절한 위치에, 없으면 이미지만 추가
            if (processedContent.trim()) {
              // 내용이 있으면 중간에 삽입할 수 있도록 앞에 추가
              processedContent = imageHtml + '\n\n' + processedContent;
            } else {
              processedContent = imageHtml;
            }
            
            debugLog('✅ [UNIFIED EDIT] Images auto-added to content for editing');
          } else {
            debugLog('ℹ️ [UNIFIED EDIT] Images already exist in content');
            
            // 기존 이미지들의 URL을 프록시 URL로 업데이트
            processedContent = processedContent.replace(
              /<img([^>]*?)src="([^"]*)"([^>]*?)>/g,
              (match, beforeSrc, srcUrl, afterSrc) => {
                const normalizedUrl = getProxyImageUrl(srcUrl) || srcUrl;
                const spaceBefore = beforeSrc && !beforeSrc.endsWith(' ') ? ' ' : '';
                return `<img${beforeSrc}${spaceBefore}src="${normalizedUrl}"${afterSrc}>`;
              }
            );
            debugLog('✅ [UNIFIED EDIT] Updated existing image URLs to proxy URLs');
          }
        }
      }
      
      debugLog('🔄 [UNIFIED EDIT] Final processed content:', {
        contentLength: processedContent.length,
        hasImages: processedContent.includes('<img'),
        imageCount: (processedContent.match(/<img/g) || []).length,
        contentPreview: processedContent.substring(0, 200) + (processedContent.length > 200 ? '...' : '')
      });
      
      setContent(processedContent);
      setIsFormInitialized(true); // 폼 초기화 완료 표시
    }
  }, [post?.id, isFormInitialized]); // post 객체 대신 post.id만 의존성으로 사용

  // 권한 체크 통합 - 한 번의 useEffect로 처리
  useEffect(() => {
    // 로그인 체크
    if (!user) {
      router.push('/login');
      return;
    }

    // 게시글과 권한 체크 (post가 로드된 후)
    if (post && post.author?.id) {
      const canEdit = post.author.id === user.id || user.role === 'admin';
      
      debugLog('🔐 [UNIFIED EDIT] Checking edit permissions:', {
        postAuthorId: post.author.id,
        currentUserId: user.id,
        userRole: user.role,
        canEdit,
      });
      
      if (!canEdit) {
        alert('수정 권한이 없습니다.');
        router.push('/');
        return;
      }
    }
  }, [user?.id, user?.role, post?.id, post?.author?.id, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    console.log('💾 [UNIFIED EDIT] Submitting post update:', {
      postId: post?.id,
      title: title.substring(0, 50) + (title.length > 50 ? '...' : ''),
      contentLength: content.length,
      category: category || 'none',
      accessMethod: isNumericId ? 'by-id' : 'by-slug',
    });

    updatePostMutation.mutate({
      title,
      content,
      category: category || undefined,
      // attachedFiles: attachedFileIds, // TODO: 백엔드에서 파일 연결 지원 시 추가
    });
  };

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
  }, []);

  const handleFilesChange = useCallback((fileIds: string[]) => {
    setAttachedFileIds(fileIds);
  }, []);

  // 로딩 상태
  if (!user || isLoadingPost) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            {!user ? '로그인 확인 중...' : '게시글 로딩 중...'}
          </p>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (postError) {
    console.error('❌ [UNIFIED EDIT] Post loading error:', {
      slugOrId,
      isNumericId,
      error: postError,
    });
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">
            게시글을 불러올 수 없습니다
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {isNumericId ? `ID: ${slugOrId}` : `Slug: ${slugOrId}`}로 접근 시도
          </p>
          <p className="text-sm text-gray-500 mb-6">
            {(postError as any)?.message || '게시글이 존재하지 않거나 권한이 없습니다.'}
          </p>
          <div className="space-x-3">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              이전 페이지
            </button>
            <button
              onClick={() => router.push('/posts')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              게시글 목록
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <FiEdit3 className="mr-3 h-6 w-6" />
              게시글 수정
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              통합된 편집기로 ID 또는 slug를 통해 게시글을 수정할 수 있습니다.
            </p>
            {post && (
              <div className="mt-2 text-xs text-gray-500">
                <p>
                  수정 중: <span className="font-medium">{post.title}</span> 
                  <span className="ml-2">(ID: {post.id})</span>
                  {post.slug && <span className="ml-2">(Slug: {post.slug})</span>}
                  <span className="ml-2">({isNumericId ? 'ID로 접근' : 'Slug로 접근'})</span>
                </p>
                {post.attachedFiles && post.attachedFiles.length > 0 && (
                  <p className="mt-1 text-blue-600">
                    📎 첨부 파일 {post.attachedFiles.length}개 (이미지는 자동으로 내용에 포함됨)
                  </p>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <FiType className="inline mr-2 h-4 w-4" />
                제목
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="멋진 제목을 입력하세요"
              />
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                카테고리 (선택사항)
              </label>
              <input
                id="category"
                name="category"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="예: 개발, 일상, 리뷰 등"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <FiAlignLeft className="inline mr-2 h-4 w-4" />
                내용
              </label>
              
              <BlogRichTextEditor
                content={content}
                onChange={handleContentChange}
                onFilesChange={handleFilesChange}
                className="min-h-[500px]"
              />
              
              {/* 첨부된 이미지 파일들 표시 */}
              {post?.attachedFiles && post.attachedFiles.length > 0 && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                    <FiImage className="mr-2 h-4 w-4" />
                    첨부된 파일들 ({post.attachedFiles.length}개)
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {post.attachedFiles.map((file) => (
                      <div key={file.id} className="text-xs">
                                                 {file.fileType === 'image' ? (
                           <div className="relative group">
                             <img 
                               src={getProxyImageUrl(file.fileKey) || getProxyImageUrl(file.fileUrl) || file.fileUrl}
                               alt={file.originalName}
                               className="w-full h-20 object-cover rounded border hover:opacity-90 transition-opacity"
                               onError={(e) => {
                                 const target = e.target as HTMLImageElement;
                                 const fallbackUrl = getProxyImageUrl(file.fileUrl);
                                 console.log('🖼️ [EDIT PAGE] Image load failed, trying fallback:', {
                                   originalSrc: target.src,
                                   fallbackSrc: fallbackUrl,
                                   fileKey: file.fileKey,
                                   proxyFromKey: getProxyImageUrl(file.fileKey),
                                   proxyFromUrl: getProxyImageUrl(file.fileUrl),
                                 });
                                 if (fallbackUrl && target.src !== fallbackUrl) {
                                   target.src = fallbackUrl;
                                 }
                               }}
                             />
                            <div className="mt-1 text-gray-600 dark:text-gray-400 truncate" title={file.originalName}>
                              {file.originalName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {Math.round(file.fileSize / 1024)}KB
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 border rounded bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors">
                            <div className="font-medium text-gray-700 dark:text-gray-300 truncate" title={file.originalName}>
                              {file.originalName}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {file.fileType} • {Math.round(file.fileSize / 1024)}KB
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 flex items-center space-x-4">
                <span className="flex items-center">
                  <FiImage className="mr-1 h-4 w-4" />
                  이미지/파일을 드래그하거나 툴바에서 업로드하세요
                </span>
                {attachedFileIds.length > 0 && (
                  <span className="text-blue-600 dark:text-blue-400">
                    새로 첨부된 파일: {attachedFileIds.length}개
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  콘텐츠 길이: {content.length}자
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                취소
              </button>
              
              <button
                type="submit"
                disabled={updatePostMutation.isPending || !title.trim() || !content.trim()}
                className="px-8 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {updatePostMutation.isPending ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    수정 중...
                  </span>
                ) : (
                  '수정하기'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 