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
  async findOne(@Param('id') id: string) {
    return this.studentService.findOneWithSiblings(id);
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

  // Endpoint to link two students as siblings
  @Post(':id/link-sibling/:siblingId')
  @Permissions(Permission.STUDENT_UPDATE)
  linkSibling(@Param('id') id: string, @Param('siblingId') siblingId: string) {
    return this.studentService.linkSiblings(id, siblingId);
  }

  @Post(':id/link-siblings')
  @Permissions(Permission.STUDENT_UPDATE)
  linkMultipleSiblings(@Param('id') id: string, @Body() body: { siblingIds: string[] }) {
    return this.studentService.linkMultipleSiblings(id, body?.siblingIds || []);
  }
}
