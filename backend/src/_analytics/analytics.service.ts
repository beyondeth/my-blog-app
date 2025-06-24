// // [ANALYTICS MODULE DISABLED FOR DEV PERFORMANCE]
// /*
// import {
//   Injectable,
//   Logger,
//   NotFoundException,
//   BadRequestException,
//   Inject,
// } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository, Between, MoreThan, In } from 'typeorm';
// import { Post } from '../posts/entities/post.entity';
// import { User } from '../users/entities/user.entity';
// import { AnalyticsEvent } from './entities/analytics-event.entity';
// import { TrackEventDto } from './dto/track-event.dto';
// import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
// import { startOfDay, subDays } from 'date-fns';
// import { TrackBatchDto } from './dto/track-batch.dto';

// @Injectable()
// export class AnalyticsService {
//   private readonly logger = new Logger(AnalyticsService.name);

//   constructor(
//     @InjectRepository(AnalyticsEvent)
//     private analyticsRepository: Repository<AnalyticsEvent>,
//     @InjectRepository(Post)
//     private postsRepository: Repository<Post>,
//     @InjectRepository(User)
//     private usersRepository: Repository<User>,
//     @Inject(CACHE_MANAGER) private cacheManager: Cache,
//   ) {}

//   /**
//    * 사용자 행동 이벤트 추적 (로그인/비로그인 사용자 모두)
//    */
//   async trackEvent(
//     identifier: string, // userId 또는 anonymousId
//     trackEventDto: TrackEventDto,
//   ): Promise<void> {
//     try {
//       const isAnonymous = identifier.startsWith('anonymous_');

//       const eventData: Partial<AnalyticsEvent> = {
//         eventType: trackEventDto.eventType,
//         eventData: {
//           ...trackEventDto.eventData,
//           isAnonymous,
//         },
//         sessionId: trackEventDto.sessionId,
//         userAgent: trackEventDto.userAgent,
//         ipAddress: trackEventDto.ipAddress,
//         referrer: trackEventDto.referrer,
//       };

//       if (isAnonymous) {
//         eventData.anonymousId = identifier;
//         eventData.userId = null;
//       } else {
//         eventData.userId = identifier;
//         eventData.anonymousId = null;
//       }
      
//       const event = this.analyticsRepository.create(eventData);
//       await this.analyticsRepository.save(event);

//       const userType = isAnonymous ? 'anonymous' : 'logged-in';
//       this.logger.log(
//         `Event tracked: ${trackEventDto.eventType} for ${userType} user ${identifier}`,
//       );
//     } catch (error) {
//       this.logger.error(`Failed to track event: ${error.message}`, error.stack);
//     }
//   }

//   /**
//    * 사용자 개인 통계 조회
//    */
//   async getUserStats(userId: string) {
//     const thirtyDaysAgo = new Date();
//     thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

//     // 최근 30일 활동
//     const recentEvents = await this.analyticsRepository.find({
//       where: {
//         userId,
//         createdAt: MoreThan(thirtyDaysAgo),
//       },
//       order: { createdAt: 'DESC' },
//     });

//     // 페이지 방문 수
//     const pageViews = recentEvents.filter(e => e.eventType === 'page_view').length;

//     // 포스트 읽기 완료 수
//     const completedReads = recentEvents.filter(e => e.eventType === 'post_read_complete').length;

//     // 총 읽기 시간 (밀리초)
//     const totalReadTime = recentEvents
//       .filter(e => e.eventType === 'post_read_complete' && e.eventData?.readTime)
//       .reduce((total, e) => total + (e.eventData.readTime || 0), 0);

//     // 평균 읽기 속도 (분당 단어수)
//     const readingSpeeds = recentEvents
//       .filter(e => e.eventType === 'post_read_complete' && e.eventData?.readingSpeed)
//       .map(e => e.eventData.readingSpeed);
    
//     const avgReadingSpeed = readingSpeeds.length > 0
//       ? readingSpeeds.reduce((sum, speed) => sum + speed, 0) / readingSpeeds.length
//       : 0;

//     // 검색 횟수
//     const searchCount = recentEvents.filter(e => e.eventType === 'search').length;

//     // 좋아요 횟수
//     const likeCount = recentEvents.filter(e => e.eventType === 'like_toggle').length;

