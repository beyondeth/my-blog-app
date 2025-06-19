import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post as PostEntity } from './entities/post.entity';
import { File as FileEntity } from '../files/entities/file.entity';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    @InjectRepository(PostEntity)
    private postsRepository: Repository<PostEntity>,
    @InjectRepository(FileEntity)
    private filesRepository: Repository<FileEntity>,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '게시글 작성' })
  @ApiBearerAuth()
  create(@Body() createPostDto: CreatePostDto, @CurrentUser() user: User) {
    return this.postsService.create(createPostDto, user);
  }

  @Get()
  @ApiOperation({ summary: '게시글 목록 조회' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.postsService.findAll(pageNumber, limitNumber, search);
  }

  @Get('categories')
  @ApiOperation({ summary: '카테고리 목록 조회' })
  getCategories() {
    return this.postsService.getCategories();
  }

  @Get('category/:category')
  @ApiOperation({ summary: '카테고리별 게시글 조회' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getPostsByCategory(
    @Param('category') category: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.postsService.getPostsByCategory(category, pageNumber, limitNumber);
  }

  @Get(':id')
  @ApiOperation({ summary: '게시글 상세 조회' })
  findOne(@Param('id') id: string) {
    return this.postsService.findOne(+id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Slug로 게시글 조회' })
  findBySlug(@Param('slug') slug: string) {
    return this.postsService.findBySlug(slug);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: '게시글 수정' })
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() updatePostDto: any, @CurrentUser() user: User) {
    return this.postsService.update(+id, updatePostDto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: '게시글 삭제' })
  @ApiBearerAuth()
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.postsService.remove(+id, user);
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '게시글 좋아요 토글' })
  @ApiBearerAuth()
  toggleLike(@Param('id') id: string, @CurrentUser() user: User) {
    return this.postsService.toggleLike(+id, user);
  }

  @Post('generate-slugs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '기존 게시글에 slug 생성 (관리자만)' })
  @ApiBearerAuth()
  async generateSlugs() {
    await this.postsService.generateMissingSlugs();
    return { message: 'Slugs generated successfully' };
  }

  @Get('debug/thumbnails')
  @Public()
  async debugThumbnails() {
    try {
      const postsData = await this.postsService.findAll(1, 10);
      const posts = postsData.posts;

      const result = posts.map(post => {
        // 콘텐츠에서 이미지 URL 추출
        const imgRegex = /<img[^>]+src="([^">]+)"/gi;
        const matches = [];
        let match;
        
        while ((match = imgRegex.exec(post.content)) !== null) {
          matches.push(match[1]);
        }

        return {
          id: post.id,
          title: post.title,
          thumbnail: post.thumbnail,
          contentImages: matches,
          hasImages: matches.length > 0,
        };
      });

      return { 
        status: 'success', 
        posts: result,
        totalPosts: posts.length 
      };
    } catch (error) {
      return { 
        status: 'error', 
        message: error.message 
      };
    }
  }

  @Post('debug/fix-file-urls')
  @Public()
  async fixFileUrls() {
    try {
      // 잘못된 fileUrl을 가진 파일들 수정
      const files = await this.filesRepository.find();
      let fixedCount = 0;

      for (const file of files) {
        // Presigned URL이 저장된 경우 fileKey로 교체
        if (file.fileUrl && (file.fileUrl.includes('X-Amz-') || file.fileUrl.includes('amazonaws.com'))) {
          file.fileUrl = file.fileKey;
          await this.filesRepository.save(file);
          fixedCount++;
        }
      }

      return {
        status: 'success',
        message: `Fixed ${fixedCount} file URLs`,
        totalFiles: files.length,
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
      };
    }
  }

  @Post('debug/regenerate-thumbnails')
  @Public()
  async regenerateThumbnails() {
    try {
      const posts = await this.postsRepository.find();
      let updatedCount = 0;

      for (const post of posts) {
        if (post.content) {
          const oldThumbnail = post.thumbnail;
          // 썸네일 재생성
          post.generateSlug(); // BeforeUpdate 훅 호출
          await this.postsRepository.save(post);
          
          if (oldThumbnail !== post.thumbnail) {
            updatedCount++;
          }
        }
      }

      return {
        status: 'success',
        message: `Regenerated thumbnails for ${updatedCount} posts`,
        totalPosts: posts.length,
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
      };
    }
  }

  @Get('debug/content/:id')
  @Public()
  async debugPostContent(@Param('id') id: string) {
    try {
      const post = await this.postsRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['author'],
      });

      if (!post) {
        return {
          status: 'error',
          message: 'Post not found',
        };
      }

      // 콘텐츠에서 이미지 URL 추출
      const imgRegex = /<img[^>]+src="([^">]+)"/gi;
      const matches = [];
      let match;
      
      while ((match = imgRegex.exec(post.content)) !== null) {
        matches.push(match[1]);
      }

      return {
        status: 'success',
        post: {
          id: post.id,
          title: post.title,
          content: post.content,
          thumbnail: post.thumbnail,
          contentImages: matches,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
      };
    }
  }

  @Get('debug/data')
  @Public()
  async getDebugData() {
    const { posts } = await this.postsService.findAll(1, 5);
    return {
      message: 'Debug data for posts',
      posts: posts.map(post => ({
        id: post.id,
        title: post.title,
        thumbnail: post.thumbnail,
        thumbnailType: typeof post.thumbnail,
        hasContent: !!post.content,
        contentLength: post.content?.length || 0,
        firstImageInContent: post.content ? this.extractFirstImageFromContent(post.content) : null,
      }))
    };
  }

  private extractFirstImageFromContent(content: string): string | null {
    const imgRegex = /<img[^>]+src="([^">]+)"/i;
    const match = content.match(imgRegex);
    return match ? match[1] : null;
  }

  @Get('debug/:slug')
  @Public()
  @ApiOperation({ summary: '포스트 디버깅 - 콘텐츠 및 이미지 URL 확인' })
  async debugPost(@Param('slug') slug: string) {
    try {
      const post = await this.postsService.findBySlug(slug);
      
      // HTML에서 이미지 URL 추출
      const imageUrls = [];
      const imgRegex = /<img[^>]+src="([^"]*)"/g;
      let match;
      while ((match = imgRegex.exec(post.content)) !== null) {
        imageUrls.push(match[1]);
      }
      
      return {
        status: 'success',
        post: {
          id: post.id,
          title: post.title,
          slug: post.slug,
          thumbnail: post.thumbnail,
          contentLength: post.content?.length || 0,
          contentPreview: post.content?.substring(0, 500) + '...',
          extractedImageUrls: imageUrls,
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
      };
    }
  }
} 