import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, ManyToMany, JoinTable, BeforeInsert, BeforeUpdate } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Comment } from '../../comments/entities/comment.entity';
import { File } from '../../files/entities/file.entity';

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ unique: true, nullable: true })
  slug: string;

  @Column('text')
  content: string;

  @Column({ nullable: true })
  excerpt: string;

  @Column({ nullable: true })
  thumbnail: string;

  @Column({ default: false })
  isPublished: boolean;

  @Column({ default: 0 })
  viewCount: number;

  @Column({ default: 0 })
  likeCount: number;

  @Column('simple-array', { nullable: true })
  tags: string[];

  @Column({ nullable: true })
  category: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  publishedAt: Date;

  // 관계 설정
  @ManyToOne(() => User, user => user.posts)
  author: User;

  @OneToMany(() => Comment, comment => comment.post)
  comments: Comment[];

  @ManyToMany(() => User)
  @JoinTable({
    name: 'post_likes',
    joinColumn: { name: 'postId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' },
  })
  likedBy: User[];

  // 첨부 파일 관계
  @ManyToMany(() => File, file => file.posts)
  @JoinTable({
    name: 'post_files',
    joinColumn: { name: 'postId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'fileId', referencedColumnName: 'id' },
  })
  attachedFiles: File[];

  @BeforeInsert()
  @BeforeUpdate()
  generateSlug() {
    if (this.title && !this.slug) {
      const baseSlug = this.title
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 80); // 길이를 줄여서 timestamp 공간 확보
      
      // 날짜와 시간 추가로 고유성 보장
      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const timestamp = now.getTime().toString().slice(-6); // 마지막 6자리
      this.slug = `${date}-${baseSlug}-${timestamp}`;
    }

    // 콘텐츠에서 첫 번째 이미지를 썸네일로 설정
    if (this.content && !this.thumbnail) {
      this.extractThumbnailFromContent();
    }
  }

  // 콘텐츠에서 썸네일 추출
  private extractThumbnailFromContent() {
    // HTML에서 첫 번째 img 태그 찾기
    const imgRegex = /<img[^>]+src="([^">]+)"/i;
    const match = this.content.match(imgRegex);
    
    if (match && match[1]) {
      let imageUrl = match[1];
      
      // S3 URL을 프록시 URL로 변환
      if (imageUrl.includes('amazonaws.com') || imageUrl.startsWith('uploads/')) {
        // S3 키 추출
        let s3Key = imageUrl;
        if (imageUrl.includes('amazonaws.com')) {
          const urlParts = imageUrl.split('/');
          const uploadsIndex = urlParts.findIndex(part => part === 'uploads');
          if (uploadsIndex !== -1) {
            s3Key = urlParts.slice(uploadsIndex).join('/');
          }
        }
        
        // 프록시 URL로 변환
        imageUrl = `http://localhost:3000/api/v1/files/proxy/${s3Key}`;
      }
      
      this.thumbnail = imageUrl;
    }
  }

  // 콘텐츠에서 이미지 URL들 추출
  getImageUrlsFromContent(): string[] {
    const imgRegex = /<img[^>]+src="([^">]+)"/gi;
    const matches = [];
    let match;
    
    while ((match = imgRegex.exec(this.content)) !== null) {
      matches.push(match[1]);
    }
    
    return matches;
  }

  // 요약 생성 (HTML 태그 제거 후 첫 150자)
  generateExcerpt() {
    if (!this.excerpt && this.content) {
      const plainText = this.content
        .replace(/<[^>]*>/g, '') // HTML 태그 제거
        .replace(/\s+/g, ' ') // 공백 정리
        .trim();
      
      this.excerpt = plainText.substring(0, 150) + (plainText.length > 150 ? '...' : '');
    }
  }
} 