//     // 공유 횟수
//     const shareCount = recentEvents.filter(e => e.eventType.includes('share')).length;

//     return {
//       period: '30일',
//       pageViews,
//       completedReads,
//       totalReadTime,
//       avgReadingSpeed: Math.round(avgReadingSpeed),
//       searchCount,
//       likeCount,
//       shareCount,
//       activeSessionCount: new Set(recentEvents.map(e => e.sessionId)).size,
//     };
//   }

//   /**
//    * 인기 포스트 조회 (조회수, 읽기 완료율 기반)
//    */
//   async getPopularPosts(limit: number = 10, period: string = '7d') {
//     const daysAgo = this.getPeriodDate(period);

//     // 최근 기간 내 포스트 관련 이벤트 조회
//     const postEvents = await this.analyticsRepository
//       .createQueryBuilder('event')
//       .where('event.createdAt > :date', { date: daysAgo })
//       .andWhere('event.eventType IN (:...types)', {
//         types: ['post_read_start', 'post_read_complete', 'page_view'],
//       })
//       .andWhere("event.eventData->>'postId' IS NOT NULL")
//       .getMany();

//     // 포스트별 통계 계산
//     const postStats = new Map();
    
//     postEvents.forEach(event => {
//       const postId = event.eventData?.postId;
//       if (!postId) return;

//       if (!postStats.has(postId)) {
//         postStats.set(postId, {
//           views: 0,
//           readStarts: 0,
//           readCompletes: 0,
//           totalReadTime: 0,
//           avgScrollDepth: 0,
//           scrollDepths: [],
//         });
//       }

//       const stats = postStats.get(postId);
      
//       if (event.eventType === 'page_view') {
//         stats.views++;
//       } else if (event.eventType === 'post_read_start') {
//         stats.readStarts++;
//       } else if (event.eventType === 'post_read_complete') {
//         stats.readCompletes++;
//         if (event.eventData?.readTime) {
//           stats.totalReadTime += event.eventData.readTime;
//         }
//         if (event.eventData?.scrollDepth) {
//           stats.scrollDepths.push(event.eventData.scrollDepth);
//         }
//       }
//     });

//     // 인기도 점수 계산 및 정렬
//     const popularPosts = Array.from(postStats.entries())
//       .map(([postId, stats]) => {
//         const completionRate = stats.readStarts > 0 ? stats.readCompletes / stats.readStarts : 0;
//         const avgScrollDepth = stats.scrollDepths.length > 0
//           ? stats.scrollDepths.reduce((sum, depth) => sum + depth, 0) / stats.scrollDepths.length
//           : 0;
        
//         // 인기도 점수: 조회수 + 완료율*10 + 평균스크롤깊이/10
//         const popularityScore = stats.views + (completionRate * 10) + (avgScrollDepth / 10);
        
//         return {
//           postId,
//           views: stats.views,
//           readStarts: stats.readStarts,
//           readCompletes: stats.readCompletes,
//           completionRate: Math.round(completionRate * 100),
//           avgScrollDepth: Math.round(avgScrollDepth),
//           avgReadTime: stats.readCompletes > 0 ? Math.round(stats.totalReadTime / stats.readCompletes) : 0,
//           popularityScore,
//         };
//       })
//       .sort((a, b) => b.popularityScore - a.popularityScore)
//       .slice(0, limit);

//     // 포스트 정보 조회
//     const postIds = popularPosts.map(p => p.postId);
//     const posts = await this.postsRepository.find({
//       where: { id: In(postIds) },
//       relations: ['author'],
//       select: ['id', 'title', 'slug', 'thumbnail', 'category', 'publishedAt'],
//     });

//     // 결과 조합
//     return popularPosts.map(stats => {
//       const post = posts.find(p => p.id === stats.postId);
//       return post ? { ...stats, post } : null;
//     }).filter(Boolean);
//   }

//   /**
//    * 트렌딩 태그 조회
//    */
//   async getTrendingTags(limit: number = 20, period: string = '7d') {
//     const daysAgo = this.getPeriodDate(period);

//     // 태그 클릭 이벤트 조회
//     const tagEvents = await this.analyticsRepository.find({
//       where: {
//         eventType: 'tag_click',
//         createdAt: MoreThan(daysAgo),
//       },
//     });

