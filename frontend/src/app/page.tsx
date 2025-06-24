"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useInfinitePosts, useDeletePost } from '@/hooks/usePosts';
import { createSearchUrl, parseSearchParams } from '@/lib/navigation';
import { useNavigationCache } from '@/hooks/useNavigationCache';

import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import PostArticle from '@/components/posts/PostArticle';
import LoadMoreSection from '@/components/posts/LoadMoreSection';
import SearchSection from '@/components/layout/SearchSection';
import RecentPostsSection from '@/components/layout/RecentPostsSection';
import TagsSection from '@/components/layout/TagsSection';
import ProfileSection from '@/components/layout/ProfileSection';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';

// 클라이언트 사이드 체크 훅 - Context7 모범 사례 적용
function useIsClient() {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    // 이미 클라이언트인 경우 중복 실행 방지
    if (typeof window !== 'undefined') {
      setIsClient(true);
    }
  }, []); // 빈 의존성 배열로 한 번만 실행
  
  return isClient;
}

export default function HomePage() {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();
  const isClient = useIsClient();
  const searchParams = useSearchParams();
  const { getCacheStatus } = useNavigationCache();
  
  // 삭제 다이얼로그 상태
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    postId: number | null;
    postTitle: string;
  }>({
    isOpen: false,
    postId: null,
    postTitle: ''
  });
  
  // URL에서 검색 파라미터 파싱
  const currentParams = isClient ? parseSearchParams(searchParams.toString()) : { page: 1 };
  const [searchQuery, setSearchQuery] = useState(currentParams.search || '');

  // 커스텀 훅 사용
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useInfinitePosts({ 
    search: currentParams.search,
    enabled: isClient 
  });

  const deletePostMutation = useDeletePost();

  // 모든 포스트 플래튼 - 메모이제이션
  const allPosts = useMemo(() => {
    return data?.pages.flatMap(page => page.posts) || [];
  }, [data?.pages]);

  const totalPosts = useMemo(() => {
    return data?.pages[0]?.total || 0;
  }, [data?.pages]);

  // 최근 포스트 (처음 5개) - 메모이제이션
  const recentPosts = useMemo(() => {
    return allPosts.slice(0, 5);
  }, [allPosts]);

  // 태그 추출 (간단한 예시) - 메모이제이션
  const tags = useMemo(() => {
    return ['JavaScript', 'React', 'Node.js', 'TypeScript', 'Next.js'];
  }, []);

  const loadMorePosts = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // 검색 처리 (URL 업데이트 포함)
  const handleSearch = useCallback((query: string) => {
    const newParams = {
      search: query || undefined,
      page: 1,
    };
    
    const newUrl = createSearchUrl(newParams);
    router.push(newUrl);
  }, [router]);

  // 검색어 변경 시 URL 파라미터와 동기화 - Context7 모범 사례: 조건부 실행
  useEffect(() => {
    if (!isClient) return;
    
    const urlSearch = currentParams.search || '';
    if (searchQuery !== urlSearch) {
      setSearchQuery(urlSearch);
    }
  }, [currentParams.search, isClient]); // searchQuery 의존성 제거로 무한 루프 방지

  const handleEditPost = useCallback((slug: string) => {
    router.push(`/posts/edit/${slug}`);
  }, [router]);

  // 삭제 다이얼로그 열기
  const handleDeletePost = useCallback((id: number) => {
    const post = allPosts.find(p => p.id === id);
    setDeleteDialog({
      isOpen: true,
      postId: id,
      postTitle: post?.title || '게시글'
    });
  }, [allPosts]);

  // 삭제 확인
  const handleConfirmDelete = useCallback(() => {
    if (deleteDialog.postId) {
      deletePostMutation.mutate(deleteDialog.postId, {
        onSuccess: () => {
          setDeleteDialog({ isOpen: false, postId: null, postTitle: '' });
        },
        onError: () => {
          // 에러 시에도 다이얼로그는 열어둠 (재시도 가능)
        }
      });
    }
  }, [deleteDialog.postId, deletePostMutation]);

  // 삭제 다이얼로그 닫기
  const handleCloseDeleteDialog = useCallback(() => {
    if (!deletePostMutation.isPending) {
      setDeleteDialog({ isOpen: false, postId: null, postTitle: '' });
    }
  }, [deletePostMutation.isPending]);

  if (!isClient) {
    return <LoadingSpinner message="페이지를 불러오는 중..." />;
  }

  if (error) {
    return (
      <ErrorMessage 
        message={`오류가 발생했습니다: ${error.message}`}
        showBackButton={false}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
          {/* Main Content Area */}
        <main className="flex-1 lg:max-w-[calc(100%-380px)] min-w-0">
          <div className="space-y-0">
            {isLoading && allPosts.length === 0 ? (
              <div className="flex justify-center items-center py-12 sm:py-16">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-amber-600"></div>
                <span className="ml-2 text-sm text-gray-600">게시글을 불러오는 중...</span>
              </div>
            ) : allPosts.length > 0 ? (
              <>
                {allPosts.map((post) => (
                  <PostArticle
                    key={post.id}
                    post={post}
                    isAdmin={isAdmin}
                    isAuthenticated={isAuthenticated}
                    userId={user?.id}
                    onEdit={handleEditPost}
                    onDelete={handleDeletePost}
                    isDeleting={deletePostMutation.isPending && deleteDialog.postId === post.id}
                  />
                ))}
                
                <LoadMoreSection
                  hasNextPage={hasNextPage}
                  isFetchingNextPage={isFetchingNextPage}
                  totalPosts={totalPosts}
                  allPostsCount={allPosts.length}
                  onLoadMore={loadMorePosts}
                />
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p className="text-sm sm:text-base">아직 포스트가 없습니다.</p>
              </div>
            )}
          </div>
          </main>

          {/* Sidebar */}
        <aside className="w-full lg:w-80 lg:min-w-[320px] space-y-4 sm:space-y-6">
          <SearchSection
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onSearch={handleSearch}
          />
          
          <RecentPostsSection posts={recentPosts} />
          
          <TagsSection tags={tags} />
          
          <ProfileSection />
          </aside>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <DeleteConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        isLoading={deletePostMutation.isPending}
        itemName={`"${deleteDialog.postTitle}" 게시글`}
        title="게시글을 삭제하시겠습니까?"
        description={`"${deleteDialog.postTitle}" 게시글이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`}
      />
    </div>
  );
}
