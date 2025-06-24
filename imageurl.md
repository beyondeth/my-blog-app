# 이미지 업로드 문제 해결 가이드

## 📋 문제 요약

TipTap 에디터에서 이미지 업로드 시 `500 Internal Server Error` 발생
- **에러 메시지**: `Failed to generate upload URL`
- **발생 위치**: presigned URL 요청 단계에서 백엔드 거부

## 🔍 문제 원인 분석

### 1. **백엔드 정책 불일치**
```typescript
// FilesService.ts - 기존 코드
const allowedTypes = this.configService.get<string>('SUPPORTED_IMAGE_TYPES', 
  'image/jpeg,image/jpg,image/png,image/gif,image/webp').split(',');
// → PNG, JPG 등 다양한 형식 허용

// S3Service.ts - 기존 코드  
if (fileType === 'image' && mimeType !== 'image/webp') {
  throw new BadRequestException('이미지 업로드는 WebP 형식만 허용됩니다.');
}
// → WebP만 허용
```

**문제**: FilesService는 다양한 이미지 형식을 허용하지만, S3Service는 WebP만 허용하는 모순

### 2. **프론트엔드 WebP 변환 누락**
```typescript
// TipTap 에디터의 useUploadFile 훅
return await apiClient.uploadFile(file, validFileType);
// → 원본 파일(PNG/JPG)을 그대로 전달
```

**문제**: TipTap 에디터에서 이미지 업로드 시 WebP 변환 없이 원본 파일 정보를 백엔드로 전달

### 3. **업로드 플로우 불일치**
- **FileUpload 컴포넌트**: WebP 변환 로직 구현됨
- **TipTap 에디터**: WebP 변환 로직 없음
- **결과**: 같은 앱 내에서 업로드 방식이 달라 일관성 부족

## 🛠️ 해결 방법

### 1. **백엔드 정책 통일 (FilesService 수정)**

```typescript
// backend/src/files/files.service.ts
async createUploadUrl(
  userId: string, 
  createUploadUrlDto: CreateUploadUrlDto
): Promise<PresignedUrlResponse & { tempId: string; uuidFileName: string; s3Key: string }> {
  const { fileName, mimeType, fileSize, fileType } = createUploadUrlDto;

  try {
    // 이미지 파일인 경우 WebP만 허용
    if (fileType === 'image' && mimeType !== 'image/webp') {
      throw new Error('이미지 업로드는 WebP 형식만 허용됩니다.');
    }

    // 문서 파일인 경우 기존 검증 로직 적용
    if (fileType !== 'image') {
      const allowedTypes = this.configService.get<string>('SUPPORTED_IMAGE_TYPES', 
        'image/jpeg,image/jpg,image/png,image/gif,image/webp').split(',');
      
      if (isImageMimeType(mimeType) && !validateMimeType(mimeType, allowedTypes)) {
        throw new Error(`Unsupported image type: ${mimeType}`);
      }
    }
    
    // ... 나머지 로직
  }
}
```

**효과**: FilesService와 S3Service 모두 이미지는 WebP만 허용하도록 통일

### 2. **프론트엔드 WebP 변환 로직 추가**

#### A. imageUtils.ts에 변환 함수 추가
```typescript
// frontend/src/utils/imageUtils.ts
import imageCompression from 'browser-image-compression';

export async function convertImageToWebP(file: File): Promise<File> {
  try {
    const options = {
      maxSizeMB: 10,
      maxWidthOrHeight: 2048,
      useWebWorker: true,
      fileType: 'image/webp' as const,
      initialQuality: 0.8,
    };

    const compressedFile = await imageCompression(file, options);
    
    // 파일명 변경 (.webp 확장자로)
    const originalName = file.name;
    const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    const webpFileName = `${nameWithoutExt}.webp`;
    
    const webpFile = new File([compressedFile], webpFileName, {
      type: 'image/webp',
      lastModified: Date.now(),
    });

    return webpFile;
  } catch (error) {
    throw new Error('WebP 변환에 실패했습니다. 다른 이미지를 시도해 주세요.');
  }
}
```

#### B. useUploadFile 훅에 변환 로직 통합
```typescript
// frontend/src/hooks/useFiles.ts
import { convertImageToWebP } from '@/utils/imageUtils';

export function useUploadFile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ file, fileType }: { file: File; fileType?: FileTypeType }) => {
      const validFileType = fileType && Object.values(FileType).includes(fileType) 
        ? fileType 
        : FileType.GENERAL;
      
      let fileToUpload = file;
      
      // 이미지 파일이고 WebP가 아니면 변환
      if (validFileType === FileType.IMAGE && file.type !== 'image/webp') {
        try {
          fileToUpload = await convertImageToWebP(file);
        } catch (error) {
          throw new Error('WebP 변환에 실패했습니다. 이미지는 WebP 형식만 업로드할 수 있습니다.');
        }
      }
      
      return await apiClient.uploadFile(fileToUpload, validFileType);
    },
    // ... 나머지 옵션
  });
}
```

**효과**: 모든 이미지 업로드(TipTap 에디터, FileUpload 컴포넌트 등)에서 자동 WebP 변환

### 3. **필요 패키지 설치**
```bash
npm install browser-image-compression
```

## ✅ 해결 결과

### 수정 전
```
사용자 PNG 이미지 선택
    ↓
TipTap 에디터에서 원본 PNG 정보로 presigned URL 요청
    ↓
백엔드에서 "WebP만 허용" 정책으로 거부
    ↓
500 Internal Server Error 발생
```

### 수정 후
```
사용자 PNG 이미지 선택
    ↓
useUploadFile 훅에서 자동으로 WebP 변환
    ↓
변환된 WebP 파일 정보로 presigned URL 요청
    ↓
백엔드에서 WebP 파일 허용하여 presigned URL 발급
    ↓
S3에 WebP 파일 업로드 성공
    ↓
TipTap 에디터에 이미지 표시 완료
```

## 🎯 핵심 포인트

1. **일관성**: 백엔드와 프론트엔드 모두 이미지는 WebP만 처리
2. **자동화**: 사용자는 원본 이미지를 선택하지만 자동으로 WebP 변환
3. **최적화**: WebP 형식으로 파일 크기 최적화 및 성능 향상
4. **범용성**: 모든 이미지 업로드 경로에서 동일한 변환 로직 적용

## 🔧 테스트 방법

1. **TipTap 에디터에서 이미지 업로드 버튼 클릭**
2. **PNG/JPG 이미지 선택**
3. **브라우저 콘솔에서 변환 로그 확인**:
   ```
   [useUploadFile] Converting image to WebP: {originalName: "xxx.png", ...}
   [DEBUG] WebP conversion completed {original: {...}, converted: {...}}
   [useUploadFile] WebP conversion completed: {convertedName: "xxx.webp", ...}
   [DEBUG] Image upload completed
   ```
4. **500 에러 없이 이미지 업로드 성공 확인**

## 📚 관련 파일

- **백엔드**: `backend/src/files/files.service.ts`
- **프론트엔드**: 
  - `frontend/src/hooks/useFiles.ts`
  - `frontend/src/utils/imageUtils.ts`
  - `frontend/src/components/posts/RichTextEditor.tsx`

## 🚀 추가 개선 사항

1. **에러 처리 강화**: WebP 변환 실패 시 사용자 친화적 메시지
2. **로딩 상태**: 변환 중 로딩 인디케이터 표시
3. **진행률**: 대용량 이미지 변환 시 진행률 표시
4. **품질 설정**: 사용자가 WebP 품질 조정 가능하도록 개선 