//     // 태그별 클릭 수 계산
//     const tagStats = new Map();
    
//     tagEvents.forEach(event => {
//       const tag = event.eventData?.tag || event.eventData?.target;
//       if (!tag) return;

//       tagStats.set(tag, (tagStats.get(tag) || 0) + 1);
//     });

//     // 정렬 및 제한
//     return Array.from(tagStats.entries())
//       .map(([tag, clickCount]) => ({ tag, clickCount }))
//       .sort((a, b) => b.clickCount - a.clickCount)
//       .slice(0, limit);
//   }

//   /**
//    * 검색 트렌드 조회
//    */
//   async getSearchTrends(limit: number = 10, period: string = '30d') {
//     const daysAgo = this.getPeriodDate(period);

//     // 검색 이벤트 조회
//     const searchEvents = await this.analyticsRepository.find({
//       where: {
//         eventType: 'search',
//         createdAt: MoreThan(daysAgo),
//       },
//     });

//     // 검색어별 통계 계산
//     const searchStats = new Map();
    
//     searchEvents.forEach(event => {
//       const query = event.eventData?.query || event.eventData?.target;
//       if (!query || query.length < 2) return;

//       const normalizedQuery = query.toLowerCase().trim();
      
//       if (!searchStats.has(normalizedQuery)) {
//         searchStats.set(normalizedQuery, {
//           query: normalizedQuery,
//           searchCount: 0,
//           resultsCount: [],
//         });
//       }

//       const stats = searchStats.get(normalizedQuery);
//       stats.searchCount++;
      
//       if (event.eventData?.resultsCount !== undefined) {
//         stats.resultsCount.push(event.eventData.resultsCount);
//       }
//     });

//     // 결과 정리 및 정렬
//     return Array.from(searchStats.values())
//       .map(stats => ({
//         query: stats.query,
//         searchCount: stats.searchCount,
//         avgResultsCount: stats.resultsCount.length > 0
//           ? Math.round(stats.resultsCount.reduce((sum, count) => sum + count, 0) / stats.resultsCount.length)
//           : 0,
//       }))
//       .sort((a, b) => b.searchCount - a.searchCount)
//       .slice(0, limit);
//   }

//   /**
//    * 사이트 전체 통계
//    */
//   async getSiteStats() {
//     const thirtyDaysAgo = new Date();
//     thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

//     const [
//       totalUsers,
//       totalPosts,
//       publishedPosts,
//       recentEvents,
//     ] = await Promise.all([
//       this.usersRepository.count(),
//       this.postsRepository.count(),
//       this.postsRepository.count({ where: { isPublished: true } }),
//       this.analyticsRepository.find({
//         where: { createdAt: MoreThan(thirtyDaysAgo) },
//       }),
//     ]);

//     // 최근 30일 통계
//     const activeUsers = new Set(recentEvents.map(e => e.userId)).size;
//     const pageViews = recentEvents.filter(e => e.eventType === 'page_view').length;
//     const searches = recentEvents.filter(e => e.eventType === 'search').length;
//     const postReads = recentEvents.filter(e => e.eventType === 'post_read_complete').length;

//     return {
//       totalUsers,
//       totalPosts,
//       publishedPosts,
//       draftPosts: totalPosts - publishedPosts,
//       last30Days: {
//         activeUsers,
//         pageViews,
//         searches,
//         postReads,
//         avgPageViewsPerUser: activeUsers > 0 ? Math.round(pageViews / activeUsers) : 0,
//       },
//     };
//   }

//   /**
//    * 사용자 읽기 패턴 분석
//    */
//   async getReadingPatterns(userId: string) {
//     const thirtyDaysAgo = new Date();
//     thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

//     const userEvents = await this.analyticsRepository.find({
//       where: {
//         userId,
//         createdAt: MoreThan(thirtyDaysAgo),
//       },
//       order: { createdAt: 'ASC' },
//     });

//     // 시간대별 활동 패턴
//     const hourlyActivity = new Array(24).fill(0);
    
//     // 요일별 활동 패턴
//     const weeklyActivity = new Array(7).fill(0);
    
//     // 카테고리별 관심도
//     const categoryInterest = new Map();

