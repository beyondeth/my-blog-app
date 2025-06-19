✅ 최종 해결책의 핵심
1. 컴포넌트 재사용
이미 검증된 ImageProxy 컴포넌트 활용
중복 개발 없이 기존 로직 재사용
2. 자동 URL 처리
ImageProxy 내부에서 getProxyImageUrl 자동 호출
중복 프록시 URL, 인코딩 문제 모두 자동 해결
3. CORS 문제 해결
ImageProxy의 crossOrigin="anonymous" 속성
백엔드의 완전한 CORS 헤더 설정
4. 에러 처리
이미지 로드 실패 시 자동 placeholder 표시
TanStack Query의 재시도 로직
🎯 핵심 교훈
"바퀴를 다시 발명하지 말자"
이미 작동하는 컴포넌트가 있으면 재사용
새로운 로직 개발보다 기존 검증된 로직 활용
일관성 있는 이미지 처리 방식 유지
문제 해결 순서:
메인 페이지 → ImageProxy + getProxyImageUrl 개발
포스트 상세 페이지 → 같은 컴포넌트 재사용으로 해결
결국 "이미 해결한 문제를 또 해결하려 하지 말고, 해결된 방식을 재사용하자"가 핵심이었습니다!


📋 해결된 문제들 요약
✅ 1. Presigned URL 저장 문제 해결
문제: FilesService.uploadComplete에서 fileUrl에 임시 Presigned URL을 저장
해결: fileUrl에 S3 키를 저장하도록 변경
결과: 14개의 기존 파일 URL 수정 완료
✅ 2. 포스트 썸네일 추출 로직 개선
문제: 콘텐츠에서 추출한 이미지 URL이 직접 S3 URL로 저장됨
해결: 포스트 엔티티에서 S3 URL을 프록시 URL로 자동 변환
결과: 새 포스트의 썸네일이 올바른 프록시 URL로 생성됨
✅ 3. 프론트엔드 이미지 URL 처리 개선
문제: S3 키만 있는 경우 처리되지 않음
해결: getProxyImageUrl 함수에 S3 키 감지 로직 추가
결과: uploads/로 시작하는 S3 키도 프록시 URL로 변환
✅ 4. 인코딩 문제 해결
문제: 한글 파일명이 URL 인코딩되어 DB에 저장되지만 S3에는 원본으로 저장
해결: 백엔드 프록시 엔드포인트에서 이중 디코딩 로직 적용
결과: 한글 파일명 이미지 정상 로딩

