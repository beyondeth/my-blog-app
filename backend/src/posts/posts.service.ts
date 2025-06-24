import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, SelectQueryBuilder } from 'typeorm';
import { Post } from './entities/post.entity';
import { User } from '../users/entities/user.entity';
import { File } from '../files/entities/file.entity';
import { Role } from '../common/enums/role.enum';
import { CreatePostDto } from './dto/create-post.dto';
import { FilesService } from '../files/files.service';

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    @InjectRepository(Post)
    private postsRepository: Repository<Post>,
    @InjectRepository(File)
    private filesRepository: Repository<File>,
    private filesService: FilesService,
  ) {}

  async create(createPostDto: CreatePostDto, user: User): Promise<Post> {
    // 기본 게시글 데이터 생성
    const postData = {
      title: createPostDto.title,
      content: createPostDto.content,
      thumbnail: createPostDto.thumbnail,
      tags: createPostDto.tags,
      category: createPostDto.category,
      author: user,
      isPublished: user.role === Role.ADMIN,
      publishedAt: user.role === Role.ADMIN ? new Date() : null,
    };

    const post = this.postsRepository.create(postData);

    // slug 고유성 보장
    await this.ensureUniqueSlug(post);

    const savedPost = await this.postsRepository.save(post);

    // 첨부 파일 처리
    if (createPostDto.attachedFileIds?.length) {
      await this.attachFiles(savedPost.id, createPostDto.attachedFileIds, user.id);
    }

    // 콘텐츠에서 파일 URL 추출하여 연결 (UUID 기반)
    await this.linkFilesFromContent(savedPost);

    return this.findPostById(savedPost.id);
  }

  private async findPostById(id: string): Promise<Post> {
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: ['author', 'attachedFiles'],
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  async findAll(page: number = 1, limit: number = 10, search?: string): Promise<{ posts: any[]; total: number }> {
    const query = this.postsRepository.createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.attachedFiles', 'files')
      .where('post.isPublished = :isPublished', { isPublished: true });

    if (search) {
      query.andWhere('(post.title LIKE :search OR post.content LIKE :search OR post.tags LIKE :search)', {
        search: `%${search}%`,
      });
    }

    const [posts, total] = await query
      .orderBy('post.publishedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // 날짜를 YYYY-MM-DD로 변환
    const formatDate = (date: Date) => {
      if (!date) return null;
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    const postsWithFormattedDates = posts.map(post => ({
      ...post,
      publishedAt: formatDate(post.publishedAt),
      createdAt: formatDate(post.createdAt),
      updatedAt: formatDate(post.updatedAt),
      // 첨부된 이미지 파일들
      images: post.attachedFiles?.filter(file => file.fileType === 'image') || [],
    }));

    return { posts: postsWithFormattedDates, total };
  }

  async findOne(id: string): Promise<any> {
    this.logger.log(`Finding post by ID: ${id}`);
    // QueryBuilder로 필요한 컬럼만 select, 불필요한 join 제거
    const qb = this.postsRepository.createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.attachedFiles', 'file')
      .select([
        'post.id', 'post.title', 'post.slug', 'post.content', 'post.thumbnail',
        'post.isPublished', 'post.viewCount', 'post.likeCount', 'post.tags', 'post.category',
        'post.publishedAt', 'post.createdAt', 'post.updatedAt',
        'author.id', 'author.username', 'author.profileImage', 'author.role',
        'file.id', 'file.fileUrl', 'file.fileType',
      ])
      .where('post.id = :id', { id });
    const post = await qb.getOne();
    if (!post) {
      this.logger.warn(`Post not found for ID: ${id}`);
      throw new NotFoundException('Post not found');
    }
    // 조회수 증가 (비동기 처리)
    post.viewCount = (post.viewCount || 0) + 1;
    this.postsRepository.save(post).catch(e => this.logger.error('viewCount update error', e));
    // 날짜 포맷 등 기존 가공 유지
    const formatDate = (date: Date) => {
      if (!date) return null;
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    const result = {
      ...post,
      publishedAt: formatDate(post.publishedAt),
      createdAt: formatDate(post.createdAt),
      updatedAt: formatDate(post.updatedAt),
    };
    this.logger.log(`Returning post data with ${result.attachedFiles?.length || 0} attached files`);
    return result;
  }

  async findBySlug(slug: string): Promise<any> {
    // QueryBuilder로 필요한 컬럼만 select, 불필요한 join 제거
    const qb = this.postsRepository.createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.attachedFiles', 'file')
      .select([
        'post.id', 'post.title', 'post.slug', 'post.content', 'post.thumbnail',
        'post.isPublished', 'post.viewCount', 'post.likeCount', 'post.tags', 'post.category',
        'post.publishedAt', 'post.createdAt', 'post.updatedAt',
        'author.id', 'author.username', 'author.profileImage', 'author.role',
        'file.id', 'file.fileUrl', 'file.fileType',
      ])
      .where('post.slug = :slug', { slug })
      .andWhere('post.isPublished = :isPublished', { isPublished: true });
    const post = await qb.getOne();
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    // 조회수 증가 (비동기 처리)
    post.viewCount = (post.viewCount || 0) + 1;
    this.postsRepository.save(post).catch(e => this.logger.error('viewCount update error', e));
    const formatDate = (date: Date) => {
      if (!date) return null;
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    return {
      ...post,
      publishedAt: formatDate(post.publishedAt),
      createdAt: formatDate(post.createdAt),
      updatedAt: formatDate(post.updatedAt),
    };
  }

  async update(id: string, updatePostDto: any, user: User): Promise<Post> {
    const post = await this.findOne(id);

    if (post.author.id !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('You can only update your own posts');
    }

    // 콘텐츠가 변경되는 경우 사용되지 않는 이미지 파일 정리
    if (updatePostDto.content && updatePostDto.content !== post.content) {
      await this.cleanupUnusedImages(post.id, post.content, updatePostDto.content, user.id);
    }

    Object.assign(post, updatePostDto);
    
    // slug 업데이트 (제목이 변경된 경우)
    if (updatePostDto.title && updatePostDto.title !== post.title) {
      await this.ensureUniqueSlug(post);
    }

    // 콘텐츠가 변경된 경우 썸네일 명시적으로 업데이트
    if (updatePostDto.content) {
      const thumbnailUrl = this.extractThumbnailFromContent(updatePostDto.content);
      post.thumbnail = thumbnailUrl;
      this.logger.log(`Post ${id} thumbnail updated to: ${thumbnailUrl || 'null'}`);
    }

    // 포스트 저장
    const savedPost = await this.postsRepository.save(post);
    
    this.logger.log(`Post ${id} updated, thumbnail: ${savedPost.thumbnail || 'none'}`);

    // 첨부 파일 업데이트
    if (updatePostDto.attachedFileIds !== undefined) {
      await this.updateAttachedFiles(savedPost.id, updatePostDto.attachedFileIds, user.id);
    }

    // 콘텐츠에서 파일 URL 추출하여 연결 (UUID 기반)
    await this.linkFilesFromContent(savedPost);

    return this.findPostById(savedPost.id);
  }

  async remove(id: string, user: User): Promise<void> {
    const post = await this.findOne(id);

    if (post.author.id !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await this.postsRepository.remove(post);
  }

  // 관리자용 메소드들
  async findAllForAdmin(page: number = 1, limit: number = 10, search?: string): Promise<{ posts: Post[]; total: number }> {
    const query = this.postsRepository.createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author');

    if (search) {
      query.where('(post.title LIKE :search OR post.content LIKE :search OR post.tags LIKE :search)', {
        search: `%${search}%`,
      });
    }

    const [posts, total] = await query
      .orderBy('post.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { posts, total };
  }

  async publish(id: string): Promise<Post> {
    const post = await this.findOne(id);
    post.isPublished = true;
    post.publishedAt = new Date();
    return this.postsRepository.save(post);
  }

  async unpublish(id: string): Promise<Post> {
    const post = await this.findOne(id);
    post.isPublished = false;
    post.publishedAt = null;
    return this.postsRepository.save(post);
  }

  async getStats(): Promise<any> {
    const totalPosts = await this.postsRepository.count();
    const publishedPosts = await this.postsRepository.count({ where: { isPublished: true } });
    const draftPosts = totalPosts - publishedPosts;

    const topCategories = await this.postsRepository
      .createQueryBuilder('post')
      .select('post.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('post.isPublished = :isPublished', { isPublished: true })
      .andWhere('post.category IS NOT NULL')
      .groupBy('post.category')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany();

    return {
      totalPosts,
      publishedPosts,
      draftPosts,
      topCategories,
    };
  }

  private async attachFiles(postId: string, fileIds: string[], userId: string): Promise<void> {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      relations: ['attachedFiles'],
    });

    if (!post) return;

    const files = await this.filesRepository.find({
      where: { 
        id: In(fileIds),
        userId: userId,
      },
    });

    post.attachedFiles = files;
    await this.postsRepository.save(post);
  }

  private async updateAttachedFiles(postId: string, fileIds: string[], userId: string): Promise<void> {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      relations: ['attachedFiles'],
    });

    if (!post) return;

    // 기존 첨부 파일들 제거
    post.attachedFiles = [];

    if (fileIds && fileIds.length > 0) {
      // 새로운 파일들 첨부
      const files = await this.filesRepository.find({
        where: { 
          id: In(fileIds),
          userId: userId,
        },
      });
      post.attachedFiles = files;
    }

    await this.postsRepository.save(post);
  }

  // 콘텐츠에서 파일 URL을 찾아서 연결 (UUID 기반 개선)
  private async linkFilesFromContent(post: Post): Promise<void> {
    try {
      const imageUrls = post.getImageUrlsFromContent();
      
      if (imageUrls.length === 0) {
        this.logger.log(`No image URLs found in post ${post.id} content`);
        return;
      }

      this.logger.log(`Found ${imageUrls.length} image URLs in post ${post.id}:`, imageUrls);

      // UUID 기반 S3 키 추출
      const s3Keys = imageUrls
        .map(url => this.extractS3KeyFromUrl(url))
        .filter(Boolean) as string[];
      
      if (s3Keys.length === 0) {
        this.logger.warn(`No valid S3 keys extracted from URLs in post ${post.id}`);
        return;
      }

      this.logger.log(`Extracted ${s3Keys.length} S3 keys:`, s3Keys);

      // S3 키로 파일 찾기 (UUID 기반)
      const files = await this.filesRepository.find({
        where: { 
          fileKey: In(s3Keys),
          userId: post.author.id 
        },
      });

      this.logger.log(`Found ${files.length} matching files in database`);

      if (files.length > 0) {
        const postWithFiles = await this.postsRepository.findOne({
          where: { id: post.id },
          relations: ['attachedFiles'],
        });

        // 기존 첨부 파일과 중복되지 않게 추가
        const existingFileIds = postWithFiles.attachedFiles?.map(f => f.id) || [];
        const newFiles = files.filter(f => !existingFileIds.includes(f.id));

        if (newFiles.length > 0) {
          postWithFiles.attachedFiles = [...(postWithFiles.attachedFiles || []), ...newFiles];
          await this.postsRepository.save(postWithFiles);
          this.logger.log(`Linked ${newFiles.length} new files to post ${post.id}`);
        } else {
          this.logger.log(`No new files to link for post ${post.id}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to link files from content for post ${post.id}:`, error.message);
    }
  }

  // UUID 기반 S3 키 추출 개선
  private extractS3KeyFromUrl(url: string): string | null {
    if (!url) return null;
    
    try {
      // 이미 S3 키인 경우 (uploads/로 시작)
      if (url.startsWith('uploads/')) {
        return url;
      }
      
      // 프록시 URL인 경우 (/api/v1/files/proxy/ 포함)
      if (url.includes('/api/v1/files/proxy/')) {
        const proxyMatch = url.match(/\/api\/v1\/files\/proxy\/(.+)/);
        if (proxyMatch) {
          const s3Key = proxyMatch[1].split('?')[0]; // 쿼리 파라미터 제거
          this.logger.log(`Extracted S3 key from proxy URL: ${url} -> ${s3Key}`);
          return s3Key;
        }
      }
      
      // S3 직접 URL인 경우 (UUID 파일명 포함)
      const s3Pattern = /https:\/\/[^\/]+\.s3\.[^\/]+\.amazonaws\.com\/(.+)/;
      const match = url.match(s3Pattern);
      if (match) {
        const s3Key = match[1].split('?')[0]; // 쿼리 파라미터 제거 (presigned URL의 경우)
        this.logger.log(`Extracted S3 key from S3 URL: ${url} -> ${s3Key}`);
        return s3Key;
      }
      
      // localhost 프록시 URL 처리 (개발 환경)
      if (url.includes('localhost:3000/api/v1/files/proxy/')) {
        const proxyMatch = url.match(/localhost:3000\/api\/v1\/files\/proxy\/(.+)/);
        if (proxyMatch) {
          const s3Key = proxyMatch[1].split('?')[0];
          this.logger.log(`Extracted S3 key from localhost proxy URL: ${url} -> ${s3Key}`);
          return s3Key;
        }
      }
      
      this.logger.warn(`Could not extract S3 key from URL: ${url}`);
      return null;
    } catch (error) {
      this.logger.error('Error extracting S3 key from URL:', error);
      return null;
    }
  }

  // 좋아요 토글 (로그인/비로그인 모두 지원)
  private likeCache = new Map<string, boolean>(); // 비로그인 유저용 메모리 캐시

  async toggleLike(id: string, user: User, ip?: string, userAgent?: string): Promise<{ liked: boolean }> {
    // QueryBuilder로 post + likedBy만 join해서 불필요한 데이터 로딩 최소화
    const post = await this.postsRepository.createQueryBuilder('post')
      .leftJoinAndSelect('post.likedBy', 'likedBy')
      .where('post.id = :id', { id })
      .select([
        'post.id', 'post.likeCount',
        'likedBy.id',
      ])
      .getOne();
    if (!post) throw new NotFoundException('Post not found');
    let key = '';
    let isLoggedIn = !!user?.id;
    if (isLoggedIn) {
      key = `like:${id}:${user.id}`;
    } else if (ip && userAgent) {
      key = `like:${id}:${ip}:${userAgent}`;
    } else {
      key = `like:${id}:unknown`;
    }
    // 로그인 유저: likedBy ManyToMany로 관리
    if (isLoggedIn) {
      const isLiked = post.likedBy?.some(likedUser => likedUser.id === user.id);
      if (isLiked) {
        post.likedBy = post.likedBy.filter(likedUser => likedUser.id !== user.id);
        post.likeCount = Math.max(0, post.likeCount - 1);
      } else {
        if (!post.likedBy) post.likedBy = [];
        post.likedBy.push(user);
        post.likeCount++;
      }
      await this.postsRepository.save(post);
      return { liked: !isLiked };
    }
    // 비로그인 유저: 메모리 캐시로 1번만 토글
    const isLiked = this.likeCache.get(key) || false;
    if (isLiked) {
      this.likeCache.set(key, false);
      post.likeCount = Math.max(0, post.likeCount - 1);
    } else {
      this.likeCache.set(key, true);
      post.likeCount++;
    }
    await this.postsRepository.save(post);
    return { liked: !isLiked };
  }

  async getCategories(): Promise<string[]> {
    const categories = await this.postsRepository
      .createQueryBuilder('post')
      .select('DISTINCT post.category', 'category')
      .where('post.isPublished = :isPublished', { isPublished: true })
      .andWhere('post.category IS NOT NULL')
      .getRawMany();

    return categories.map(cat => cat.category);
  }

  async getPostsByCategory(category: string, page: number = 1, limit: number = 10): Promise<{ posts: Post[]; total: number }> {
    const query = this.postsRepository.createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('post.isPublished = :isPublished', { isPublished: true })
      .andWhere('post.category = :category', { category });

    const [posts, total] = await query
      .orderBy('post.publishedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { posts, total };
  }

  // slug 고유성 보장 메소드
  private async ensureUniqueSlug(post: Post): Promise<void> {
    if (!post.slug) {
      // generateSlug가 호출되지 않았다면 수동으로 호출
      post.generateSlug();
    }

    let finalSlug = post.slug;
    let counter = 1;
    
    // 중복 체크 및 해결
    while (await this.postsRepository.findOne({ where: { slug: finalSlug } })) {
      const now = new Date();
      const timestamp = now.getTime().toString().slice(-6);
      finalSlug = `${post.slug}-${counter}-${timestamp}`;
      counter++;
    }
    
    post.slug = finalSlug;
  }

  async generateMissingSlugs(): Promise<void> {
    const postsWithoutSlugs = await this.postsRepository.find({
      where: { slug: null },
    });

    for (const post of postsWithoutSlugs) {
      const baseSlug = post.title
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 100);
      
      // 날짜 추가로 고유성 보장 (생성일 기준)
      const date = post.createdAt.toISOString().split('T')[0];
      const slug = `${date}-${baseSlug}`;
      
      // 중복 체크
      let finalSlug = slug;
      let counter = 1;
      while (await this.postsRepository.findOne({ where: { slug: finalSlug } })) {
        finalSlug = `${slug}-${counter}`;
        counter++;
      }
      
      post.slug = finalSlug;
      await this.postsRepository.save(post);
    }
  }

  // 기존 게시글들의 파일 연결 재처리 (UUID 기반)
  async relinkContentFiles(): Promise<void> {
    const posts = await this.postsRepository.find({
      relations: ['author'],
    });

    this.logger.log(`Starting to relink content files for ${posts.length} posts`);

    for (const post of posts) {
      try {
        await this.linkFilesFromContent(post);
        this.logger.log(`✅ Relinked files for post: ${post.title}`);
      } catch (error) {
        this.logger.error(`❌ Failed to relink files for post ${post.id}:`, error.message);
      }
    }

    this.logger.log('Finished relinking content files');
  }

  // 사용되지 않는 이미지 파일 정리 (S3 + DB)
  private async cleanupUnusedImages(postId: string, oldContent: string, newContent: string, userId: string): Promise<void> {
    try {
      // 기존 콘텐츠와 새 콘텐츠에서 이미지 URL 추출
      const oldImageUrls = this.extractImageUrlsFromContent(oldContent);
      const newImageUrls = this.extractImageUrlsFromContent(newContent);

      // 제거된 이미지 URL 찾기
      const removedImageUrls = oldImageUrls.filter(url => !newImageUrls.includes(url));

      if (removedImageUrls.length === 0) {
        this.logger.log(`No images removed from post ${postId}`);
        return;
      }

      this.logger.log(`Found ${removedImageUrls.length} removed images from post ${postId}:`, removedImageUrls);

      // S3 키 추출
      const s3Keys = removedImageUrls
        .map(url => this.extractS3KeyFromUrl(url))
        .filter(Boolean) as string[];

      if (s3Keys.length === 0) {
        this.logger.warn(`No valid S3 keys extracted from removed images in post ${postId}`);
        return;
      }

      // DB에서 해당 파일들 찾기
      const filesToDelete = await this.filesRepository.find({
        where: {
          fileKey: In(s3Keys),
          userId: userId,
        },
      });

      this.logger.log(`Found ${filesToDelete.length} files to delete from DB`);

      // 각 파일을 S3와 DB에서 삭제
      for (const file of filesToDelete) {
        try {
          // S3에서 파일 삭제 - 임시 타입 캐스팅
          await this.filesService.deleteFile(file.id, userId);
          this.logger.log(`✅ Deleted file: ${file.fileKey} (ID: ${file.id})`);
        } catch (error) {
          this.logger.error(`❌ Failed to delete file ${file.fileKey}:`, error.message);
        }
      }

      this.logger.log(`🧹 Cleanup completed for post ${postId}: ${filesToDelete.length} files deleted`);
    } catch (error) {
      this.logger.error(`Failed to cleanup unused images for post ${postId}:`, error.message);
    }
  }

  // 콘텐츠에서 이미지 URL 추출 (img 태그의 src 속성)
  private extractImageUrlsFromContent(content: string): string[] {
    if (!content) return [];

    const imgRegex = /<img[^>]+src="([^">]+)"/gi;
    const urls: string[] = [];
    let match;

    while ((match = imgRegex.exec(content)) !== null) {
      if (match[1]) {
        // 쿼리 파라미터 제거
        const cleanUrl = match[1].split('?')[0];
        urls.push(cleanUrl);
      }
    }

    return urls;
  }

  // 콘텐츠에서 썸네일 URL 추출
  private extractThumbnailFromContent(content: string): string | null {
    if (!content) return null;

    // HTML에서 첫 번째 img 태그의 src 추출
    const imgRegex = /<img[^>]+src="([^">]+)"/i;
    const match = content.match(imgRegex);
    
    if (match && match[1]) {
      return match[1];
    }

    return null;
  }
} 