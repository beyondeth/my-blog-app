import { useCallback, useMemo } from 'react';
import { useQuery, UseQueryOptions } from '@tanstack/react-query';

/**
 * Context7 권장 패턴: React Query 최적화
 * 안정적인 참조와 메모이제이션을 보장하는 커스텀 훅
 */
export function useOptimizedQuery<TData, TError = unknown>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) {
  // Context7 권장: queryKey 메모이제이션
  const memoizedQueryKey = useMemo(() => queryKey, [queryKey]);
  
  // Context7 권장: queryFn 메모이제이션
  const memoizedQueryFn = useCallback(queryFn, [queryFn]);

  return useQuery({
    queryKey: memoizedQueryKey,
    queryFn: memoizedQueryFn,
    ...options,
  });
} 