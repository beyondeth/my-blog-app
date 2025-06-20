'use client';

import { useParams, useRouter } from 'next/navigation';
import { FiArrowLeft } from 'react-icons/fi';
import ContentRenderer from '@/components/ui/ContentRenderer';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import PostHeader from '@/components/posts/PostHeader';
import AuthorInfo from '@/components/posts/AuthorInfo';
import { useAuth } from '@/hooks/useAuth';
import { usePost, useDeletePost, useTogglePostLike } from '@/hooks/usePosts';
import { useState, useCallback } from 'react';

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [liked, setLiked] = useState(false);

  const slug = params.slug as string;

  // 커스텀 훅 사용
  const { data: post, isLoading, error, isError } = usePost(slug);
  const deletePostMutation = useDeletePost();
  const likeMutation = useTogglePostLike(slug);

  const handleEdit = useCallback(() => {
    if (post) {
      router.push(`/posts/edit/${post.slug || post.id}`);
    }
  }, [post, router]);

  const handleDelete = useCallback(async () => {
    if (!post) return;
    
    if (confirm('정말로 이 게시글을 삭제하시겠습니까?')) {
      deletePostMutation.mutate(post.id, {
        onSuccess: () => router.push('/'),
      });
    }
  }, [post, deletePostMutation, router]);

  const handleLike = useCallback(() => {
    if (!post) return;
    likeMutation.mutate(post.id, {
      onSuccess: (response) => setLiked(response.liked),
    });
  }, [post, likeMutation]);

  const handleShare = useCallback(async () => {
    if (navigator.share && post) {
      try {
        await navigator.share({
          title: post.title,
          text: '흥미로운 글을 공유합니다!',
          url: window.location.href,
        });
      } catch (error) {
        console.log('공유 취소됨');
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('링크가 클립보드에 복사되었습니다!');
    }
  }, [post]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // 로딩 상태 - 최소 높이 보장으로 헤더 안정화
  if (isLoading) {
    return (
      <div className="min-h-screen">
        {/* 로딩 컨텐츠 */}
        <article className="max-w-3xl mx-auto px-6 py-16">
          <div className="animate-pulse">
            {/* 제목 스켈레톤 */}
            <div className="h-6 bg-gray-200 rounded mb-8"></div>
            {/* 메타 정보 스켈레톤 */}
            <div className="flex space-x-4 mb-8">
              <div className="h-4 bg-gray-200 rounded w-20"></div>
              <div className="h-4 bg-gray-200 rounded w-24"></div>
              <div className="h-4 bg-gray-200 rounded w-16"></div>
            </div>
            {/* 본문 스켈레톤 */}
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        </article>
      </div>
    );
  }

  // 에러 상태
  if (isError || !post) {
    return (
      <div className="min-h-screen">
        <ErrorMessage 
          message={error?.message || 'Post not found'}
          onBack={() => router.push('/')}
        />
      </div>
    );
  }

  const canEdit = isAdmin || post.author?.id === user?.id;

  return (
    <>
      {/* Article Content */}
      <article className="max-w-3xl mx-auto px-6 py-16">
        <PostHeader 
          post={post}
          canEdit={canEdit}
          onBack={handleBack}
          onEdit={handleEdit}
          onDelete={handleDelete}
          liked={liked}
          likeCount={post.likeCount}
          onLike={handleLike}
          onShare={handleShare}
        />

        {/* Article Body - 14px 크기, 모티브 블로그와 동일한 색상 */}
        <div className="blog-content">
          <ContentRenderer content={post.content} />
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="mt-16 pt-8 border-t border-gray-100">
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 text-xs font-medium bg-gray-100 text-gray-900 rounded-full hover:bg-gray-200 cursor-pointer transition-colors"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <AuthorInfo author={post.author} />
      </article>
    </>
  );
} 