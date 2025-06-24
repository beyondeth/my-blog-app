import { useQuery } from '@tanstack/react-query';
import { postsAPI } from '@/lib/api';

export function usePost(slug: string | number) {
  return useQuery({
    queryKey: ['posts', 'detail', slug],
    queryFn: () => postsAPI.getPostBySlug(slug.toString()),
    enabled: !!slug,
    refetchOnMount: true, // 항상 최신 데이터
    staleTime: 0,
  });
} 