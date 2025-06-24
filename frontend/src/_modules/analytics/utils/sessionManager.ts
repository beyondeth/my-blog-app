// 세션 관리 유틸리티
import { AnalyticsConfig, SessionData, ReadingSession } from '../types';

export class SessionManager {
  private readonly SESSION_KEY = 'blog_session';
  private config: AnalyticsConfig;
  private currentSession: SessionData | null = null;
  private readingSessions: Map<string, ReadingSession> = new Map();

  constructor(config: AnalyticsConfig) {
    this.config = config;
  }

  public updateConfig(config: AnalyticsConfig): void {
    this.config = config;
  }

  public startSession(): void {
    this.currentSession = {
      sessionId: this.generateSessionId(),
      startTime: Date.now(),
      duration: 0,
      pageViews: 0,
      scrollDepth: 0,
    };
  }

  public endSession(): void {
    if (this.currentSession) {
      this.currentSession.duration = Date.now() - this.currentSession.startTime;
      this.saveSessionData();
    }
  }

  public getCurrentSession(): SessionData | null {
    return this.currentSession;
  }

  public startReading(postId: string, wordCount: number): void {
    const session: ReadingSession = {
      postId,
      startTime: Date.now(),
      wordCount,
      currentScrollDepth: 0,
      isActive: true,
    };
    
    this.readingSessions.set(postId, session);
  }

  public finishReading(postId: string): any {
    const session = this.readingSessions.get(postId);
    if (!session || !session.isActive) return null;

    const readTime = Date.now() - session.startTime;
    const readingSpeed = session.wordCount > 0 ? (session.wordCount / (readTime / 60000)) : 0;
    
    session.isActive = false;
    
    return {
      readTime,
      scrollDepth: session.currentScrollDepth,
      readingSpeed,
      engagementScore: this.calculateEngagementScore(readTime, session.currentScrollDepth),
    };
  }

  public updateScrollDepth(postId: string, scrollDepth: number): void {
    const session = this.readingSessions.get(postId);
    if (session && session.isActive) {
      session.currentScrollDepth = Math.max(session.currentScrollDepth, scrollDepth);
    }
  }

  public pauseReading(postId: string): void {
    const session = this.readingSessions.get(postId);
    if (session) {
      // 일시정지 로직 구현 가능
    }
  }

  public resumeReading(postId: string): void {
    const session = this.readingSessions.get(postId);
    if (session) {
      // 재개 로직 구현 가능
    }
  }

  public reset(): void {
    this.currentSession = null;
    this.readingSessions.clear();
  }

  private generateSessionId(): string {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private calculateEngagementScore(readTime: number, scrollDepth: number): number {
    const timeScore = Math.min(readTime / 60000, 10) * 10; // 최대 10분 = 100점
    const scrollScore = scrollDepth; // 0-100
    return Math.round((timeScore + scrollScore) / 2);
  }

  private saveSessionData(): void {
    if (this.currentSession && this.config.enableLocalStorage) {
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(this.currentSession));
    }
  }
} 