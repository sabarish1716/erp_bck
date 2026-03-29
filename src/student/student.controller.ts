import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { StudentService } from './student.service';
import { CreateStudentDto } from './create-student.dto';
import { Permissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permission.enum';

@Controller('students')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Post()
  @Permissions(Permission.STUDENT_CREATE)
  create(@Body() body: CreateStudentDto) {
    return this.studentService.create(body);
  }

  @Get()
  @Permissions(Permission.STUDENT_READ)
  findAll() {
    return this.studentService.findAll();
  }

  @Get(':id')
  @Permissions(Permission.STUDENT_READ)
  findOne(@Param('id') id: string) {
    return this.studentService.findOne(id);
  }

  @Put(':id')
  @Permissions(Permission.STUDENT_UPDATE)
  update(@Param('id') id: string, @Body() body: Partial<CreateStudentDto>) {
    return this.studentService.update(id, body);
  }

  @Delete(':id')
  @Permissions(Permission.STUDENT_DELETE)
  delete(@Param('id') id: string) {
    return this.studentService.delete(id);
  }
}
