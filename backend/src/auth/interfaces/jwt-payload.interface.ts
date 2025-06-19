import { Role } from '../../common/enums/role.enum';

export interface JwtPayload {
  sub: number; // user id
  email: string;
  role: Role;
  iat?: number; // issued at
  exp?: number; // expires at
} 