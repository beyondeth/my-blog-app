import { 
  Injectable, 
  UnauthorizedException, 
  ConflictException,
  BadRequestException,
  Logger
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { User, AuthProvider } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { AuthResponse } from './interfaces/auth-response.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.usersService.findByEmail(email);
      
      if (!user || !user.isActive) {
        return null;
      }

      if (user.authProvider !== AuthProvider.LOCAL) {
        throw new BadRequestException('Please use OAuth login for this account');
      }

      const isPasswordValid = await user.validatePassword(password);
      if (!isPasswordValid) {
        return null;
      }

      // 마지막 로그인 시간 업데이트
      await this.usersService.updateLastLogin(user.id);
      
      return user;
    } catch (error) {
      this.logger.error(`Validation failed for email ${email}:`, error.message);
      return null;
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;
    
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokenResponse(user);
  }

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, username, password } = registerDto;

    // 이메일 중복 체크
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // 사용자명 중복 체크
    const existingUsername = await this.usersService.findByUsername(username);
    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    try {
      const user = await this.usersService.create({
        email,
        username,
        password,
        authProvider: AuthProvider.LOCAL,
      });

      this.logger.log(`New user registered: ${email}`);
      return this.generateTokenResponse(user);
    } catch (error) {
      this.logger.error(`Registration failed for ${email}:`, error.message);
      throw new BadRequestException('Registration failed');
    }
  }

  async validateOAuthUser(profile: any, provider: AuthProvider): Promise<AuthResponse> {
    try {
      let user = await this.usersService.findByProviderId(profile.id, provider);

      if (!user) {
        // 이메일로 기존 사용자 확인
        const email = profile.emails?.[0]?.value;
        if (email) {
          const existingUser = await this.usersService.findByEmail(email);
          if (existingUser && existingUser.authProvider !== provider) {
            throw new ConflictException('Account exists with different provider');
          }
        }

        // 새 사용자 생성
        const userData = {
          email: email || `${profile.id}@${provider}.com`,
          username: this.generateUniqueUsername(profile),
          profileImage: profile.photos?.[0]?.value,
          authProvider: provider,
          providerId: profile.id,
          isEmailVerified: true,
        };

        user = await this.usersService.create(userData);
        this.logger.log(`New OAuth user created: ${user.email} via ${provider}`);
      } else {
        // 마지막 로그인 시간 업데이트
        await this.usersService.updateLastLogin(user.id);
      }

      return this.generateTokenResponse(user);
    } catch (error) {
      this.logger.error(`OAuth validation failed for ${provider}:`, error.message);
      throw error;
    }
  }

  async refreshToken(user: User): Promise<AuthResponse> {
    return this.generateTokenResponse(user);
  }

  async logout(userId: number): Promise<void> {
    // JWT는 stateless이므로 클라이언트에서 토큰 삭제
    // 필요시 블랙리스트 구현 가능
    this.logger.log(`User ${userId} logged out`);
  }

  private generateTokenResponse(user: User): AuthResponse {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.getTokenExpiresIn(),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        profileImage: user.profileImage,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }

  private generateUniqueUsername(profile: any): string {
    const baseUsername = profile.displayName || 
                        profile.username || 
                        profile.name?.givenName || 
                        'user';
    
    return `${baseUsername}_${Date.now()}`;
  }

  private getTokenExpiresIn(): number {
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '1d');
    // 간단한 파싱 (1d = 86400초)
    if (expiresIn.includes('d')) {
      return parseInt(expiresIn) * 24 * 60 * 60;
    }
    if (expiresIn.includes('h')) {
      return parseInt(expiresIn) * 60 * 60;
    }
    return parseInt(expiresIn) || 86400;
  }
} 