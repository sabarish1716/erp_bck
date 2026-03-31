import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { Permissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permission.enum';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get('next-employee-id')
  @Permissions(Permission.STAFF_READ)
  getNextEmployeeId() {
    return this.staffService.getNextEmployeeId();
  }

  @Post()
  @Permissions(Permission.STAFF_CREATE)
  create(@Body() data: CreateStaffDto) {
    return this.staffService.create(data);
  }

  @Get()
  @Permissions(Permission.STAFF_READ)
  findAll() {
    return this.staffService.findAll();
  }

  @Get(':id')
  @Permissions(Permission.STAFF_READ)
  findOne(@Param('id') id: string) {
    return this.staffService.findOne(id);
  }

  @Put(':id')
  @Permissions(Permission.STAFF_UPDATE)
  update(@Param('id') id: string, @Body() data: CreateStaffDto) {
    return this.staffService.update(id, data);
  }

  @Delete(':id')
  @Permissions(Permission.STAFF_DELETE)
  remove(@Param('id') id: string) {
    return this.staffService.remove(id);
  }

  @Post(':staffId/link-child/:studentId')
  @Permissions(Permission.STAFF_UPDATE)
  linkChild(
    @Param('staffId') staffId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.staffService.linkChildToStaff(staffId, studentId);
  }

  @Delete('unlink-child/:studentId')
  @Permissions(Permission.STAFF_UPDATE)
  unlinkChild(@Param('studentId') studentId: string) {
    return this.staffService.unlinkChildFromStaff(studentId);
  }
}
