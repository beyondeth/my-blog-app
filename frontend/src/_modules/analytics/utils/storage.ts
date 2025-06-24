// 스토리지 관리 유틸리티
import { UserActivity, UserStats, AnalyticsConfig } from '../types';

export class StorageManager {
  private readonly STORAGE_KEY = 'blog_analytics';
  private readonly USER_ID_KEY = 'blog_user_id';
  private config: AnalyticsConfig;

  constructor(config: AnalyticsConfig) {
    this.config = config;
    this.initializeUserId();
  }

  public updateConfig(config: AnalyticsConfig): void {
    this.config = config;
  }

  public getUserId(): string {
    let userId = localStorage.getItem(this.USER_ID_KEY);
    if (!userId) {
      userId = this.generateUniqueId();
      if (this.config.enableLocalStorage) {
        localStorage.setItem(this.USER_ID_KEY, userId);
      }
    }
    return userId;
  }

  public saveActivity(activity: UserActivity): void {
    if (!this.config.enableLocalStorage) return;

    const activities = this.getActivities();
    activities.push(activity);
    
    // 최대 개수 제한
    const maxActivities = this.config.maxActivities || 1000;
    if (activities.length > maxActivities) {
      activities.splice(0, activities.length - maxActivities);
    }
    
    this.setStoredData('activities', activities);
  }

  public getActivities(limit?: number): UserActivity[] {
    const activities = this.getStoredData('activities') || [];
    return limit ? activities.slice(-limit) : activities;
  }

  public saveUserStats(stats: UserStats): void {
    if (!this.config.enableLocalStorage) return;
    this.setStoredData('user_stats', stats);
  }

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

  public saveMonthlySearchStats(stats: any): void {
    if (!this.config.enableLocalStorage) return;
    this.setStoredData('monthly_search_stats', stats);
  }

  public getMonthlySearchStats(): any {
    return this.getStoredData('monthly_search_stats') || {};
  }

  public clearAllData(): void {
    if (!this.config.enableLocalStorage) return;

    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(this.STORAGE_KEY) || key === this.USER_ID_KEY
    );
    
    keys.forEach(key => localStorage.removeItem(key));
  }

  private initializeUserId(): void {
    this.getUserId(); // ID 생성 및 저장
  }

  private generateUniqueId(): string {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private getStoredData(key: string): any {
    if (!this.config.enableLocalStorage) return null;

    try {
      const data = localStorage.getItem(`${this.STORAGE_KEY}_${key}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  private setStoredData(key: string, data: any): void {
    if (!this.config.enableLocalStorage) return;

    try {
      localStorage.setItem(`${this.STORAGE_KEY}_${key}`, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save analytics data:', error);
    }
  }
} 