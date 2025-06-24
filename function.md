# 블로그 앱 함수별 기능 요약 및 연결 관계

## 📊 엔티티 구조

### User Entity
```typescript
// 사용자 정보 관리
id: uuid, email: string, password: string, username: string
role: Role (USER/ADMIN), authProvider: AuthProvider (LOCAL/GOOGLE/KAKAO)
profileImage: string, refreshToken: string, lastLoginAt: Date
관계: OneToMany(Post), OneToMany(Comment)
```

### Post Entity
```typescript
// 블로그 게시글 관리
id: uuid, title: string, slug: string, content: text
isPublished: boolean, viewCount: number, likeCount: number
tags: string[], category: string, authorId: uuid
관계: ManyToOne(User), OneToMany(Comment), ManyToMany(File)
```

### Comment Entity
```typescript
// 댓글 관리 (계층형 구조)
id: uuid, content: text, authorId: uuid, postId: uuid
parentCommentId: uuid (대댓글용), isDeleted: boolean
관계: ManyToOne(User), ManyToOne(Post), ManyToOne(Comment), OneToMany(Comment)
```

### File Entity
```typescript
// 파일 업로드 관리
id: uuid, originalName: string, fileName: string, fileKey: string
fileUrl: string, fileSize: number, mimeType: string, fileType: string
userId: uuid
관계: ManyToOne(User), ManyToMany(Post)
```

## 🔄 백엔드 함수 흐름

### 인증 플로우 (AuthController → AuthService → UsersService)
```
1. POST /auth/register
   AuthController.register() 
   → AuthService.register() 
   → UsersService.create() 
   → User.hashPassword() 
   → DB 저장

2. POST /auth/login
   AuthController.login() 
   → AuthService.login() 
   → UsersService.findByEmail() 
   → User.validatePassword() 
   → JwtService.sign() 
   → 쿠키 설정

3. POST /auth/refresh
   AuthController.refresh() 
   → AuthService.refreshToken() 
   → JwtService.verify() 
   → 새 토큰 발급
```

### 게시글 플로우 (PostsController → PostsService → FilesService)
```
1. GET /posts (목록 조회)
   PostsController.findAll() 
   → PostsService.findAll() 
   → Repository.createQueryBuilder() 
   → 페이징/검색/정렬 적용

2. POST /posts (게시글 작성)
   PostsController.create() 
   → PostsService.create() 
   → Post.generateSlug() 
   → FilesService.linkFilesToPost() 
   → DB 저장

3. GET /posts/:slug (상세 조회)
   PostsController.findBySlug() 
   → PostsService.findBySlug() 
   → PostsService.incrementViewCount() 
   → 관련 파일/댓글 로드
```

### 파일 업로드 플로우 (FilesController → FilesService → S3Service)
```
1. POST /files/upload-url (Presigned URL 생성)
   FilesController.createUploadUrl() 
   → FilesService.createUploadUrl() 
   → S3Service.generatePresignedUrl() 
   → File 메타데이터 임시 저장

2. POST /files/upload-complete (업로드 완료)
   FilesController.uploadComplete() 
   → FilesService.completeUpload() 
   → S3Service.getObjectMetadata() 
   → File 엔티티 업데이트
```

### 댓글 플로우 (CommentsController → CommentsService → PostsService)
```
1. POST /comments (댓글 작성)
   CommentsController.create() 
   → CommentsService.create() 
   → PostsService.findOne() (게시글 존재 확인)
   → Comment 저장

2. GET /posts/:id/comments (댓글 목록)
   CommentsController.findByPost() 
   → CommentsService.findByPostId() 
   → Repository.find() (계층형 구조로 로드)
```

## 🎨 프론트엔드 함수 흐름

### 인증 플로우 (useAuth → ApiClient)
```
1. 로그인 플로우
   LoginPage.handleSubmit() 
   → useAuth.login() 
   → apiClient.login() 
   → AuthProvider.setUser() 
   → localStorage 저장 
   → 리다이렉트

2. 자동 로그인 확인
   AuthProvider.useEffect() 
   → apiClient.getProfile() 
   → setUser() 
   → 인증 상태 복원
```