//     userEvents.forEach(event => {
//       const date = new Date(event.createdAt);
//       const hour = date.getHours();
//       const dayOfWeek = date.getDay();
      
//       hourlyActivity[hour]++;
//       weeklyActivity[dayOfWeek]++;

//       // 카테고리 관심도 (포스트 읽기 이벤트에서 추출)
//       if (event.eventType === 'post_read_complete' && event.eventData?.category) {
//         const category = event.eventData.category;
//         categoryInterest.set(category, (categoryInterest.get(category) || 0) + 1);
//       }
//     });

//     // 가장 활발한 시간대
//     const mostActiveHour = hourlyActivity.indexOf(Math.max(...hourlyActivity));
    
//     // 가장 활발한 요일 (0=일요일, 6=토요일)
//     const mostActiveDay = weeklyActivity.indexOf(Math.max(...weeklyActivity));
//     const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

//     return {
//       mostActiveHour: `${mostActiveHour}시`,
//       mostActiveDay: dayNames[mostActiveDay],
//       hourlyActivity,
//       weeklyActivity,
//       favoriteCategories: Array.from(categoryInterest.entries())
//         .map(([category, count]) => ({ category, count }))
//         .sort((a, b) => b.count - a.count)
//         .slice(0, 5),
//     };
//   }

//   /**
//    * 기간에 따른 날짜 계산
//    */
//   private getPeriodDate(period: string): Date {
//     const now = new Date();
//     const periodMap = {
//       '1d': 1,
//       '7d': 7,
//       '30d': 30,
//       '90d': 90,
//       'all': 365 * 10, // 10년
//     };
    
//     const days = periodMap[period] || 30;
//     now.setDate(now.getDate() - days);
//     return now;
//   }

//   /**
//    * 방문자 통계 (일일/주간/월간)
//    */
//   async getVisitorStats(period: string = '30d') {
//     const startDate = this.getPeriodDate(period);
    
//     // 전체 방문자 수 (페이지 뷰 이벤트 기준)
//     const pageViewEvents = await this.analyticsRepository.find({
//       where: {
//         eventType: 'page_view',
//         createdAt: MoreThan(startDate),
//       },
//       relations: ['user'],
//       order: { createdAt: 'DESC' },
//     });

//     // 일별 통계 계산
//     const dailyStats = new Map();
//     const uniqueVisitors = new Set();
//     const loggedInVisitors = new Set();
//     const anonymousVisitors = new Set();

//     pageViewEvents.forEach(event => {
//       const date = event.createdAt.toISOString().split('T')[0];
      
//       if (!dailyStats.has(date)) {
//         dailyStats.set(date, {
//           date,
//           totalViews: 0,
//           uniqueVisitors: new Set(),
//           loggedInUsers: new Set(),
//           anonymousUsers: new Set(),
//         });
//       }

//       const dayStats = dailyStats.get(date);
//       dayStats.totalViews++;
//       dayStats.uniqueVisitors.add(event.userId);
//       uniqueVisitors.add(event.userId);

//       if (event.user) {
//         dayStats.loggedInUsers.add(event.userId);
//         loggedInVisitors.add(event.userId);
//       } else {
//         dayStats.anonymousUsers.add(event.userId);
//         anonymousVisitors.add(event.userId);
//       }
//     });

//     // 일별 데이터 정리
//     const dailyData = Array.from(dailyStats.values()).map(stats => ({
//       date: stats.date,
//       totalViews: stats.totalViews,
//       uniqueVisitors: stats.uniqueVisitors.size,
//       loggedInUsers: stats.loggedInUsers.size,
//       anonymousUsers: stats.anonymousUsers.size,
//     }));

//     return {
//       period,
//       summary: {
//         totalViews: pageViewEvents.length,
//         uniqueVisitors: uniqueVisitors.size,
//         loggedInUsers: loggedInVisitors.size,
//         anonymousUsers: anonymousVisitors.size,
//         avgViewsPerDay: dailyData.length > 0 ? Math.round(pageViewEvents.length / dailyData.length) : 0,
//       },
//       dailyData: dailyData.sort((a, b) => a.date.localeCompare(b.date)),
//     };
//   }

//   /**
//    * 최근 활동 목록 (사용자 정보 포함)
//    */
//   async getRecentActivities(limit: number = 50, page: number = 1) {
//     const skip = (page - 1) * limit;
    
