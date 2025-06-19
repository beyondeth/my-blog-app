// 사용자 관련 타입
export interface User {
  id: number;
  email: string;
  username: string;
  profileImage?: string;
  role: 'admin' | 'user';
  authProvider: 'local' | 'google' | 'kakao';
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export enum Role {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator'
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (credentials: LoginForm) => Promise<void>;
  register: (userData: RegisterForm) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  error: string | null;
}

// 게시글 관련 타입
export interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  thumbnail?: string;
  isPublished: boolean;
  viewCount: number;
  likeCount: number;
  tags?: string[];
  category?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  author: User;
  comments?: Comment[];
  likedBy?: User[];
}

// 댓글 관련 타입
export interface Comment {
  id: number;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  author: User;
  post: Post;
  parentComment?: Comment;
  replies?: Comment[];
}

// API 응답 타입
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
  details?: any;
}

export interface PaginatedResponse<T> {
  posts: T[];
  total: number;
}

// 폼 관련 타입
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  email: string;
  password: string;
  username: string;
}

export interface PostForm {
  title: string;
  content: string;
  excerpt?: string;
  thumbnail?: string;
  tags?: string[];
  category?: string;
}

export interface CommentForm {
  content: string;
  postId: number;
  parentCommentId?: number;
}

// 검색 및 필터링 타입
export interface SearchParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
}

// 테마 관련 타입
export type Theme = 'light' | 'dark';

// 관리자 대시보드 타입
export interface DashboardStats {
  totalPosts: number;
  totalUsers: number;
  totalComments: number;
  totalViews: number;
}

export interface UserActivity {
  id: number;
  userId: number;
  action: string;
  target: string;
  createdAt: string;
}

// 파일 업로드 관련 타입
export interface FileUpload {
  id: number;
  originalName: string;
  fileName: string;
  fileKey: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  fileType: 'image' | 'document' | 'video' | 'general';
  userId: number;
  user?: User;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUploadUrlDto {
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileType?: 'image' | 'document' | 'video' | 'general';
}

export interface UploadCompleteDto {
  fileKey: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileType?: string;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  fileKey: string;
  expiresIn: number;
  tempId?: string;
}

export interface FileStats {
  totalFiles: number;
  totalSize: number;
  byType: Array<{
    fileType: string;
    count: number;
    totalSize: number;
  }>;
} 