### 게시글 플로우 (usePosts → ApiClient → React Query)
```
1. 목록 조회 (무한 스크롤)
   HomePage.useInfinitePosts() 
   → usePosts.useInfinitePosts() 
   → apiClient.getPosts() 
   → React Query 캐싱 
   → PostArticle 렌더링

2. 게시글 작성
   NewPostPage.handleSubmit() 
   → usePosts.useCreatePost() 
   → apiClient.createPost() 
   → React Query 캐시 무효화 
   → 목록 업데이트

3. 게시글 상세
   PostDetailPage.usePost() 
   → usePosts.usePost() 
   → apiClient.getPostBySlug() 
   → ContentRenderer.processContent() 
   → 이미지 모달 처리
```

### 파일 업로드 플로우 (useFiles → useImageModal → ImageUtils)
```
1. 이미지 업로드 (TipTap 에디터)
   RichTextEditor.useUploadFile() 
   → convertImageToWebP() (WebP 변환)
   → useFiles.useCreateUploadUrl() 
   → apiClient.createUploadUrl() 
   → apiClient.uploadFileToS3() 
   → useFiles.useUploadComplete()

2. 이미지 모달 처리
   ContentRenderer.handleImageClick() 
   → useImageModal.openModal() 
   → ImageModal 렌더링 
   → 확대/축소/회전 기능
```

### 상태 관리 플로우 (React Query → 컴포넌트)
```
1. 캐시 관리
   usePosts.useCreatePost() 
   → onSuccess() 
   → queryClient.invalidateQueries() 
   → queryClient.setQueryData() (낙관적 업데이트)

2. 검색 기능
   SearchSection.handleSearch() 
   → useNavigationCache.updateSearchParams() 
   → usePosts.useInfinitePosts({ search }) 
   → 필터링된 결과 표시
```

## 🔗 주요 연결 관계

### 백엔드 모듈 의존성
```
AppModule
├── AuthModule (UsersModule 의존)
├── PostsModule (UsersModule, FilesModule 의존)
├── CommentsModule (UsersModule, PostsModule 의존)
├── FilesModule (독립적)
└── UsersModule (독립적)
```

### 프론트엔드 컴포넌트 계층
```
Layout
├── Header (useAuth)
├── SearchSection (useNavigationCache)
├── PostArticle (usePosts, useAuth)
├── ContentRenderer (useImageModal)
├── RichTextEditor (useFiles, useUploadFile)
└── ImageModal (useImageModal)
```

### API 통신 패턴
```
Frontend Hook → ApiClient → Axios → Backend Controller → Service → Repository → Database
                     ↓
React Query Cache ← Response ← HTTP Response ← DTO ← Entity ← TypeORM
```

## 🚀 핵심 최적화 패턴

### 1. 이미지 처리 최적화
```
업로드: File → convertImageToWebP() → S3 Presigned URL → 압축된 WebP
표시: normalizeImageUrl() → 프록시 처리 → 최적화된 이미지
모달: React 이벤트 위임 → useImageModal → 포털 렌더링
```

### 2. 캐싱 전략
```
React Query: staleTime(5분) + gcTime(10분) + 낙관적 업데이트
Navigation: useNavigationCache → URL 상태 동기화
Auth: localStorage + 자동 토큰 갱신
```

### 3. 성능 최적화
```
무한 스크롤: useInfiniteQuery + 페이징
이벤트 처리: useCallback + React 이벤트 위임 (useEffect 대신)
컴포넌트: React.memo + 조건부 렌더링
```

### 4. 보안 처리
```
인증: JWT + HttpOnly Cookie + Refresh Token
XSS: DOMPurify + 안전한 클래스 필터링
파일: MIME 타입 검증 + S3 Presigned URL
```

## 📝 주요 함수별 역할

### 백엔드 핵심 함수
- `AuthService.login()`: 로그인 처리 + JWT 발급
- `PostsService.findAll()`: 게시글 목록 + 검색/페이징
- `FilesService.createUploadUrl()`: S3 Presigned URL 생성
- `S3Service.generatePresignedUrl()`: AWS S3 연동

### 프론트엔드 핵심 함수
- `useAuth.login()`: 인증 상태 관리
- `useInfinitePosts()`: 무한 스크롤 게시글 목록
- `convertImageToWebP()`: 이미지 WebP 변환
- `useImageModal.handleImageClick()`: 이미지 모달 처리

이 구조는 **모듈화**, **재사용성**, **성능 최적화**를 중심으로 설계되어 있으며, 각 함수가 단일 책임을 가지면서도 유기적으로 연결되어 있습니다. 