"use client";

import { useParams } from 'next/navigation';
import { usePost } from '@/hooks/usePost';
import { useUpdatePost } from '@/hooks/useUpdatePost';
import EditPostForm from '@/components/posts/EditPostForm';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';

/**
 * Context7 권장 패턴: 백엔드 중심 권한 체크
 * 
 * 복잡한 프론트엔드 권한 로직을 제거하고
 * 백엔드의 403/401 응답에 의존하여 권한을 체크합니다.
 * 
 * 이전: 200줄+ 복잡한 권한 체크 로직
 * 현재: 30줄 간단한 데이터 페칭 + 폼 렌더링
 */
export default function EditPostPage() {
  const { slug } = useParams();
  const postSlug = Array.isArray(slug) ? slug[0] : slug;
  const { data: post, isLoading, error } = usePost(postSlug);
  const updatePost = useUpdatePost();

  if (isLoading) return <LoadingSpinner />;
  if (error || !post) return <ErrorMessage message="게시글을 불러올 수 없습니다." />;

  return (
    <EditPostForm
      initialData={post}
      isLoading={updatePost.isPending}
      onSubmit={(formData) => updatePost.mutate({ id: post.id, data: formData })}
      onCancel={() => window.history.back()}
    />
  );
} 