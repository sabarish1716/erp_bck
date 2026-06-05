import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { Permissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permission.enum';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { StaffDocumentType } from '@prisma/client';
import { CreateStaffDocumentDto } from './dto/staff-document.dto';

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
  findAll(@Query('status') status?: string) {
    return this.staffService.findAll(status);
  }

  @Get('transport-managers')
  @Permissions(Permission.STAFF_READ)
  findTransportManagers() {
    return this.staffService.findTransportManagers();
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

  @Post(':id/documents')
  @Permissions(Permission.STAFF_UPDATE)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/documents/staff',
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `staff-doc-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|pdf)$/)) {
          return cb(new BadRequestException('Only JPG, PNG, or PDF files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  addDocument(
    @Param('id') id: string,
    @Body() data: CreateStaffDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.staffService.addDocument(id, data, file);
  }

  @Get(':id/documents')
  @Permissions(Permission.STAFF_READ)
  listDocuments(
    @Param('id') id: string,
    @Query('type') type?: StaffDocumentType,
  ) {
    return this.staffService.listDocuments(id, type);
  }

  @Delete(':id/documents/:documentId')
  @Permissions(Permission.STAFF_UPDATE)
  removeDocument(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ) {
    return this.staffService.removeDocument(id, documentId);
  }

  // --- Department & Designation Masters ---
  @Get('masters/departments')
  @Permissions(Permission.STAFF_READ)
  getDepartments() {
    return this.staffService.getDepartments();
  }

  @Post('masters/departments')
  @Permissions(Permission.STAFF_UPDATE)
  createDepartment(@Body() data: { name: string }) {
    return this.staffService.createDepartment(data.name);
  }

  @Delete('masters/departments/:id')
  @Permissions(Permission.STAFF_UPDATE)
  deleteDepartment(@Param('id') id: string) {
    return this.staffService.deleteDepartment(id);
  }

  @Get('masters/designations')
  @Permissions(Permission.STAFF_READ)
  getDesignations() {
    return this.staffService.getDesignations();
  }

  @Post('masters/designations')
  @Permissions(Permission.STAFF_UPDATE)
  createDesignation(@Body() data: { name: string }) {
    return this.staffService.createDesignation(data.name);
  }

  @Delete('masters/designations/:id')
  @Permissions(Permission.STAFF_UPDATE)
  deleteDesignation(@Param('id') id: string) {
    return this.staffService.deleteDesignation(id);
  }
}
