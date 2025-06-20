import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

/**
 * 브라우저 뒤로가기와 캐시 관리를 위한 훅
 * @param options.enableRealtime - 실시간 기능 활성화 여부 (기본: true)
 */
export function useNavigationCache(options: { enableRealtime?: boolean } = {}) {
  const { enableRealtime = true } = options;
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    if (!enableRealtime) return;

    // 브라우저 뒤로가기/앞으로가기 감지
    const handlePopState = () => {
      // 캐시된 데이터가 있으면 즉시 표시
      // 새로운 데이터는 백그라운드에서 페치
      queryClient.invalidateQueries({ 
        queryKey: ['posts'],
        refetchType: 'none' // 즉시 리페치하지 않음
      });
    };

    // popstate 이벤트 리스너 등록
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [queryClient, enableRealtime]);

  // 페이지 가시성 변경 시 처리
  useEffect(() => {
    if (!enableRealtime) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // 페이지가 다시 보일 때만 stale 데이터 리페치
        queryClient.invalidateQueries({ 
          queryKey: ['posts'],
          refetchType: 'active' // 활성 쿼리만 리페치
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [queryClient, enableRealtime]);

  return {
    // 캐시 상태 확인
    getCacheStatus: (queryKey: string[]) => {
      const queryState = queryClient.getQueryState(queryKey);
      const now = Date.now();
      const staleTime = 5 * 60 * 1000; // 5분
      
      return {
        isCached: !!queryState?.data,
        isStale: queryState?.dataUpdatedAt ? (now - queryState.dataUpdatedAt) > staleTime : true,
        lastUpdated: queryState?.dataUpdatedAt,
      };
    },

    // 수동 캐시 무효화
    invalidateCache: (queryKey: string[]) => {
      queryClient.invalidateQueries({ queryKey });
    },

    // 캐시 프리페치
    prefetchData: async (queryKey: string[], queryFn: () => Promise<any>) => {
      await queryClient.prefetchQuery({
        queryKey,
        queryFn,
        gcTime: 10 * 60 * 1000, // 10분
        staleTime: 5 * 60 * 1000, // 5분
      });
    },
  };
} 