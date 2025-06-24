// 분석 추적 HOC (Higher-Order Component)
import React, { useEffect } from 'react';
import { useAnalytics } from '../core/analytics';

interface WithAnalyticsOptions {
  trackPageView?: boolean;
  pageId?: string;
  category?: string;
}

export default function withAnalytics<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: WithAnalyticsOptions = {}
) {
  const AnalyticsWrapper = (props: P) => {
    const analytics = useAnalytics();
    const { trackPageView = true, pageId, category } = options;

    useEffect(() => {
      if (trackPageView && pageId) {
        analytics.trackPageView(pageId, category);
      }
    }, [analytics, pageId, category]);

    return <WrappedComponent {...props} />;
  };

  AnalyticsWrapper.displayName = `withAnalytics(${WrappedComponent.displayName || WrappedComponent.name})`;

  return AnalyticsWrapper;
}

// 사용 예시를 위한 타입 정의
export interface WithAnalyticsProps {
  analytics: {
    track: (action: string, target: string, metadata?: any) => void;
    trackPageView: (page: string, category?: string) => void;
    trackSearch: (query: string, resultsCount: number) => void;
    getUserStats: () => any;
    getActivities: (limit?: number) => any[];
  };
} 