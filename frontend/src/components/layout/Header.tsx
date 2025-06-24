'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { FiEdit3, FiLogOut, FiMenu, FiX } from 'react-icons/fi';
import { routes, navigation } from '@/lib/navigation';

export default function Header() {
  const { user, isAdmin, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // 홈 페이지로 이동 (캐시 보존)
  const handleHomeNavigation = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // 모바일 메뉴 닫기
    setIsMobileMenuOpen(false);
    
    // 이미 홈 페이지에 있다면 페이지 새로고침 방지
    if (pathname === '/') {
      // 스크롤을 맨 위로 이동
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    
    // 다른 페이지에서 홈으로 이동
    router.push(routes.home());
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // 외부 클릭으로 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
      // 모바일 메뉴가 열렸을 때 스크롤 방지
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  // 경로 변경 시 메뉴 닫기
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <header className="border-b border-gray-200 sticky top-0 z-50 bg-white" ref={mobileMenuRef}>
      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-5">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <a 
              href={routes.home()}
              onClick={handleHomeNavigation}
              className="text-lg sm:text-xl font-normal text-amber-800 hover:text-amber-900 cursor-pointer"
            >
              Dev Log
            </a>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6 lg:space-x-8">
            <a 
              href={routes.home()}
              onClick={handleHomeNavigation}
              className="text-sm text-gray-900 hover:text-amber-800 cursor-pointer"
            >
              홈
            </a>
            <Link href="/posts" className="text-sm text-gray-900 hover:text-amber-800">
              포스트
            </Link>
            <Link href="/categories" className="text-sm text-gray-900 hover:text-amber-800">
              카테고리
            </Link>
            <Link href="/about" className="text-sm text-gray-900 hover:text-amber-800">
              소개
            </Link>
            {/* <Link href="/analytics" className="text-sm text-gray-900 hover:text-amber-800">
              📊 분석
            </Link> */}
            
            {/* Desktop Auth Section */}
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  {/* Admin Write Button */}
                  {isAdmin && (
                    <Link 
                      href={navigation.toPostNew()}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-amber-700 hover:bg-amber-800 rounded-md transition-colors"
                    >
                      <FiEdit3 className="mr-1 w-4 h-4" />
                      글쓰기
                    </Link>
                  )}
                  
                  {/* User Menu */}
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-600">
                      {user.username}
                    </span>
                    <button
                      onClick={() => logout('/')}
                      className="text-sm text-gray-500 hover:text-gray-700"
                      title="로그아웃"
                    >
                      <FiLogOut className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <Link 
                  href={routes.login()}
                  className="text-sm text-gray-900 hover:text-amber-800"
                >
                  로그인
                </Link>
              )}
            </div>
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMobileMenu}
            className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            aria-label={isMobileMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <FiX className="w-5 h-5" />
            ) : (
              <FiMenu className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-gray-200 animate-in slide-in-from-top-1 duration-200">
            <div className="pt-4 space-y-4">
              {/* Navigation Links */}
              <div className="space-y-3">
                <a 
                  href={routes.home()}
                  onClick={handleHomeNavigation}
                  className="block text-base text-gray-900 hover:text-amber-800 cursor-pointer py-2 px-2 rounded-md hover:bg-gray-50 transition-colors"
                >
                  홈
                </a>
                <Link 
                  href="/posts" 
                  onClick={closeMobileMenu}
                  className="block text-base text-gray-900 hover:text-amber-800 py-2 px-2 rounded-md hover:bg-gray-50 transition-colors"
                >
                  포스트
                </Link>
                <Link 
                  href="/categories" 
                  onClick={closeMobileMenu}
                  className="block text-base text-gray-900 hover:text-amber-800 py-2 px-2 rounded-md hover:bg-gray-50 transition-colors"
                >
                  카테고리
                </Link>
                <Link 
                  href="/about" 
                  onClick={closeMobileMenu}
                  className="block text-base text-gray-900 hover:text-amber-800 py-2 px-2 rounded-md hover:bg-gray-50 transition-colors"
                >
                  소개
                </Link>
                <Link 
                  href="/analytics" 
                  onClick={closeMobileMenu}
                  className="block text-base text-gray-900 hover:text-amber-800 py-2 px-2 rounded-md hover:bg-gray-50 transition-colors"
                >
                  📊 분석
                </Link>
              </div>

              {/* Mobile Auth Section */}
              <div className="pt-4 border-t border-gray-100">
                {user ? (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 px-2 py-2">
                      <span className="text-sm text-gray-600">
                        {user.username}님
                      </span>
                    </div>
                    
                    {/* Admin Write Button */}
                    {isAdmin && (
                      <Link 
                        href={navigation.toPostNew()}
                        onClick={closeMobileMenu}
                        className="inline-flex items-center px-4 py-3 text-sm font-medium text-white bg-amber-700 hover:bg-amber-800 rounded-md transition-colors w-full justify-center"
                      >
                        <FiEdit3 className="mr-2 w-4 h-4" />
                        글쓰기
                      </Link>
                    )}
                    
                    <button
                      onClick={() => {
                        closeMobileMenu();
                        logout('/');
                      }}
                      className="flex items-center space-x-2 text-sm text-gray-500 hover:text-gray-700 py-2 px-2 rounded-md hover:bg-gray-50 transition-colors w-full"
                    >
                      <FiLogOut className="w-4 h-4" />
                      <span>로그아웃</span>
                    </button>
                  </div>
                ) : (
                  <Link 
                    href={routes.login()}
                    onClick={closeMobileMenu}
                    className="block text-base text-gray-900 hover:text-amber-800 py-2 px-2 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    로그인
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
} 