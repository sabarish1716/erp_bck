import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
} from '@nestjs/common';
import { UserService } from './user.service';
import { Permissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permission.enum';

@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}

  @Post()
  @Permissions(Permission.USER_CREATE)
  create(@Body() body: any) {
    return this.userService.create(body);
  }

  @Get()
  @Permissions(Permission.USER_READ)
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @Permissions(Permission.USER_READ)
  findOne(@Param('id') id: string) {
    return this.userService.findOne(Number(id));
  }

  @Put(':id')
  @Permissions(Permission.USER_UPDATE)
  update(@Param('id') id: string, @Body() body: any) {
    return this.userService.update(Number(id), body);
  }

  @Delete(':id')
  @Permissions(Permission.USER_DELETE)
  delete(@Param('id') id: string) {
    return this.userService.delete(Number(id));
  }
}
