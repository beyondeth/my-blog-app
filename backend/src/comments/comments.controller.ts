import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('comments')
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '댓글 작성' })
  @ApiBearerAuth()
  create(@Body() createCommentDto: any, @Request() req) {
    return this.commentsService.create(createCommentDto, req.user);
  }

  @Get('post/:postId')
  @ApiOperation({ summary: '게시글별 댓글 조회' })
  findAllByPost(@Param('postId') postId: string) {
    return this.commentsService.findAllByPost(+postId);
  }

  @Get('all')
  @ApiOperation({ summary: '모든 댓글 조회 (방명록용)' })
  findAll() {
    return this.commentsService.findAllComments();
  }

  @Get(':id')
  @ApiOperation({ summary: '댓글 상세 조회' })
  findOne(@Param('id') id: string) {
    return this.commentsService.findOne(+id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '댓글 수정' })
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() updateCommentDto: any, @Request() req) {
    return this.commentsService.update(+id, updateCommentDto, req.user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '댓글 삭제' })
  @ApiBearerAuth()
  remove(@Param('id') id: string, @Request() req) {
    return this.commentsService.remove(+id, req.user);
  }
} 