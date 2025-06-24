// [ANALYTICS MODULE DISABLED FOR DEV PERFORMANCE]
/*
import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TrackEventDto } from './dto/track-event.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { TrackBatchDto } from './dto/track-batch.dto';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Public()
  @Post('track')
  @ApiOperation({ summary: '사용자 행동 이벤트 기록 (단일)' })
  @ApiResponse({ status: 201, description: '이벤트 기록 성공' })
  async trackEvent(
    @CurrentUser('id') userId: string | null,
    @Body() trackEventDto: TrackEventDto,
  ) {
    // 비로그인 사용자의 경우 익명 사용자 ID 생성
    const identifier = userId || `anonymous_${trackEventDto.sessionId || Date.now()}`;
    
    return this.analyticsService.trackEvent(identifier, trackEventDto);
  }

  @Public()
  @Post('track-batch')
  @ApiOperation({ summary: '사용자 행동 이벤트 일괄 기록' })
  @ApiResponse({ status: 201, description: '이벤트 일괄 기록 성공' })
  async trackBatch(
    @CurrentUser('id') userId: string | null,
    @Body() trackBatchDto: TrackBatchDto,
  ) {
    const identifier = userId || `anonymous_${trackBatchDto.sessionId || Date.now()}`;
    return this.analyticsService.trackBatch(identifier, trackBatchDto);
  }

  @Get('admin/dashboard')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '관리자용 대시보드 데이터 조회' })
  @ApiQuery({ name: 'period', required: false, enum: ['1d', '7d', '30d', '90d'] })
  @ApiResponse({ status: 200, description: '데이터 조회 성공' })
  async getDashboardData(@Query('period') period: '1d' | '7d' | '30d' | '90d' = '30d') {
    return this.analyticsService.getDashboardData(period);
  }

  @Get('user-stats')
  @ApiOperation({ summary: '현재 사용자의 통계 조회 (향후 사용 가능)' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getUserStats(@CurrentUser('id') userId: string) {
    return this.analyticsService.getUserStats(userId);
  }
}
*/ 