'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { postsAPI } from '@/lib/api';
import { Post } from '@/types';
import { FiCalendar, FiUser, FiEye, FiHeart, FiArrowLeft, FiShare2, FiTag, FiEdit3, FiTrash2 } from 'react-icons/fi';
import ContentRenderer from '@/components/ui/ContentRenderer';
import { useAuth } from '@/hooks/useAuth';

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liked, setLiked] = useState(false);

  const slug = params.slug as string;

  useEffect(() => {
    const fetchPost = async () => {
      try {
        setLoading(true);
        const response = await postsAPI.getPostBySlug(slug);
        setPost(response);
      } catch (error: any) {
        setError(error.message || '게시글을 불러올 수 없습니다.');
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchPost();
    }
  }, [slug]);

  const handleEdit = () => {
    if (post) {
      router.push(`/posts/edit/${post.id}`);
    }
  };

  const handleDelete = async () => {
    if (!post) return;
    
    if (confirm('정말로 이 게시글을 삭제하시겠습니까?')) {
      try {
        await postsAPI.deletePost(post.id);
        alert('게시글이 삭제되었습니다.');
        router.push('/');
      } catch (error) {
        console.error('삭제 실패:', error);
        alert('게시글 삭제에 실패했습니다.');
      }
    }
  };

  const handleLike = async () => {
    if (!post) return;
    
    try {
      const response = await postsAPI.toggleLike(post.id);
      setLiked(response.liked);
      setPost(prev => prev ? {
        ...prev,
        likeCount: response.liked ? prev.likeCount + 1 : prev.likeCount - 1
      } : null);
    } catch (error) {
      console.error('좋아요 처리 실패:', error);
    }
  };

  const handleShare = async () => {
    if (navigator.share && post) {
      try {
        await navigator.share({
          title: post.title,
          text: post.excerpt || '흥미로운 글을 공유합니다!',
          url: window.location.href,
        });
      } catch (error) {
        console.log('공유 취소됨');
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('링크가 클립보드에 복사되었습니다!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-6xl font-light text-gray-900 mb-4">404</h1>
          <p className="text-gray-600 mb-8">
            {error || 'Post not found'}
          </p>
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center px-6 py-3 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors"
          >
            <FiArrowLeft className="mr-2" />
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Header */}
      <nav className="border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
            >
              <FiArrowLeft className="mr-2 w-4 h-4" />
              Back
            </button>
            
            {/* Admin Actions */}
            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleEdit}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                >
                  <FiEdit3 className="mr-1 w-4 h-4" />
                  수정
                </button>
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                >
                  <FiTrash2 className="mr-1 w-4 h-4" />
                  삭제
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Article Content */}
      <article className="max-w-3xl mx-auto px-6 py-16">
        {/* Article Header */}
        <header className="mb-16">
          {/* Category */}
          {post.category && (
            <div className="mb-6">
              <span className="inline-flex items-center px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                <FiTag className="mr-1 w-3 h-3" />
                {post.category}
              </span>
            </div>
          )}
          
          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-light text-gray-900 mb-8 leading-tight tracking-tight">
            {post.title}
          </h1>

          {/* Meta Information */}
          <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500 mb-8">
            <div className="flex items-center">
              <FiUser className="mr-2 w-4 h-4" />
              <span className="font-medium">{post.author?.username || 'Author'}</span>
            </div>
            <div className="flex items-center">
              <FiCalendar className="mr-2 w-4 h-4" />
              <span>{new Date(post.publishedAt || post.createdAt).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</span>
            </div>
            <div className="flex items-center">
              <FiEye className="mr-2 w-4 h-4" />
              <span>{post.viewCount.toLocaleString()} views</span>
            </div>
          </div>

          {/* Excerpt */}
          {post.excerpt && (
            <p className="text-lg text-gray-600 leading-relaxed mb-8 font-light">
              {post.excerpt}
            </p>
          )}

          {/* Divider */}
          <div className="w-20 h-px bg-gray-200 mb-12"></div>
        </header>

        {/* Article Body */}
        <ContentRenderer 
          content={post.content}
          className="blog-content text-gray-800 leading-relaxed"
        />

        {/* Article Footer */}
        <footer className="mt-16 pt-12 border-t border-gray-100">
          {/* Action Buttons */}
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
              <button
                onClick={handleLike}
                className={`inline-flex items-center px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                  liked
                    ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                <FiHeart className={`mr-2 w-4 h-4 ${liked ? 'fill-current' : ''}`} />
                {post.likeCount}
              </button>
              
              <button
                onClick={handleShare}
                className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-all text-sm font-medium"
              >
                <FiShare2 className="mr-2 w-4 h-4" />
                Share
              </button>
            </div>
          </div>

          {/* Author Info */}
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mr-4">
                <FiUser className="w-6 h-6 text-gray-500" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-1">
                  {post.author?.username || 'Author'}
                </h3>
                <p className="text-sm text-gray-600">
                  Developer & Writer
                </p>
              </div>
            </div>
          </div>
        </footer>
      </article>
    </div>
  );
} 