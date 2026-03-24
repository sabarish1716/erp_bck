import { Controller, Post, Body, Get, Param, UseInterceptors, UploadedFiles, Put } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../utils/multer.config';
import { AdmissionService } from './admission.service';
import { CreateAdmissionDto } from './create-admission.dto';

@Controller('admissions')
export class AdmissionController {
  constructor(private readonly service: AdmissionService) {}

  @Post()
  @UseInterceptors(AnyFilesInterceptor(multerConfig))
  async create(@Body() body: any, @UploadedFiles() files: Array<Express.Multer.File>) {
    let parsedBody = body;
    if (body.data && typeof body.data === 'string') {
      try {
        parsedBody = JSON.parse(body.data);
      } catch (e) {}
    }

    if (!parsedBody.documents) parsedBody.documents = {};

    if (files && files.length > 0) {
      files.forEach((file) => {
        if (!parsedBody.documents[file.fieldname]) parsedBody.documents[file.fieldname] = {};
        parsedBody.documents[file.fieldname].path = file.path.replace(/\\/g, '/');
        parsedBody.documents[file.fieldname].uploaded = true;
      });
    }

    // Save as JSON
    return this.service.createAdmission(parsedBody);
  }

  @Get()
  findAll() {
    return this.service.getAllStudents();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.getStudentById(id);
  }

  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor(multerConfig))
  update(@Param('id') id: string, @Body() body: any, @UploadedFiles() files: Array<Express.Multer.File>) {
    let parsedBody = body;
    if (body.data && typeof body.data === 'string') {
      try {
        parsedBody = JSON.parse(body.data);
      } catch (e) {}
    }

    if (!parsedBody.documents) parsedBody.documents = {};

    if (files && files.length > 0) {
      files.forEach((file) => {
        if (!parsedBody.documents[file.fieldname]) parsedBody.documents[file.fieldname] = {};
        parsedBody.documents[file.fieldname].path = file.path.replace(/\\/g, '/');
        parsedBody.documents[file.fieldname].uploaded = true;
      });
    }

    return this.service.updateStudent(id, parsedBody);
  }
}