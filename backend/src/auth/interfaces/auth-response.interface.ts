import { Role } from '../../common/enums/role.enum';

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: number;
    email: string;
    username: string;
    role: Role;
    profileImage?: string;
    isEmailVerified: boolean;
  };
} 