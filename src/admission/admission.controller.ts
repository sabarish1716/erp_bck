import { Controller, Post, Body, Get, Param, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../utils/multer.config';
import { AdmissionService } from './admission.service';
import { CreateAdmissionDto } from './create-admission.dto';

@Controller('admissions')
export class AdmissionController {
  constructor(private readonly service: AdmissionService) {}

  @Post()
  @UseInterceptors(AnyFilesInterceptor(multerConfig))
  create(@Body() body: any, @UploadedFiles() files: Array<Express.Multer.File>) {
    let parsedBody = body;
    // Handle if frontend sends JSON as string in a 'data' field
    if (body.data && typeof body.data === 'string') {
      try {
        parsedBody = JSON.parse(body.data);
      } catch (e) {
        // Fallback to body
      }
    }

    if (!parsedBody.documents) parsedBody.documents = {};
    if (!parsedBody.admission) parsedBody.admission = {};

    if (files && files.length > 0) {
      files.forEach((file) => {
        if (file.fieldname === 'principalSignature') parsedBody.admission.principalSignaturePath = file.path;
        if (file.fieldname === 'staffSignature') parsedBody.admission.staffSignaturePath = file.path;
        if (file.fieldname === 'aadhar') parsedBody.documents.aadharStudentPath = file.path;
        if (file.fieldname === 'tc') parsedBody.documents.transferCertPath = file.path;
        if (file.fieldname === 'birthCert') parsedBody.documents.birthCertPath = file.path;
        if (file.fieldname === 'photo') parsedBody.documents.photoPath = file.path;
      });
    }

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
}