// 분석 시스템 코어 모듈 (백엔드 연동)
export interface UserActivity {
  timestamp: number;
  action: string;
  target: string;
  metadata?: Record<string, any>;
}

export interface UserStats {
  totalVisits: number;
  totalReadTime: number;
  favoriteCategories: Record<string, number>;
  readingSpeed: number;
  engagementScore: number;
  lastVisit: number;
}

class BlogAnalytics {
  private readonly STORAGE_KEY = 'blog_analytics';
  private readonly USER_ID_KEY = 'blog_user_id';
  private sessionId: string;
  private eventQueue: any[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.setupBeforeUnload(); // 페이지 이탈 시 큐 전송
  }

  public async trackPageView(page: string, category?: string, postId?: string): Promise<void> {
    this.queueEvent('page_view', { page, category, postId });
  }

  public async startReadingPost(postId: string, wordCount: number): Promise<void> {
    this.queueEvent('post_read_start', { postId, wordCount });
  }

  public async finishReadingPost(postId: string, readTime?: number, scrollDepth?: number): Promise<void> {
    const metadata: any = { postId };
    if (readTime) metadata.readTime = readTime;
    if (scrollDepth) metadata.scrollDepth = scrollDepth;
    this.queueEvent('post_read_complete', metadata);
  }

  public async trackSearch(query: string, resultsCount: number): Promise<void> {
    this.queueEvent('search', { query, resultsCount });
  }

  public async trackInteraction(action: string, target: string, metadata?: any): Promise<void> {
    this.queueEvent(action, { target, ...metadata });
  }

  // 이벤트를 큐에 추가하고, 타이머를 설정
  private queueEvent(eventType: string, eventData: any): void {
    this.eventQueue.push({
      eventType,
      eventData,
      timestamp: new Date().toISOString(),
    });

    // 이미 타이머가 설정되어 있다면 재설정하지 않음
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flushQueue(), 2000); // 2초 후 일괄 전송
    }
  }

  // 큐에 쌓인 이벤트를 백엔드로 일괄 전송
  public async flushQueue(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    // 타이머 초기화
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    const eventsToSend = [...this.eventQueue];
    this.eventQueue = []; // 큐 비우기

    try {
      // 로컬 스토리지에서 토큰 가져오기
      const token = localStorage.getItem('accessToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/v1/analytics/track-batch', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          events: eventsToSend,
          sessionId: this.sessionId,
          userAgent: navigator.userAgent,
          referrer: document.referrer,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      console.log(`📊 Analytics - Flushed ${eventsToSend.length} events to backend.`);
    } catch (error) {
      console.warn('Failed to send analytics batch to backend:', error);
      // 전송 실패 시 큐를 원상복구하여 다음 시도에 포함
      this.eventQueue.unshift(...eventsToSend);
    }
  }

  // 페이지 이탈 시 자동 전송 설정
  private setupBeforeUnload(): void {
    window.addEventListener('beforeunload', () => {
      // 동기적으로 flushQueue를 호출할 수 없으므로, sendBeacon을 사용
      if (this.eventQueue.length > 0) {
        const eventsToSend = [...this.eventQueue];
        this.eventQueue = [];
        
        const payload = JSON.stringify({
            events: eventsToSend,
            sessionId: this.sessionId,
            userAgent: navigator.userAgent,
            referrer: document.referrer,
        });

        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/v1/analytics/track-batch', blob);
        console.log(`📊 Analytics - Sent ${eventsToSend.length} events on page unload.`);
      }
    });
  }

  // 백엔드로 이벤트 전송 (이제 사용 안함)
  private async sendToBackend(eventType: string, eventData: any): Promise<void> {
    // ... 기존 코드는 삭제 ...
  }

  // 세션 ID 생성
  private generateSessionId(): string {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // 로컬 저장소 관련 메서드들 (백업용)
  public getUserStats(): UserStats {
    return this.getStoredData('user_stats') || {
      totalVisits: 0,
      totalReadTime: 0,
      favoriteCategories: {},
      readingSpeed: 0,
      engagementScore: 0,
      lastVisit: 0,
    };
  }

  public getActivities(limit?: number): UserActivity[] {
    const activities = this.getStoredData('activities') || [];
    return limit ? activities.slice(-limit) : activities;
  }

  public getMonthlySearchStats(): any {
    return this.getStoredData('monthly_search_stats') || {};
  }

  public exportUserData(): any {
    return {
      stats: this.getUserStats(),
      activities: this.getActivities(),
      searchStats: this.getMonthlySearchStats(),
      exportDate: new Date().toISOString(),
    };
  }

  public clearAllData(): void {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(this.STORAGE_KEY) || key === this.USER_ID_KEY
    );
    keys.forEach(key => localStorage.removeItem(key));
  }

  public updateConfig(config: any): void {
    // Config update logic
  }

  public getStorageUsage(): { totalSize: number; breakdown: Record<string, number> } {
    const breakdown: Record<string, number> = {};
    let totalSize = 0;

    // localStorage 사용량 계산
    for (let key in localStorage) {
      if (key.startsWith(this.STORAGE_KEY) || key === this.USER_ID_KEY) {
        const size = localStorage[key].length * 2; // UTF-16 encoding
        breakdown[key] = size;
        totalSize += size;
      }
    }

    return { totalSize, breakdown };
  }

  public logPerformanceStats(): void {
    const usage = this.getStorageUsage();
    const activities = this.getActivities();
    
    console.group('📊 Analytics Performance Stats');
    console.log(`💾 Total Storage: ${(usage.totalSize / 1024).toFixed(2)}KB`);
    console.log(`📝 Activities Count: ${activities.length}`);
    console.log(`🗂️ Storage Breakdown:`, usage.breakdown);
    console.groupEnd();
  }

  private recordActivity(action: string, target: string, metadata?: any): void {
    const activity: UserActivity = {
      timestamp: Date.now(),
      action,
      target,
      metadata,
    };
    
    const activities = this.getActivities();
    activities.push(activity);
    
    // 로컬 저장소 크기 제한
    if (activities.length > 500) {
      activities.splice(0, activities.length - 500);
    }
    
    this.setStoredData('activities', activities);
  }

  private getStoredData(key: string): any {
    try {
      const data = localStorage.getItem(`${this.STORAGE_KEY}_${key}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  private setStoredData(key: string, data: any): void {
    try {
      localStorage.setItem(`${this.STORAGE_KEY}_${key}`, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save analytics data:', error);
    }
  }
}

export const analytics = new BlogAnalytics();

export function useAnalytics() {
  return {
    trackPageView: analytics.trackPageView.bind(analytics),
    startReadingPost: analytics.startReadingPost.bind(analytics),
    finishReadingPost: analytics.finishReadingPost.bind(analytics),
    trackSearch: analytics.trackSearch.bind(analytics),
    trackInteraction: analytics.trackInteraction.bind(analytics),
    getUserStats: analytics.getUserStats.bind(analytics),
    getActivities: analytics.getActivities.bind(analytics),
    exportUserData: analytics.exportUserData.bind(analytics),
    clearAllData: analytics.clearAllData.bind(analytics),
    updateConfig: analytics.updateConfig.bind(analytics),
    getMonthlySearchStats: analytics.getMonthlySearchStats.bind(analytics),
    getStorageUsage: analytics.getStorageUsage.bind(analytics),
    logPerformanceStats: analytics.logPerformanceStats.bind(analytics),
  };
} 