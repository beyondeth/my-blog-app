'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Post } from '../types/index';
import { apiClient } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { FiEye, FiSearch, FiUser, FiCalendar, FiEdit3, FiLogOut } from 'react-icons/fi';
import ImageProxy from '../components/ui/ImageProxy';

function useIsClient() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);
  return isClient;
}

function formatDateToYMD(dateString: string) {
  const date = new Date(dateString);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalPosts, setTotalPosts] = useState(0);
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const isClient = useIsClient();

  const fetchPosts = useCallback(async (page: number = 1, isSearch: boolean = false, searchTerm: string = '') => {
    try {
      if (page === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      
      const response = await apiClient.getPosts({ 
        page, 
        limit: 5,
        search: searchTerm || undefined
      });
      
      // 임시 디버그: 받은 포스트 데이터 확인
      console.log('🖼️ [MAIN PAGE] Received posts:', response.posts);
      response.posts.forEach((post, index) => {
        console.log(`🖼️ [MAIN PAGE] Post ${index + 1} (ID: ${post.id}):`, {
          title: post.title,
          thumbnail: post.thumbnail,
          thumbnailExists: !!post.thumbnail,
        });
      });
      
      if (page === 1) {
        setPosts(response.posts);
      } else {
        setPosts(prev => [...prev, ...response.posts]);
      }
      
      setTotalPosts(response.total);
      if (page === 1) {
        setHasMore(response.posts.length === 5 && response.posts.length < response.total);
      } else {
        setHasMore(response.posts.length === 5 && posts.length + response.posts.length < response.total);
      }
      
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts(1);
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      // 검색어가 없으면 전체 포스트 다시 로드
      setCurrentPage(1);
      fetchPosts(1);
      return;
    }
    
    setCurrentPage(1);
    setHasMore(true);
    fetchPosts(1, true, searchQuery);
  };

  const loadMorePosts = useCallback(() => {
    if (!loadingMore && hasMore) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      fetchPosts(nextPage, false, searchQuery);
    }
  }, [loadingMore, hasMore, currentPage, searchQuery, fetchPosts]);

  // 무한 스크롤을 위한 스크롤 이벤트 감지
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop 
          >= document.documentElement.offsetHeight - 1000 && hasMore && !loadingMore) {
        loadMorePosts();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMorePosts]);

  const recentPosts = posts.slice(0, 3); // 사이드바에는 최대 5개만 표시

  const tags = [
    '#개발', '#블로그', '#프로그래밍', '#웹개발', '#React', '#Next.js',
    '#TypeScript', '#JavaScript', '#Node.js', '#데이터베이스',
    '#알고리즘', '#자료구조', '#프론트엔드', '#백엔드', '#풀스택'
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="text-xl font-normal text-amber-800 hover:text-amber-900">
                Dev Log
              </Link>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <Link href="/" className="text-sm text-gray-900 hover:text-amber-800">
                홈
              </Link>
              <Link href="/posts" className="text-sm text-gray-900 hover:text-amber-800">
                포스트
              </Link>
              <Link href="/categories" className="text-sm text-gray-900 hover:text-amber-800">
                카테고리
              </Link>
              <Link href="/about" className="text-sm text-gray-900 hover:text-amber-800">
                소개
              </Link>
              
              {/* Auth Section - Only render when client is mounted */}
              {isClient && (
                <div className="flex items-center space-x-4">
                  {isAuthenticated ? (
                    <>
                      {/* Admin Write Button */}
                      {isAdmin && (
                        <Link 
                          href="/posts/new"
                          className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-amber-700 hover:bg-amber-800 rounded-md transition-colors"
                        >
                          <FiEdit3 className="mr-1 w-4 h-4" />
                          글쓰기
                        </Link>
                      )}
                      
                      {/* User Menu */}
                      <div className="flex items-center space-x-3">
                        <span className="text-sm text-gray-600">
                          {user?.username}
                        </span>
                        <button
                          onClick={logout}
                          className="inline-flex items-center text-sm text-gray-900 hover:text-amber-800"
                        >
                          <FiLogOut className="mr-1 w-4 h-4" />
                          로그아웃
                        </button>
                      </div>
                    </>
                  ) : (
                    <Link href="/login" className="text-sm text-gray-900 hover:text-amber-800">
                      로그인
                    </Link>
                  )}
                </div>
              )}
              
              {/* Fallback for SSR - show minimal navigation */}
              {!isClient && (
                <div className="flex items-center space-x-4">
                  <Link href="/login" className="text-sm text-gray-900 hover:text-amber-800">
                    로그인
                  </Link>
                </div>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-2 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Content Area */}
          <main className="flex-1 lg:max-w-[calc(100%-380px)]">
            {loading ? (
              <div className="flex justify-center items-center min-h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
              </div>
            ) : posts.length > 0 ? (
              <div className="space-y-6">
                {/* Posts List */}
                {posts.map((post, index) => (
                  <article key={post.id} className="border border-gray-200 rounded-none mb-6 post-card">
                    <div className="p-6">
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-1 post-content">
                          {/* 날짜와 조회수 - 제목 위에 배치 */}
                          <div className="flex items-center text-xs text-gray-500 mb-3">
                            <span>{post.publishedAt || post.createdAt}</span>
                            <span className="mx-2">•</span>
                            <span>조회 {post.viewCount || 0}</span>
                          </div>

                          {/* 제목 */}
                          <h2 className={`${index === 0 ? 'text-xl' : 'text-lg'} font-normal text-gray-900 mb-3 leading-relaxed`}>
                            <Link 
                              href={`/posts/${post.slug || post.id}`}
                              className="hover:text-amber-800"
                            >
                              {post.title}
                            </Link>
                          </h2>

                          {/* 본문 */}
                          <div className="text-sm text-gray-600 mb-4 leading-relaxed">
                            {post.excerpt || 
                             (post.content 
                               ? post.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().substring(0, 120) + (post.content.length > 120 ? '...' : '')
                               : '내용이 없습니다.'
                             )
                            }
                          </div>

                          {/* 더보기 링크 */}
                          <div className="text-left">
                            <Link 
                              href={`/posts/${post.slug || post.id}`}
                              className="text-amber-800 hover:text-amber-900 text-sm"
                            >
                              더보기
                            </Link>
                          </div>
                        </div>

                        {/* 이미지 영역 */}
                        <div className="post-image thumbnail-container">
                          {post.thumbnail ? (
                            <ImageProxy
                              src={post.thumbnail}
                              alt={post.title}
                              className="rounded-sm bg-gray-100"
                              priority={index === 0}
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-100 rounded-sm flex items-center justify-center">
                              <span className="text-xs text-gray-400">이미지 없음</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}

                {/* Loading More Indicator */}
                {loadingMore && (
                  <div className="flex justify-center items-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
                    <span className="ml-2 text-sm text-gray-600">더 많은 포스트를 불러오는 중...</span>
                  </div>
                )}

                {/* Load More Button (Manual) */}
                {!loadingMore && hasMore && (
                  <div className="text-center py-8">
                    <button
                      onClick={loadMorePosts}
                      className="px-6 py-2 text-sm border border-amber-600 text-amber-600 hover:bg-amber-600 hover:text-white transition-colors"
                    >
                      더 많은 포스트 보기
                    </button>
                  </div>
                )}

                {/* End of Posts */}
                {!hasMore && posts.length > 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    모든 포스트를 불러왔습니다. (총 {totalPosts}개)
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>아직 포스트가 없습니다.</p>
              </div>
            )}
          </main>

          {/* Sidebar */}
          <aside className="w-full lg:w-80 lg:min-w-[320px] space-y-6">
            {/* Search */}
            <div className="border border-gray-200 rounded-none p-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">검색</h3>
              <form onSubmit={handleSearch} className="flex">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="검색어를 입력하세요"
                  className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-none focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                />
                <button
                  type="submit"
                  className="ml-2 px-3 py-2 bg-amber-700 text-white rounded-none hover:bg-amber-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <FiSearch className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Recent Posts */}
            <div className="border border-gray-200 rounded-none p-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">최근 포스트</h3>
              <div className="space-y-3">
                {recentPosts.map((post) => (
                  <div key={post.id} className="pb-3 border-b border-gray-100 last:border-b-0">
                    <Link 
                      href={`/posts/${post.slug || post.id}`}
                      className="text-xs text-gray-900 hover:text-amber-800 leading-relaxed"
                    >
                      {post.title}
                    </Link>
                    <div className="flex items-center mt-1 text-xs text-gray-500">
                      <FiCalendar className="w-3 h-3 mr-1" />
                      {formatDateToYMD(post.createdAt)}
                      <FiEye className="w-3 h-3 ml-3 mr-1" />
                      {post.viewCount || 0}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="border border-gray-200 rounded-none p-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">태그</h3>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-700 hover:bg-amber-100 hover:text-amber-800 cursor-pointer"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Profile */}
            <div className="border border-gray-200 rounded-none p-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">프로필</h3>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                  <FiUser className="w-6 h-6 text-gray-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">개발자</div>
                  <div className="text-xs text-gray-500">풀스택 개발자입니다.</div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
