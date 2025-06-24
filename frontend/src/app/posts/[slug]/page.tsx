'use client';

import { useParams, useRouter } from 'next/navigation';
import { FiArrowLeft } from 'react-icons/fi';
import ContentRenderer from '@/components/ui/ContentRenderer';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import PostHeader from '@/components/posts/PostHeader';
import AuthorInfo from '@/components/posts/AuthorInfo';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import { useAuth } from '@/hooks/useAuth';
import { usePost, useDeletePost, useTogglePostLike, useBatchLikeManager } from '@/hooks/usePosts';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import LikeButton from '@/components/ui/LikeButton';

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const hasViewed = useRef(false);
  const { updateLike } = useBatchLikeManager();

  const slug = params.slug as string;

  // 상세 fetch는 여기서 한 번만
  const { data: post, isLoading, error, isError } = usePost(slug);
  const deletePostMutation = useDeletePost();
  const likeMutation = useTogglePostLike(slug, () => {
    alert('로그인이 필요합니다.\n로그인 후 좋아요를 누를 수 있습니다.');
    // TODO: toast/모달/로그인 라우팅 등으로 대체 가능
  });

  useEffect(() => {
    if (post) {
      setLiked(post.liked);
      setLikeCount(post.likeCount);
    }
  }, [post]);

  const handleEdit = useCallback(() => {
    if (post) {
      router.push(`/posts/edit/${post.slug || post.id}`);
    }
  }, [post, router]);

  const handleDelete = useCallback(() => {
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!post) return;
    
    deletePostMutation.mutate(post.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        router.push('/');
      },
      onError: () => {
        // 에러 시에도 다이얼로그는 열어둠 (재시도 가능)
      }
    });
  }, [post, deletePostMutation, router]);

  const handleCloseDeleteDialog = useCallback(() => {
    if (!deletePostMutation.isPending) {
      setDeleteDialogOpen(false);
    }
  }, [deletePostMutation.isPending]);

  const handleLike = useCallback(() => {
    if (!post) return;
    // 즉시 UI 반영
    if (liked) {
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
      updateLike(post.id, false);
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      updateLike(post.id, true);
    }
    // 서버 요청은 배치로만 처리 (즉시 요청 제거)
    // likeMutation.mutate(post.id);
  }, [post, liked, updateLike]);

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

  useEffect(() => {
    if (!post || hasViewed.current) return;
    // 5초 이상 머물렀을 때만 viewCount 증가
    const timer = setTimeout(() => {
      queryClient.setQueryData(['posts', 'detail', slug], {
        ...post,
        viewCount: post.viewCount + 1,
      });
      hasViewed.current = true;
      // (별도 API 호출 필요시 이곳에서 처리)
    }, 5000);
    return () => clearTimeout(timer);
  }, [post, queryClient, slug]);

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
          post={{ ...post, liked, likeCount }}
          canEdit={canEdit}
          onBack={handleBack}
          onEdit={handleEdit}
          onDelete={handleDelete}
          LikeButtonComponent={
            <LikeButton
              liked={liked}
              likeCount={likeCount}
              onClick={handleLike}
              tooltip={!user ? '로그인 후 좋아요 가능' : undefined}
            />
          }
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
      <DeleteConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        isLoading={deletePostMutation.isPending}
        itemName={`"${post?.title}" 게시글`}
        title="게시글을 삭제하시겠습니까?"
        description={`"${post?.title}" 게시글이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`}
      />
    </>
  );
} 