//     const [activities, total] = await this.analyticsRepository.findAndCount({
//       relations: ['user'],
//       order: { createdAt: 'DESC' },
//       skip,
//       take: limit,
//     });

//     // 포스트 정보 가져오기 (페이지 방문 이벤트용) - Set을 사용하여 중복 제거
//     const postIds = [...new Set(activities
//       .filter(a => a.eventData?.postId)
//       .map(a => a.eventData.postId as string)
//     )];
    
//     const posts = postIds.length > 0 ? await this.postsRepository.find({
//       where: { id: In(postIds) },
//       select: ['id', 'title', 'slug'],
//     }) : [];

//     const activitiesWithDetails = activities.map(activity => {
//       const post = posts.find(p => p.id === activity.eventData?.postId);
      
//       return {
//         id: activity.id,
//         timestamp: activity.createdAt,
//         eventType: activity.eventType,
//         user: activity.user ? {
//           id: activity.user.id,
//           username: activity.user.username,
//           email: activity.user.email,
//         } : null,
//         isLoggedIn: !!activity.user,
//         target: this.formatActivityTarget(activity, post),
//         metadata: activity.eventData,
//         sessionId: activity.sessionId,
//         userAgent: activity.userAgent,
//         ipAddress: activity.ipAddress,
//       };
//     });

//     return {
//       activities: activitiesWithDetails,
//       pagination: {
//         total,
//         page,
//         limit,
//         totalPages: Math.ceil(total / limit),
//       },
//     };
//   }

//   /**
//    * 포스트별 상세 분석
//    */
//   async getPostAnalytics(period: string = '30d') {
//     const startDate = this.getPeriodDate(period);
    
//     // 포스트 관련 이벤트 조회
//     const postEvents = await this.analyticsRepository.find({
//       where: {
//         eventType: In(['page_view', 'post_read_start', 'post_read_complete']),
//         createdAt: MoreThan(startDate),
//       },
//       relations: ['user'],
//     });

//     // 포스트별 통계 계산
//     const postStats = new Map();
    
//     postEvents.forEach(event => {
//       const postId = event.eventData?.postId;
//       if (!postId) return;

//       if (!postStats.has(postId)) {
//         postStats.set(postId, {
//           postId,
//           views: 0,
//           uniqueVisitors: new Set(),
//           loggedInViews: 0,
//           anonymousViews: 0,
//           readStarts: 0,
//           readCompletes: 0,
//           totalReadTime: 0,
//           readTimes: [],
//           scrollDepths: [],
//         });
//       }

//       const stats = postStats.get(postId);
//       stats.uniqueVisitors.add(event.userId);

//       if (event.eventType === 'page_view') {
//         stats.views++;
//         if (event.user) {
//           stats.loggedInViews++;
//         } else {
//           stats.anonymousViews++;
//         }
//       } else if (event.eventType === 'post_read_start') {
//         stats.readStarts++;
//       } else if (event.eventType === 'post_read_complete') {
//         stats.readCompletes++;
//         if (event.eventData?.readTime) {
//           stats.totalReadTime += event.eventData.readTime;
//           stats.readTimes.push(event.eventData.readTime);
//         }
//         if (event.eventData?.scrollDepth) {
//           stats.scrollDepths.push(event.eventData.scrollDepth);
//         }
//       }
//     });

//     // 포스트 정보 조회
//     const postIds = Array.from(postStats.keys());
//     const posts = postIds.length > 0 ? await this.postsRepository.find({
//       where: { id: In(postIds) },
//       relations: ['author'],
//       select: ['id', 'title', 'slug', 'category', 'publishedAt'],
//     }) : [];

//     // 결과 조합
//     const analytics = Array.from(postStats.entries()).map(([postId, stats]) => {
//       const post = posts.find(p => p.id === postId);
//       if (!post) return null;

//       const avgReadTime = stats.readTimes.length > 0
//         ? stats.readTimes.reduce((sum, time) => sum + time, 0) / stats.readTimes.length
//         : 0;

//       const avgScrollDepth = stats.scrollDepths.length > 0
//         ? stats.scrollDepths.reduce((sum, depth) => sum + depth, 0) / stats.scrollDepths.length
//         : 0;

