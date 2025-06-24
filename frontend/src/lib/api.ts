import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { 
  AuthResponse, 
  LoginForm, 
  RegisterForm, 
  User,
  ApiResponse, 
  ApiError,
  PaginatedResponse, 
  Post, 
  Comment, 
  PostForm, 
  CommentForm,
  FileUpload,
  CreateUploadUrlDto,
  UploadCompleteDto,
  PresignedUrlResponse,
  FileStats
} from '../types/index';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

class ApiClient {
  private client: AxiosInstance;
  private refreshTokenPromise: Promise<string | null> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      withCredentials: true, // 쿠키 전송을 위해 필요
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // 요청 인터셉터 (Authorization 헤더 제거 - 쿠키 사용)
    this.client.interceptors.request.use(
      (config) => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔄 API Request: ${config.method?.toUpperCase()} ${config.url}`);
        }
        return config;
      },
      (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // 응답 인터셉터
    this.client.interceptors.response.use(
      (response) => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ API Response: ${response.status} ${response.config.url}`);
        }
        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // 토큰 갱신을 시도하지 않아야 하는 경우들
        const skipRefreshUrls = [
          '/auth/login',
          '/auth/register',
          '/auth/refresh',
          '/auth/logout',
        ];

        const shouldSkipRefresh = 
          skipRefreshUrls.some(url => originalRequest.url?.includes(url)) ||
          originalRequest._retry ||
          error.response?.status !== 401;

        if (shouldSkipRefresh) {
          return Promise.reject(error);
        }

        // 401 에러이고 재시도하지 않은 경우에만 토큰 갱신 시도
        originalRequest._retry = true;

        try {
          // 토큰 갱신 시도
          await this.refreshToken();
          // 원래 요청 재시도
          return this.client(originalRequest);
        } catch (refreshError) {
          // 토큰 갱신 실패 시 로그아웃 처리
          this.handleLogout();
          return Promise.reject(error);
        }
      }
    );
  }

  // 토큰 관련 메서드들 제거 (쿠키 사용으로 불필요)
  private getStoredToken(): string | null {
    // 쿠키 기반 인증으로 변경되어 더 이상 사용하지 않음
    return null;
  }

  private setStoredToken(token: string): void {
    // 쿠키 기반 인증으로 변경되어 더 이상 사용하지 않음
    // 백엔드에서 HttpOnly 쿠키로 자동 설정됨
  }

  private removeStoredToken(): void {
    // localStorage에 저장된 기존 토큰 제거 (마이그레이션을 위해)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('access_token');
    }
  }

  private async refreshToken(): Promise<string | null> {
    if (this.refreshTokenPromise) {
      return this.refreshTokenPromise;
    }

    this.refreshTokenPromise = this.performTokenRefresh();
    const result = await this.refreshTokenPromise;
    this.refreshTokenPromise = null;
    return result;
  }

  private async performTokenRefresh(): Promise<string | null> {
    try {
      await this.client.post('/auth/refresh');
      return 'refreshed'; // 쿠키가 자동으로 업데이트됨
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  }

  private handleLogout(): void {
    this.removeStoredToken();
    // 자동 리다이렉트하지 않고 토큰만 제거
    // 실제 로그아웃은 useAuth에서 처리
  }

  private handleError(error: any): ApiError {
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        data: error.response?.data,
      });
    }

    const apiError: ApiError = {
      message: error.response?.data?.message || error.message || 'An error occurred',
      statusCode: error.response?.status || 500,
      error: error.response?.data?.error,
      details: error.response?.data?.details,
    };

    return apiError;
  }

  // Generic request method
  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client(config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Auth API
  async login(credentials: LoginForm): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>({
      method: 'POST',
      url: '/auth/login',
      data: credentials,
    });
    
    // 쿠키 기반이므로 토큰 저장 불필요
    return response;
  }

  async register(userData: RegisterForm): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>({
      method: 'POST',
      url: '/auth/register',
      data: userData,
    });
    
    // 쿠키 기반이므로 토큰 저장 불필요
    return response;
  }

  async getProfile(): Promise<User> {
    return this.request<User>({
      method: 'GET',
      url: '/users/profile',
    });
  }

  async logout(): Promise<void> {
    try {
      await this.request({
        method: 'POST',
        url: '/auth/logout',
      });
    } finally {
      this.removeStoredToken();
    }
  }

  // Posts API
  async getPosts(params?: { 
    page?: number; 
    limit?: number; 
    search?: string; 
    category?: string; 
  }): Promise<PaginatedResponse<Post>> {
    return this.request<PaginatedResponse<Post>>({
      method: 'GET',
      url: '/posts',
      params,
    });
  }

  async getPost(id: number): Promise<Post> {
    return this.request<Post>({
      method: 'GET',
      url: `/posts/${id}`,
    });
  }

  async getPostBySlug(slug: string): Promise<Post> {
    return this.request<Post>({
      method: 'GET',
      url: `/posts/slug/${slug}`,
    });
  }

  async createPost(data: PostForm): Promise<Post> {
    return this.request<Post>({
      method: 'POST',
      url: '/posts',
      data,
    });
  }

  async updatePost(id: number, data: Partial<PostForm>): Promise<Post> {
    return this.request<Post>({
      method: 'PATCH',
      url: `/posts/${id}`,
      data,
    });
  }

  async deletePost(id: number): Promise<void> {
    return this.request<void>({
      method: 'DELETE',
      url: `/posts/${id}`,
    });
  }

  async toggleLike(id: number): Promise<{ liked: boolean }> {
    return this.request<{ liked: boolean }>({
      method: 'POST',
      url: `/posts/${id}/like`,
    });
  }

  // 여러 포스트의 좋아요 상태를 한 번에 서버로 전송 (배치)
  async batchUpdateLikes(batch: Record<number, boolean>): Promise<void> {
    // TODO: 실제 엔드포인트에 맞게 구현
    // return this.request({ method: 'POST', url: '/posts/likes/batch', data: batch });
    return Promise.resolve();
  }

  // Comments API
  async getComments(postId: number): Promise<Comment[]> {
    return this.request<Comment[]>({
      method: 'GET',
      url: `/comments/post/${postId}`,
    });
  }

  async createComment(data: CommentForm): Promise<Comment> {
    return this.request<Comment>({
      method: 'POST',
      url: '/comments',
      data,
    });
  }

  async updateComment(id: number, content: string): Promise<Comment> {
    return this.request<Comment>({
      method: 'PUT',
      url: `/comments/${id}`,
      data: { content },
    });
  }

  async deleteComment(id: number): Promise<void> {
    return this.request<void>({
      method: 'DELETE',
      url: `/comments/${id}`,
    });
  }

  // Files API
  async createUploadUrl(data: CreateUploadUrlDto): Promise<PresignedUrlResponse> {
    return this.request<PresignedUrlResponse>({
      method: 'POST',
      url: '/files/upload-url',
      data,
    });
  }

  async uploadComplete(data: UploadCompleteDto): Promise<FileUpload> {
    return this.request<FileUpload>({
      method: 'POST',
      url: '/files/upload-complete',
      data,
    });
  }

  async uploadFileToS3(file: File, uploadUrl: string): Promise<void> {
    // S3에 직접 업로드 (Presigned URL 사용)
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.statusText}`);
    }
  }

  async getUserFiles(params?: {
    fileType?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<FileUpload>> {
    return this.request<PaginatedResponse<FileUpload>>({
      method: 'GET',
      url: '/files',
      params,
    });
  }

  async getFile(id: number): Promise<FileUpload> {
    return this.request<FileUpload>({
      method: 'GET',
      url: `/files/${id}`,
    });
  }

  async getFileDownloadUrl(id: number): Promise<{ downloadUrl: string }> {
    return this.request<{ downloadUrl: string }>({
      method: 'GET',
      url: `/files/${id}/download-url`,
    });
  }

  async deleteFile(id: number): Promise<void> {
    return this.request<void>({
      method: 'DELETE',
      url: `/files/${id}`,
    });
  }

  async getFileStats(): Promise<FileStats> {
    return this.request<FileStats>({
      method: 'GET',
      url: '/files/stats',
    });
  }

  // 통합 파일 업로드 메서드
  async uploadFile(file: File, fileType: 'image' | 'document' | 'video' | 'general' = 'general'): Promise<FileUpload> {
    try {
      console.log('🚀 uploadFile started:', {
        fileName: file.name,
        fileType,
        apiBaseUrl: API_BASE_URL,
        hasToken: !!this.getStoredToken()
      });

      // 1. Presigned URL 요청 - 반드시 인자로 받은 file 객체의 정보 사용
      const uploadData: CreateUploadUrlDto = {
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        fileType,
      };

      console.log('📤 Requesting presigned URL with data:', uploadData);
      const presignedResponse = await this.createUploadUrl(uploadData);
      console.log('📥 Presigned URL response:', presignedResponse);

      // 2. S3에 파일 업로드 (file 객체 그대로)
      await this.uploadFileToS3(file, presignedResponse.uploadUrl);

      // 3. 업로드 완료 알림 - file 객체 정보 그대로 사용
      const completeData: UploadCompleteDto = {
        fileKey: presignedResponse.fileKey,
        fileUrl: `https://myblogdata84.s3.us-east-1.amazonaws.com/${presignedResponse.fileKey}`,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        fileType: fileType
      };

      console.log('실제 업로드할 파일 정보:', file.name, file.type, file.size);
      return await this.uploadComplete(completeData);
    } catch (error) {
      console.error('File upload failed:', error);
      throw error;
    }
  }

  // OAuth methods
  googleAuth(): void {
    if (typeof window !== 'undefined') {
      window.location.href = `${API_BASE_URL}/auth/google`;
    }
  }

  kakaoAuth(): void {
    if (typeof window !== 'undefined') {
      window.location.href = `${API_BASE_URL}/auth/kakao`;
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export posts API for convenience
export const postsAPI = {
  getPosts: (params?: { page?: number; limit?: number; search?: string; category?: string; }) => 
    apiClient.getPosts(params),
  getPost: (id: number) => apiClient.getPost(id),
  getPostBySlug: (slug: string) => apiClient.getPostBySlug(slug),
  createPost: (data: PostForm) => apiClient.createPost(data),
  updatePost: (id: number, data: Partial<PostForm>) => apiClient.updatePost(id, data),
  deletePost: (id: number) => apiClient.deletePost(id),
  toggleLike: (id: number) => apiClient.toggleLike(id),
  batchUpdateLikes: (batch: Record<number, boolean>) => apiClient.batchUpdateLikes(batch),
};

// Export for backward compatibility
export default apiClient; 