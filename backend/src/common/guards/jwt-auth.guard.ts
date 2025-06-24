import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // isPublic 체크는 handleRequest에서 수행하므로 여기서는 항상 인증 시도
    return super.canActivate(context);
  }

  handleRequest(err, user, info, context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 인증된 사용자가 있으면 user 객체를 반환
    if (user) {
      return user;
    }

    // Public 경로인 경우, 인증되지 않았어도 에러를 던지지 않음
    if (isPublic) {
      return null;
    }

    // 보호된 경로인데 사용자가 없는 경우 에러 발생
    throw err || new UnauthorizedException();
  }
} 