//       return {
//         post: {
//           id: post.id,
//           title: post.title,
//           slug: post.slug,
//           category: post.category,
//           publishedAt: post.publishedAt,
//         },
//         stats: {
//           views: stats.views,
//           uniqueVisitors: stats.uniqueVisitors.size,
//           loggedInViews: stats.loggedInViews,
//           anonymousViews: stats.anonymousViews,
//           readStarts: stats.readStarts,
//           readCompletes: stats.readCompletes,
//           completionRate: stats.readStarts > 0 ? Math.round((stats.readCompletes / stats.readStarts) * 100) : 0,
//           avgReadTime: Math.round(avgReadTime),
//           avgScrollDepth: Math.round(avgScrollDepth),
//         },
//       };
//     }).filter(Boolean);

//     return analytics.sort((a, b) => b.stats.views - a.stats.views);
//   }

//   /**
//    * 사용자별 활동 분석
//    */
//   async getUserAnalytics(period: string = '30d') {
//     const startDate = this.getPeriodDate(period);
    
//     const userEvents = await this.analyticsRepository.find({
//       where: {
//         createdAt: MoreThan(startDate),
//       },
//       relations: ['user'],
//       order: { createdAt: 'DESC' },
//     });

//     // 사용자별 통계 계산
//     const userStats = new Map();
    
//     userEvents.forEach(event => {
//       const userId = event.userId;
      
//       if (!userStats.has(userId)) {
//         userStats.set(userId, {
//           userId,
//           user: event.user,
//           isLoggedIn: !!event.user,
//           totalEvents: 0,
//           pageViews: 0,
//           searches: 0,
//           postReads: 0,
//           likes: 0,
//           shares: 0,
//           totalReadTime: 0,
//           sessions: new Set(),
//           lastActivity: event.createdAt,
//         });
//       }

//       const stats = userStats.get(userId);
//       stats.totalEvents++;
//       stats.sessions.add(event.sessionId);
      
//       if (event.createdAt > stats.lastActivity) {
//         stats.lastActivity = event.createdAt;
//       }

//       switch (event.eventType) {
//         case 'page_view':
//           stats.pageViews++;
//           break;
//         case 'search':
//           stats.searches++;
//           break;
//         case 'post_read_complete':
//           stats.postReads++;
//           if (event.eventData?.readTime) {
//             stats.totalReadTime += event.eventData.readTime;
//           }
//           break;
//         case 'like_toggle':
//           stats.likes++;
//           break;
//         default:
//           if (event.eventType.includes('share')) {
//             stats.shares++;
//           }
//       }
//     });

//     // 결과 정리
//     const analytics = Array.from(userStats.values()).map(stats => ({
//       user: stats.user ? {
//         id: stats.user.id,
//         username: stats.user.username,
//         email: stats.user.email,
//       } : null,
//       isLoggedIn: stats.isLoggedIn,
//       userId: stats.userId,
//       stats: {
//         totalEvents: stats.totalEvents,
//         pageViews: stats.pageViews,
//         searches: stats.searches,
//         postReads: stats.postReads,
//         likes: stats.likes,
//         shares: stats.shares,
//         totalReadTime: stats.totalReadTime,
//         sessions: stats.sessions.size,
//         lastActivity: stats.lastActivity,
//         avgReadTime: stats.postReads > 0 ? Math.round(stats.totalReadTime / stats.postReads) : 0,
//       },
//     }));

//     return analytics.sort((a, b) => b.stats.totalEvents - a.stats.totalEvents);
//   }

//   /**
//    * 활동 대상 포맷팅
//    */
//   private formatActivityTarget(activity: AnalyticsEvent, post?: any): string {
//     switch (activity.eventType) {
//       case 'page_view':
//         if (post) {
//           return `포스트: ${post.title}`;
//         }
//         return activity.eventData?.page || '알 수 없는 페이지';
      
//       case 'post_read_start':
//       case 'post_read_complete':
//         if (post) {
//           return `포스트 읽기: ${post.title}`;
//         }
//         return '포스트 읽기';
      
//       case 'search':
//         return `검색: "${activity.eventData?.query || '알 수 없음'}"`;
      
