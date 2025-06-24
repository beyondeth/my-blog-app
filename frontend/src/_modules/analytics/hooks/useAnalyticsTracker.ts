// [ANALYTICS MODULE DISABLED FOR DEV PERFORMANCE]
/*
// 분석 추적용 React 훅
import { useEffect, useCallback, useRef } from 'react';
import { useAnalytics } from '../core/analytics';
import { TrackingEvent } from '../types';

interface UseAnalyticsTrackerOptions {
  trackPageView?: boolean;
  trackScrollDepth?: boolean;
  trackReadingTime?: boolean;
  autoTrack?: boolean;
}

export default function useAnalyticsTracker(
  pageId: string,
  options: UseAnalyticsTrackerOptions = {}
) {
  const analytics = useAnalytics();
  const startTimeRef = useRef<number>(0);
  const isTrackingRef = useRef<boolean>(false);

  const {
    trackPageView = false,
    trackScrollDepth = true,
    trackReadingTime = false,
    autoTrack = true,
  } = options;

  // 페이지 방문 추적
  useEffect(() => {
    if (autoTrack && trackPageView) {
      analytics.trackPageView(pageId);
    }
  }, [analytics, pageId, autoTrack, trackPageView]);

  // 읽기 시간 추적 시작
  const startTracking = useCallback((wordCount?: number) => {
    if (trackReadingTime && !isTrackingRef.current) {
      startTimeRef.current = Date.now();
      isTrackingRef.current = true;
      
      if (wordCount) {
        analytics.startReadingPost(pageId, wordCount);
      }
    }
  }, [analytics, pageId, trackReadingTime]);

  // 읽기 시간 추적 종료
  const stopTracking = useCallback(() => {
    if (trackReadingTime && isTrackingRef.current) {
      analytics.finishReadingPost(pageId);
      isTrackingRef.current = false;
    }
  }, [analytics, pageId, trackReadingTime]);

  // 이벤트 추적
  const track = useCallback((event: TrackingEvent) => {
    analytics.trackInteraction(event.type, event.target, {
      ...event.metadata,
      pageId,
      timestamp: Date.now(),
    });
  }, [analytics, pageId]);

  // 검색 추적
  const trackSearch = useCallback((query: string, resultsCount: number = 0) => {
    analytics.trackSearch(query, resultsCount);
  }, [analytics]);

  // 스크롤 깊이 추적
  useEffect(() => {
    if (!autoTrack || !trackScrollDepth) return;

    let maxScrollDepth = 0;
    
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      
      const scrollPercentage = Math.round((scrollTop + windowHeight) / documentHeight * 100);
      const currentDepth = Math.min(scrollPercentage, 100);
      
      if (currentDepth > maxScrollDepth) {
        maxScrollDepth = currentDepth;
        
        // 25%, 50%, 75%, 100% 지점에서 이벤트 발생
        if (currentDepth >= 25 && maxScrollDepth < 25) {
          track({ type: 'scroll_depth', target: '25%' });
        } else if (currentDepth >= 50 && maxScrollDepth < 50) {
          track({ type: 'scroll_depth', target: '50%' });
        } else if (currentDepth >= 75 && maxScrollDepth < 75) {
          track({ type: 'scroll_depth', target: '75%' });
        } else if (currentDepth >= 100 && maxScrollDepth < 100) {
          track({ type: 'scroll_depth', target: '100%' });
        }
      }
    };

    const throttledScroll = throttle(handleScroll, 250);
    window.addEventListener('scroll', throttledScroll);

    return () => {
      window.removeEventListener('scroll', throttledScroll);
    };
  }, [autoTrack, trackScrollDepth, track]);

  // 컴포넌트 언마운트 시 추적 종료
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    track,
    trackSearch,
    startTracking,
    stopTracking,
    isTracking: isTrackingRef.current,
  };
}

// 쓰로틀링 유틸리티
function throttle(func: Function, limit: number): (...args: any[]) => void {
  let inThrottle: boolean;
  return function(this: any, ...args: any[]) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}
*/ 