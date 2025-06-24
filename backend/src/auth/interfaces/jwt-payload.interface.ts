import { Role } from '../../common/enums/role.enum';

export interface JwtPayload {
  sub: string; // user id (UUID)
  email: string;
  role: Role;
  tokenType?: 'access' | 'refresh'; // 토큰 타입 구분
  iat?: number; // issued at
  exp?: number; // expires at
} 