//       case 'like_toggle':
//         if (post) {
//           return `좋아요: ${post.title}`;
//         }
//         return '좋아요';
      
//       default:
//         return activity.eventData?.target || activity.eventType;
//     }
//   }

//   async getDashboardData(period: '1d' | '7d' | '30d' | '90d' = '30d') {
//     const cacheKey = `dashboard_data_${period}`;
//     const cachedData = await this.cacheManager.get(cacheKey);
//     if (cachedData) {
//       this.logger.log(`Dashboard data returned from cache for period: ${period}`);
//       return cachedData;
//     }

//     this.logger.log(`Fetching dashboard data from DB for period: ${period}`);
    
//     const startDate = this.getPeriodDate(period);

//     // 1. 모든 관련 이벤트를 한 번에 조회
//     const allEvents = await this.analyticsRepository.find({
//       where: { createdAt: MoreThan(startDate) },
//       relations: ['user'],
//       order: { createdAt: 'DESC' },
//     });
    
//     // 2. 이벤트 데이터를 기반으로 각 통계 계산 (DB 조회 없이)
//     const visitorStats = this.calculateVisitorStats(allEvents, period);
//     const recentActivities = await this.formatRecentActivities(allEvents.slice(0, 20));
//     const postAnalytics = await this.calculatePostAnalytics(allEvents);

//     const result = {
//       visitorStats,
//       recentActivities,
//       postAnalytics,
//     };

//     // 대시보드 데이터는 10분간 캐싱
//     await this.cacheManager.set(cacheKey, result, 600000); 

//     return result;
//   }

//   /**
//    * getDashboardData를 위한 헬퍼 메소드들
//    */

//   private calculateVisitorStats(events: AnalyticsEvent[], period: string) {
//     const pageViewEvents = events.filter(e => e.eventType === 'page_view');

//     const dailyStats = new Map();
//     const uniqueVisitors = new Set<string>();
//     const loggedInVisitors = new Set<string>();
//     const anonymousVisitors = new Set<string>();

//     pageViewEvents.forEach(event => {
//       const date = event.createdAt.toISOString().split('T')[0];
//       if (!dailyStats.has(date)) {
//         dailyStats.set(date, {
//           date,
//           totalViews: 0,
//           uniqueVisitors: new Set(),
//           loggedInUsers: new Set(),
//           anonymousUsers: new Set(),
//         });
//       }

//       const dayStats = dailyStats.get(date);
//       const visitorId = event.userId || event.anonymousId;
      
//       dayStats.totalViews++;
//       dayStats.uniqueVisitors.add(visitorId);
//       uniqueVisitors.add(visitorId);

//       if (event.user) {
//         dayStats.loggedInUsers.add(event.userId);
//         loggedInVisitors.add(event.userId);
//       } else {
//         dayStats.anonymousUsers.add(event.anonymousId);
//         anonymousVisitors.add(event.anonymousId);
//       }
//     });

//     const dailyData = Array.from(dailyStats.values()).map(stats => ({
//       date: stats.date,
//       totalViews: stats.totalViews,
//       uniqueVisitors: stats.uniqueVisitors.size,
//       loggedInUsers: stats.loggedInUsers.size,
//       anonymousUsers: stats.anonymousUsers.size,
//     }));
    
//     return {
//       period,
//       summary: {
//         totalViews: pageViewEvents.length,
//         uniqueVisitors: uniqueVisitors.size,
//         loggedInUsers: loggedInVisitors.size,
//         anonymousUsers: anonymousVisitors.size,
//         avgViewsPerDay: dailyData.length > 0 ? Math.round(pageViewEvents.length / dailyData.length) : 0,
//       },
//       dailyData: dailyData.sort((a, b) => a.date.localeCompare(b.date)),
//     };
//   }
  
//   private async formatRecentActivities(activities: AnalyticsEvent[]) {
//     const postIds = [...new Set(activities.filter(a => a.eventData?.postId).map(a => a.eventData.postId as string))];
//     const posts = postIds.length > 0 ? await this.postsRepository.find({ where: { id: In(postIds) }, select: ['id', 'title'] }) : [];
    
