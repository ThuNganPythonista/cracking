import {
  Controller,
  Post,
  UseGuards,
  Request,
  Body,
  Param,
  Get,
  BadRequestException,
} from '@nestjs/common';
import { PostService } from './posts.service';
import { JwtAuthGuard } from '../users/auth/jwt-auth.guard';
import { CreatePostDto } from '../dto.all.ts/create-post.dto';
import { ApiBody, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { RolesGuard } from '../users/auth/role-admin/roles';
import { UserRole } from '../users/auth/role-admin/user-role.enum';
import { Roles } from '../users/auth/role-admin/role.decorator';

@ApiTags('Posts')
@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post('create-post')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiBody({ type: CreatePostDto })
  @ApiResponse({ status: 201, description: 'Bài viết đã được tạo thành công.' })
  @ApiResponse({ status: 401, description: 'Không có quyền truy cập.' })
  async createPost(@Request() req, @Body() createPostDto: CreatePostDto) {
    const user_Id = req.user.userId;

    if (!user_Id) {
      throw new BadRequestException('userId không hợp lệ');
    }

    return this.postService.createPost(user_Id, createPostDto);
  }
  @Post(':id/click-like')
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 201, description: 'Đã like thành công.' })
  @ApiResponse({
    status: 401,
    description: 'Đăng nhập để có quyền tương tác bài viết',
  })
  @ApiBearerAuth()
  async likePost(@Request() req, @Param('id') postId: string) {
    const post_Id = new Types.ObjectId(postId);

    const user_Id = req.user.userId;

    return this.postService.handleLikePost(user_Id, post_Id);
  }

  @Get(':id/total-likes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiResponse({
    status: 201,
    description: 'Lấy tổng số likes của một bài Post thành công',
  })
  @ApiResponse({
    status: 401,
    description: 'Bạn phải dùng tài khoản Admin mới truy vấn được',
  })
  async getLikesCount(
    @Param('id') postId: string,
  ): Promise<{ message: string }> {
    const post_Id = new Types.ObjectId(postId);

    const likes = await this.postService.getLikesCount(post_Id);
    return { message: `Bài viết này có tổng cộng ${likes} likes.` };
  }
}
