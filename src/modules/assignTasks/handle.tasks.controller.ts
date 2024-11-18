import {
  Controller,
  Post,
  Req,
  Param,
  HttpException,
  HttpStatus,
  UseGuards,
  Get,
  Body,
  Put,
  Delete,
} from '@nestjs/common';
import { TaskService } from './handle.tasks';
import { Types } from 'mongoose';
import {
  ApiBody,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
  ApiOperation,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../jwtstrategy/jwt-auth.guard';
import { CreateAvailableTaskDto } from '../dto.all.ts/availableTasks.dto';
import { UpdateAvailableTaskDto } from '../dto.all.ts/availableTasks.dto';
import { TaskAdminService } from './tasks.management.service';
import { RolesGuard } from '../users/auth/role-admin/roles';
import { UserRole } from '../users/auth/role-admin/user-role.enum';
import { Roles } from '../users/auth/role-admin/role.decorator';

@ApiTags('Daily Tasks')
@Controller('tasks')
export class StandardDailyTaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly taskTableService: TaskAdminService,
  ) {}

  @Post('status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Ấn complete daily tasks',
  })
  @ApiResponse({ status: 201, description: 'Đã completed thành công.' })
  @ApiResponse({
    status: 401,
    description: 'Vui lòng đăng nhập',
  })
  @ApiBearerAuth()
  async getTaskStatus(
    @Req() req,
    @Param('taskId') taskId: Types.ObjectId,
    status: string,
  ) {
    const user_id = new Types.ObjectId(req.user.userId);
    return this.taskService.completeTaskStatus(user_id, taskId, status);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiBody({
    description: 'Nội dung bài viết mới cần cập nhật',
    type: CreateAvailableTaskDto,
  })
  @ApiOperation({
    summary: 'Admin tạo task',
  })
  @ApiResponse({ status: 201, description: 'Đã tạo thành công.' })
  @ApiResponse({
    status: 401,
    description: 'Tạo thất bại',
  })
  @ApiBearerAuth()
  async createTask(@Body() createTaskDto: CreateAvailableTaskDto) {
    try {
      const newTask = await this.taskTableService.createTask(createTaskDto);
      return { message: 'Tạo tasks thành công', data: newTask };
    } catch (error) {
      throw new HttpException(
        error.message || 'Tạo tasks thất bại',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy danh sách cách tasks đã tạo',
  })
  @ApiResponse({ status: 201, description: 'Lấy danh sách thành công.' })
  @ApiResponse({
    status: 401,
    description: 'Lấy danh sách thất bại',
  })
  @ApiBearerAuth()
  async getAllTasks() {
    try {
      return await this.taskTableService.getAllTasks();
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch tasks',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':taskId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiBody({
    description: 'Nội dung bài viết mới cần cập nhật',
    type: UpdateAvailableTaskDto,
  })
  @ApiOperation({
    summary: 'Cập nhật tasks đã tạo',
  })
  @ApiResponse({ status: 201, description: 'Cập nhật thành công.' })
  @ApiResponse({
    status: 401,
    description: 'Cập nhật thất bại',
  })
  @ApiBearerAuth()
  async updateTask(
    @Param('taskId') taskId: string,
    @Body() updateTaskDto: UpdateAvailableTaskDto,
  ) {
    try {
      const objectId = new Types.ObjectId(taskId);
      const updatedTask = await this.taskTableService.updateTask(
        objectId,
        updateTaskDto,
      );
      return { message: 'Task successfully updated', data: updatedTask };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to update task',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete(':taskId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Xóa tasks',
  })
  @ApiResponse({ status: 201, description: 'Xóa thành công.' })
  @ApiResponse({
    status: 401,
    description: 'Xóa thất bại',
  })
  @ApiBearerAuth()
  async deleteTask(@Param('taskId') taskId: string) {
    try {
      const objectId = new Types.ObjectId(taskId);
      const result = await this.taskTableService.deleteTask(objectId);
      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to delete task',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
