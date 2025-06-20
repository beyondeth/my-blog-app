import { QueryClient } from '@tanstack/react-query';

// 기본 쿼리 클라이언트 설정
export const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5분
      gcTime: 10 * 60 * 1000, // 10분
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
});

// 공통 쿼리 옵션
export const commonQueryOptions = {
  gcTime: 10 * 60 * 1000,
  staleTime: 5 * 60 * 1000,
  refetchOnWindowFocus: false,
  retry: 1,
};

// 캐시 무효화 헬퍼
export const invalidatePostQueries = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: ['posts'] });
};

// 캐시 프리페치 헬퍼
export const prefetchPost = async (
  queryClient: QueryClient, 
  slug: string | number, 
  queryFn: () => Promise<any>
) => {
  await queryClient.prefetchQuery({
    queryKey: ['post', slug],
    queryFn,
    ...commonQueryOptions,
  });
};

// 에러 메시지 처리 헬퍼
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      return '로그인이 필요합니다. 다시 로그인해주세요.';
    } else if (error.message.includes('403')) {
      return 'S3 권한 설정에 문제가 있습니다. 관리자에게 문의하세요.';
    } else if (error.message.includes('404')) {
      return '요청한 리소스를 찾을 수 없습니다.';
    } else if (error.message.includes('413') || error.message.includes('too large')) {
      return '파일 크기가 너무 큽니다. 10MB 이하의 파일을 선택해주세요.';
    } else if (error.message.includes('415') || error.message.includes('format')) {
      return '지원되지 않는 파일 형식입니다.';
    } else if (error.message) {
      return error.message;
    }
  }
  return '알 수 없는 오류가 발생했습니다.';
};

// 뮤테이션 옵션 팩토리
export const createMutationOptions = <T, E = Error>(
  onSuccess?: (data: T) => void,
  onError?: (error: E) => void
) => ({
  retry: 1,
  retryDelay: 1000,
  onSuccess,
  onError: (error: E) => {
    console.error('Mutation error:', error);
    onError?.(error);
  },
}); 