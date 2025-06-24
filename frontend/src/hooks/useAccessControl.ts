/**
 * Context7 권장 패턴: 백엔드 중심 권한 체크
 * 
 * 프론트엔드에서는 복잡한 권한 체크를 하지 않고
 * 백엔드의 403/401 응답에 의존하는 것이 좋습니다.
 * 
 * 이 훅은 더 이상 사용하지 않으며, 
 * 대신 API 호출 시 에러 처리로 권한을 체크합니다.
 * 
 * @deprecated 백엔드 중심 권한 체크로 교체됨
 */

import { useRouter } from 'next/navigation';

interface UseAccessControlOptions {
  redirectOnError?: boolean;
}

/**
 * Context7 권장: 최소한의 에러 처리만 제공
 * 실제 권한 체크는 백엔드에서 처리
 */
export function useAccessControl({ 
  redirectOnError = true 
}: UseAccessControlOptions = {}) {
  const router = useRouter();

  const handleAuthError = (error: any) => {
    if (error.response?.status === 401) {
      alert('로그인이 필요합니다.');
      if (redirectOnError) router.push('/login');
    } else if (error.response?.status === 403) {
      alert('권한이 없습니다.');
      if (redirectOnError) router.push('/');
    }
  };

  return {
    handleAuthError,
  };
} 