//     const activitiesWithDetails = activities.map(activity => {
//       const post = posts.find(p => p.id === activity.eventData?.postId);
//       return {
//         id: activity.id,
//         timestamp: activity.createdAt,
//         eventType: activity.eventType,
//         user: activity.user ? { id: activity.user.id, username: activity.user.username, email: activity.user.email } : null,
//         isLoggedIn: !!activity.user,
//         target: this.formatActivityTarget(activity, post),
//         metadata: activity.eventData,
//         sessionId: activity.sessionId,
//       };
//     });

//     return { activities: activitiesWithDetails };
//   }
  
//   private async calculatePostAnalytics(events: AnalyticsEvent[]) {
//     const postEvents = events.filter(e => e.eventType === 'page_view' || e.eventType === 'post_read_start' || e.eventType === 'post_read_complete');
//     const postStats = new Map();
    
//     postEvents.forEach(event => {
//       const postId = event.eventData?.postId;
//       if (!postId) return;

//       if (!postStats.has(postId)) {
//         postStats.set(postId, {
//           views: 0,
//           uniqueVisitors: new Set(),
//           loggedInViews: 0,
//           anonymousViews: 0,
//           readStarts: 0,
//           readCompletes: 0,
//           readTimes: [],
//           scrollDepths: [],
//         });
//       }

//       const stats = postStats.get(postId);
//       const visitorId = event.userId || event.anonymousId;
//       stats.uniqueVisitors.add(visitorId);

//       if (event.eventType === 'page_view') {
//         stats.views++;
//         event.user ? stats.loggedInViews++ : stats.anonymousViews++;
//       } else if (event.eventType === 'post_read_start') {
//         stats.readStarts++;
//       } else if (event.eventType === 'post_read_complete') {
//         stats.readCompletes++;
//         if (event.eventData?.readTime) stats.readTimes.push(event.eventData.readTime);
//         if (event.eventData?.scrollDepth) stats.scrollDepths.push(event.eventData.scrollDepth);
//       }
//     });

//     const postIds = Array.from(postStats.keys());
//     const posts = postIds.length > 0 ? await this.postsRepository.find({ where: { id: In(postIds) }, select: ['id', 'title', 'slug', 'category', 'publishedAt'] }) : [];

//     const analytics = Array.from(postStats.entries()).map(([postId, stats]) => {
//       const post = posts.find(p => p.id === postId);
//       if (!post) return null;
      
//       const avgReadTime = stats.readTimes.length > 0 ? stats.readTimes.reduce((s, t) => s + t, 0) / stats.readTimes.length : 0;
//       const avgScrollDepth = stats.scrollDepths.length > 0 ? stats.scrollDepths.reduce((s, d) => s + d, 0) / stats.scrollDepths.length : 0;

//       return {
//         post,
//         stats: {
//           views: stats.views,
//           uniqueVisitors: stats.uniqueVisitors.size,
//           loggedInViews: stats.loggedInViews,
//           anonymousViews: stats.anonymousViews,
//           readStarts: stats.readStarts,
//           readCompletes: stats.readCompletes,
//           completionRate: stats.readStarts > 0 ? Math.round((stats.readCompletes / stats.readStarts) * 100) : 0,
//           avgReadTime: Math.round(avgReadTime),
//           avgScrollDepth: Math.round(avgScrollDepth),
//         },
//       };
//     }).filter(Boolean);

//     return analytics.sort((a, b) => b.stats.views - a.stats.views);
//   }

//   async trackBatch(identifier: string, trackBatchDto: TrackBatchDto): Promise<void> {
//     const isAnonymous = identifier.startsWith('anonymous_');

//     const eventsToCreate = trackBatchDto.events.map(event => ({
//       userId: isAnonymous ? null : identifier,
//       anonymousId: isAnonymous ? identifier : null,
//       eventType: event.eventType,
//       eventData: {
//         ...event.eventData,
//         isAnonymous,
//       },
//       sessionId: trackBatchDto.sessionId,
//       userAgent: trackBatchDto.userAgent,
//       referrer: trackBatchDto.referrer,
//       createdAt: new Date(event.timestamp), // 프론트엔드에서 기록된 시간 사용
//     }));

//     await this.analyticsRepository.insert(eventsToCreate as any);
//     this.logger.log(`Batch tracked ${eventsToCreate.length} events for ${isAnonymous ? 'anonymous user' : 'user'} ${identifier}`);
//   }
// */ 