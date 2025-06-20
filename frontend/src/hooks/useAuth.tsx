"use client";

import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { 
  User, 
  AuthResponse,
  AuthContextType,
  LoginForm, 
  RegisterForm,
  Role
} from '../types/index';
import { apiClient } from '../lib/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback((error: any, defaultMessage: string) => {
    console.error(defaultMessage, error);
    
    let errorMessage = defaultMessage;
    
    if (error.statusCode === 401) {
      errorMessage = '인증에 실패했습니다. 다시 로그인해주세요.';
    } else if (error.statusCode === 409) {
      errorMessage = '이미 사용 중인 정보입니다.';
    } else if (error.statusCode === 400) {
      errorMessage = '입력 정보를 확인해주세요.';
    } else if (error.statusCode === 500) {
      errorMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    } else if (error.statusCode === 429) {
      errorMessage = '너무 많은 시도를 했습니다. 잠시 후 다시 시도해주세요.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    setError(errorMessage);
    throw new Error(errorMessage);
  }, []);

  const checkAuth = useCallback(async () => {
    if (!mounted) return;

    try {
      setIsLoading(true);
      const token = localStorage.getItem('access_token');
      const storedUser = localStorage.getItem('user');
      
      if (token && storedUser) {
        // 먼저 저장된 사용자 정보를 복원
        try {
          const userData = JSON.parse(storedUser);
          setUser(userData);
        } catch (parseError) {
          console.error('Failed to parse stored user data:', parseError);
        }
        
        // 그 다음 서버에서 최신 사용자 정보를 가져옴
        try {
          const userData = await apiClient.getProfile();
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        } catch (apiError) {
          // API 호출 실패해도 저장된 사용자 정보는 유지
          console.error('Failed to refresh user data:', apiError);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // 토큰이 유효하지 않으면 제거
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [mounted]);

  useEffect(() => {
    checkAuth();
  }, [mounted]); // checkAuth 의존성 제거하여 무한 루프 방지

  const login = useCallback(async (credentials: LoginForm) => {
    try {
      clearError();
      setIsLoading(true);
      
      const response = await apiClient.login(credentials);
      setUser(response.user);
      
      // 로컬 스토리지에 사용자 정보 저장 (토큰은 API 클라이언트에서 처리)
      if (mounted) {
        localStorage.setItem('user', JSON.stringify(response.user));
      }
    } catch (error) {
      handleError(error, '로그인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [mounted, clearError, handleError]);

  const register = useCallback(async (userData: RegisterForm) => {
    try {
      clearError();
      setIsLoading(true);
      
      const response = await apiClient.register(userData);
      setUser(response.user);
      
      // 로컬 스토리지에 사용자 정보 저장
      if (mounted) {
        localStorage.setItem('user', JSON.stringify(response.user));
      }
    } catch (error) {
      handleError(error, '회원가입에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [mounted, clearError, handleError]);

  const logout = useCallback(async (redirectTo?: string) => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      if (mounted) {
        localStorage.removeItem('user');
        if (redirectTo) {
          window.location.href = redirectTo;
        }
      }
    }
  }, [mounted]);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await apiClient.getProfile();
      setUser(userData);
      
      if (mounted) {
        localStorage.setItem('user', JSON.stringify(userData));
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      await logout();
    }
  }, [mounted, logout]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === Role.ADMIN,
    login,
    register,
    logout,
    refreshUser,
    error,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 