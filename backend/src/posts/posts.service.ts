import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { Post } from './entities/post.entity';
import { User } from '../users/entities/user.entity';
import { File } from '../files/entities/file.entity';
import { Role } from '../common/enums/role.enum';
import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private postsRepository: Repository<Post>,
    @InjectRepository(File)
    private filesRepository: Repository<File>,
  ) {}

  async create(createPostDto: CreatePostDto, user: User): Promise<Post> {
    // 기본 게시글 데이터 생성
    const postData = {
      title: createPostDto.title,
      content: createPostDto.content,
      excerpt: createPostDto.excerpt,
      thumbnail: createPostDto.thumbnail,
      tags: createPostDto.tags,
      category: createPostDto.category,
      author: user,
      isPublished: user.role === Role.ADMIN,
      publishedAt: user.role === Role.ADMIN ? new Date() : null,
    };

    const post = this.postsRepository.create(postData);
    
    // 요약 자동 생성 (제공되지 않은 경우)
    if (!post.excerpt) {
      post.generateExcerpt();
    }

    // slug 고유성 보장
    await this.ensureUniqueSlug(post);

    const savedPost = await this.postsRepository.save(post);

    // 첨부 파일 처리
    if (createPostDto.attachedFileIds?.length) {
      await this.attachFiles(savedPost.id, createPostDto.attachedFileIds, user.id);
    }

    // 콘텐츠에서 파일 URL 추출하여 연결
    await this.linkFilesFromContent(savedPost);

    return this.findPostById(savedPost.id);
  }

  private async findPostById(id: number): Promise<Post> {
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

  async findOne(id: number): Promise<any> {
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: ['author', 'comments', 'comments.author', 'attachedFiles'],
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // 조회수 증가
    await this.incrementViewCount(id);

    // 날짜를 YYYY-MM-DD로 변환
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

  async findBySlug(slug: string): Promise<any> {
    const post = await this.postsRepository.findOne({
      where: { slug, isPublished: true },
      relations: ['author', 'comments', 'comments.author', 'attachedFiles'],
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // 조회수 증가
    await this.incrementViewCount(post.id);

    // 날짜를 YYYY-MM-DD로 변환
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

  async update(id: number, updatePostDto: any, user: User): Promise<Post> {
    const post = await this.findOne(id);

    if (post.author.id !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('You can only update your own posts');
    }

    Object.assign(post, updatePostDto);
    
    // 요약 재생성
    if (updatePostDto.content) {
      post.generateExcerpt();
    }

    const savedPost = await this.postsRepository.save(post);

    // 첨부 파일 업데이트
    if (updatePostDto.attachedFileIds !== undefined) {
      await this.updateAttachedFiles(id, updatePostDto.attachedFileIds, user.id);
    }

    // 콘텐츠에서 파일 URL 추출하여 연결
    await this.linkFilesFromContent(savedPost);

    return savedPost;
  }

  async remove(id: number, user: User): Promise<void> {
    const post = await this.findOne(id);

    if (post.author.id !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await this.postsRepository.remove(post);
  }

  // 파일을 게시글에 첨부
  private async attachFiles(postId: number, fileIds: number[], userId: number): Promise<void> {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      relations: ['attachedFiles'],
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // 사용자가 소유한 파일들만 가져오기
    const files = await this.filesRepository.find({
      where: { 
        id: In(fileIds),
        userId: userId,
      },
    });

    post.attachedFiles = [...(post.attachedFiles || []), ...files];
    await this.postsRepository.save(post);
  }

  // 첨부 파일 업데이트
  private async updateAttachedFiles(postId: number, fileIds: number[], userId: number): Promise<void> {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      relations: ['attachedFiles'],
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // 기존 첨부 파일 제거
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

  // 콘텐츠에서 파일 URL을 찾아서 연결
  private async linkFilesFromContent(post: Post): Promise<void> {
    const imageUrls = post.getImageUrlsFromContent();
    
    if (imageUrls.length === 0) return;

    // URL로 파일 찾기
    const files = await this.filesRepository.find({
      where: { 
        fileUrl: In(imageUrls),
        userId: post.author.id,
      },
    });

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
      }
    }
  }

  async incrementViewCount(id: number): Promise<void> {
    await this.postsRepository.increment({ id }, 'viewCount', 1);
  }

  async toggleLike(id: number, user: User): Promise<{ liked: boolean }> {
    const post = await this.findOne(id);
    const isLiked = post.likedBy?.some(likedUser => likedUser.id === user.id);

    if (isLiked) {
      post.likedBy = post.likedBy.filter(likedUser => likedUser.id !== user.id);
      post.likeCount--;
    } else {
      if (!post.likedBy) post.likedBy = [];
      post.likedBy.push(user);
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
} 