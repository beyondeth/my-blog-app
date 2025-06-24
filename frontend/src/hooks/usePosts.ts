import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { postsAPI } from '@/lib/api';
import { Post } from '@/types';

// Query 키 팩토리 패턴
export const postQueryKeys = {
  all: ['posts'] as const,
  lists: () => [...postQueryKeys.all, 'list'] as const,
  list: (filters: { search?: string; category?: string }) => 
    [...postQueryKeys.lists(), filters] as const,
  details: () => [...postQueryKeys.all, 'detail'] as const,
  detail: (slugOrId: string | number) => [...postQueryKeys.details(), slugOrId] as const,
};

// 공통 쿼리 옵션
const commonQueryOptions = {
  gcTime: 10 * 60 * 1000, // 10분
  staleTime: 5 * 60 * 1000, // 5분
  refetchOnWindowFocus: false,
  retry: 1,
};

// 무한 스크롤 포스트 목록 훅
export function useInfinitePosts(options: { 
  search?: string; 
  category?: string;
  enabled?: boolean;
} = {}) {
  const { search, category, enabled = true } = options;
  
  return useInfiniteQuery({
    queryKey: postQueryKeys.list({ search, category }),
    queryFn: ({ pageParam = 1 }) => postsAPI.getPosts({ 
      page: pageParam, 
      limit: 10,
      search: search || undefined,
      category: category || undefined,
    }),
    getNextPageParam: (lastPage, allPages) => {
      const currentPage = allPages.length;
      const totalPages = Math.ceil(lastPage.total / 10);
      return currentPage < totalPages ? currentPage + 1 : undefined;
    },
    initialPageParam: 1,
    enabled,
    ...commonQueryOptions,
    refetchOnMount: false,
  });
}

// 단일 포스트 조회 훅 (상세)
export function usePost(slugOrId: string | number) {
  return useQuery({
    queryKey: postQueryKeys.detail(slugOrId),
    queryFn: () => postsAPI.getPostBySlug(slugOrId.toString()),
    enabled: !!slugOrId,
    ...commonQueryOptions,
    refetchOnMount: false, // SSR/Prefetch 활용 시 false가 더 효율적
  });
}

// 포스트 생성 뮤테이션 훅
export function useCreatePost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: postsAPI.createPost,
    onSuccess: (newPost) => {
      // 1. 모든 목록 쿼리 무효화 (검색, 카테고리 등 모든 필터 조건)
      queryClient.invalidateQueries({ queryKey: postQueryKeys.lists() });
      
      // 2. 무한 스크롤 쿼리의 첫 번째 페이지에 새 게시글 추가 (낙관적 업데이트)
      queryClient.setQueriesData(
        { queryKey: postQueryKeys.lists() },
        (oldData: any) => {
          if (!oldData || !oldData.pages) return oldData;
          
          // 첫 번째 페이지에 새 게시글을 맨 앞에 추가
          const newPages = [...oldData.pages];
          if (newPages[0]) {
            newPages[0] = {
              ...newPages[0],
              posts: [newPost, ...newPages[0].posts],
              total: newPages[0].total + 1,
            };
          }
          
          return {
            ...oldData,
            pages: newPages,
          };
        }
      );
      
      // 3. 생성된 게시글의 개별 캐시도 설정
      if (newPost.id) {
        queryClient.setQueryData(postQueryKeys.detail(newPost.id), newPost);
      }
      if (newPost.slug) {
        queryClient.setQueryData(postQueryKeys.detail(newPost.slug), newPost);
      }
    },
    retry: 1,
  });
}

// 포스트 수정 뮤테이션 훅
export function useUpdatePost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      postsAPI.updatePost(id, data),
    onSuccess: (updatedPost) => {
      // 개별 포스트 캐시 업데이트
      queryClient.setQueryData(postQueryKeys.detail(updatedPost.id), updatedPost);
      if (updatedPost.slug) {
        queryClient.setQueryData(postQueryKeys.detail(updatedPost.slug), updatedPost);
      }
      // 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: postQueryKeys.lists() });
    },
    retry: 1,
  });
}

// 포스트 삭제 뮤테이션 훅
export function useDeletePost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: postsAPI.deletePost,
    onSuccess: (_, deletedId) => {
      // 삭제된 포스트 캐시 제거
      queryClient.removeQueries({ queryKey: postQueryKeys.detail(deletedId) });
      // 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: postQueryKeys.lists() });
    },
    retry: 1,
  });
}

// 포스트 좋아요 토글 뮤테이션 훅
export function useTogglePostLike(slug: string | number) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (postId: number) => postsAPI.toggleLike(postId),
    onSuccess: (response, postId) => {
      // 낙관적 업데이트
      queryClient.setQueryData(postQueryKeys.detail(slug), (oldData: Post | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          likeCount: response.liked ? oldData.likeCount + 1 : oldData.likeCount - 1,
        };
      });
    },
    retry: 1,
  });
}

// 포스트 프리페치 유틸리티
export function usePrefetchPost() {
  const queryClient = useQueryClient();
  return (slugOrId: string | number) => {
    queryClient.prefetchQuery({
      queryKey: postQueryKeys.detail(slugOrId),
      queryFn: () => postsAPI.getPostBySlug(slugOrId.toString()),
      ...commonQueryOptions,
    });
  };
} 