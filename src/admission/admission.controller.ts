import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { AdmissionService } from './admission.service';
import { CreateAdmissionDto } from './create-admission.dto';

@Controller('admission')
export class AdmissionController {
  constructor(private readonly service: AdmissionService) {}

 @Post()
create(@Body() body: CreateAdmissionDto) {
  return this.service.createAdmission(body);
}

  @Get()
  findAll() {
    return this.service.getAllStudents();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.getStudentById(id);
  }
}