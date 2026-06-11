import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseInterceptors,
  UploadedFiles,
  Put,
  Delete,
  Patch,
  Req,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  AnyFilesInterceptor,
  FileFieldsInterceptor,
} from '@nestjs/platform-express';
import { multerConfig } from '../utils/multer.config';
import { AdmissionService } from './admission.service';
import { CreateAdmissionDto } from './create-admission.dto';
import { memoryStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { Permissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permission.enum';
import { SetAdmissionApprovalDto } from './set-admission-approval.dto';
import { PromoteStudentsDto } from './promote-students.dto';
import { LinkSiblingsDto } from './link-siblings.dto';
import { UpdateStandardSeatsDto } from './standard-seats.dto';
import { DemoteIndividualDto } from './demote-individual.dto';
import { CreateAcademicStreamDto } from './create-academic-stream.dto';
import { AcademicStreamService } from './academic-stream.service';

const BASE_DOCS_PATH = process.env.STUDENT_DOCS_PATH || 'D:/Student_Documents';

/**
 * Returns (and creates if needed) the structured student folder:
 *   BASE_DOCS_PATH / academicYear / admNo_Standard /
 * All segments are sanitised to avoid path traversal.
 * Uses mkdirSync which is a no-op when the folder already exists.
 */
function resolveStudentFolder(
  academicYear?: string,
  admNo?: string,
  standard?: string,
): string {
  const safe = (s: string) => String(s || '').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const yearPart = safe(academicYear || 'UNKNOWN_YEAR');
  const studentPart = admNo ? `${safe(admNo)}_${safe(standard || '')}` : safe(standard || 'UNKNOWN_STD');
  const folderPath = join(BASE_DOCS_PATH, yearPart, studentPart);
  mkdirSync(folderPath, { recursive: true }); // idempotent – no duplicate creation
  return folderPath;
}

/**
 * Writes a multer memory-storage file to the student folder.
 * Returns the relative path stored in the DB.
 */
function saveFileToDisk(
  file: Express.Multer.File,
  folderPath: string,
): string {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const ext = extname(file.originalname);
  const filename = `${file.fieldname}-${uniqueSuffix}${ext}`;
  writeFileSync(join(folderPath, filename), file.buffer);
  // Store a relative path for portability
  return join(folderPath, filename).replace(/\\/g, '/');
}

@Controller('admissions')
export class AdmissionController {
  constructor(
    private readonly service: AdmissionService,
    private readonly academicStreamService: AcademicStreamService,
  ) {}

  @Get('streams')
  @Permissions(Permission.ADMISSION_READ)
  async findAllStreams() {
    return this.academicStreamService.findAll();
  }

  @Post('streams')
  @Permissions(Permission.ADMISSION_CREATE)
  async createStream(@Body() data: CreateAcademicStreamDto) {
    return this.academicStreamService.create(data);
  }

  @Get('next-admission-no')
  @Permissions(Permission.ADMISSION_CREATE)
  async getNextAdmissionNo() {
    const admissionNo = await this.service.generateAdmissionNo();
    return { admissionNo };
  }

  @Post('bulk-approval')
  @Permissions(Permission.ADMISSION_APPROVE)
  async bulkApproval(
    @Body() body: { studentIds: string[]; approved: boolean; reason?: string },
    @Req() req: any,
  ) {
    return this.service.bulkApproval(
      body.studentIds,
      body.approved,
      req?.user,
      body.reason,
    );
  }

  @Post('bulk-upload')
  @Permissions(Permission.ADMISSION_CREATE)
  async bulkUpload(@Body() body: { rows: any[] }) {
    if (!body.rows || !Array.isArray(body.rows) || body.rows.length === 0) {
      throw new BadRequestException('No rows provided');
    }
    if (body.rows.length > 500) {
      throw new BadRequestException('Maximum 500 rows allowed per upload');
    }
    return this.service.bulkCreateFromCsv(body.rows);
  }

  @Get('bulk-upload/template')
  @Permissions(Permission.ADMISSION_CREATE)
  downloadBulkUploadTemplate() {
    const csv = this.service.getBulkUploadTemplateCsv();
    return {
      filename: 'admission-bulk-upload-template.csv',
      contentType: 'text/csv',
      csv,
    };
  }

  @Post()
  @Permissions(Permission.ADMISSION_CREATE)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profilePhoto', maxCount: 1 },
        { name: 'birthCert', maxCount: 1 },
        { name: 'communityCert', maxCount: 1 },
        { name: 'aadharStudent', maxCount: 1 },
        { name: 'transferCert', maxCount: 1 },
        { name: 'entranceExam', maxCount: 1 },
      ],
      { storage: memoryStorage() },
    ),
  )
  async create(
    @Body() body: any,
    @UploadedFiles()
    files: {
      profilePhoto?: Express.Multer.File[];
      birthCert?: Express.Multer.File[];
      communityCert?: Express.Multer.File[];
      aadharStudent?: Express.Multer.File[];
      transferCert?: Express.Multer.File[];
      entranceExam?: Express.Multer.File[];
    },
    @Req() req: any,
  ) {
    let parsedBody = body;

    // Parse JSON wrapped in a 'data' field (multipart/form-data)
    if (body.data && typeof body.data === 'string') {
      try {
        parsedBody = JSON.parse(body.data);
      } catch (e) {
        console.error('JSON parse error:', e);
      }
    }

    // Convert documents array → object
    if (Array.isArray(parsedBody.documents)) {
      const docObj: Record<string, any> = {};
      parsedBody.documents.forEach((doc: any) => { docObj[doc.key] = doc; });
      parsedBody.documents = docObj;
    }
    if (!parsedBody.documents) parsedBody.documents = {};

    // Determine student folder AFTER body is parsed so we have admissionNo / standard / academicYear
    // (admissionNo may be AUTO at this point – fall back to a timestamp placeholder)
    const admNo = parsedBody.admission?.admissionNo || parsedBody.admissionNo || `NEW_${Date.now()}`;
    const standard = parsedBody.standard || parsedBody.admission?.standard || 'UNKNOWN';
    const academicYear = parsedBody.academicYear || parsedBody.admission?.academicYear || 'UNKNOWN_YEAR';

    if (files) {
      const folderPath = resolveStudentFolder(academicYear, admNo, standard);
      Object.keys(files).forEach((fieldname) => {
        const fileArr = (files as any)[fieldname] as Express.Multer.File[] | undefined;
        if (!fileArr?.[0]) return;
        const savedPath = saveFileToDisk(fileArr[0], folderPath);
        if (!parsedBody.documents[fieldname]) parsedBody.documents[fieldname] = {};
        parsedBody.documents[fieldname].path = savedPath;
        parsedBody.documents[fieldname].uploaded = true;
      });
    }

    return this.service.createAdmission(parsedBody, req.user, files);
  }

  @Get()
  @Permissions(Permission.ADMISSION_READ)
  findAll() {
    return this.service.getAllStudents();
  }

  @Get('pending')
  @Permissions(Permission.ADMISSION_READ)
  findPending() {
    return this.service.getPendingAdmissions();
  }

  @Get('dashboard/summary')
  @Permissions(Permission.ADMISSION_READ)
  getDashboard(@Query('academicYear') academicYear?: string) {
    return this.service.getAdmissionDashboard(academicYear);
  }

  @Get('export/csv')
  @Permissions(Permission.ADMISSION_READ)
  async exportCsv(@Query('academicYear') academicYear?: string) {
    const csv = await this.service.exportAdmissionsCsv(academicYear);
    return {
      filename: `admissions-${academicYear || 'all'}.csv`,
      contentType: 'text/csv',
      csv,
    };
  }

  @Get('seats')
  @Permissions(Permission.ADMISSION_READ)
  getSeatConfig() {
    return this.service.getStandardSeatConfig();
  }

  @Put('seats')
  @Permissions(Permission.ADMISSION_UPDATE)
  updateSeatConfig(@Body() body: UpdateStandardSeatsDto, @Req() req: any) {
    return this.service.updateStandardSeatConfig(body.seats, req?.user?.email);
  }

  @Post('promote')
  promoteStudents(@Body() body: PromoteStudentsDto) {
    return this.service.promoteAllStudents(
      body.academicYear,
      body.newAcademicYear,
    );
  }

  @Post('demote')
  demoteStudents(@Body() body: PromoteStudentsDto) {
    return this.service.demoteAllStudents(
      body.academicYear,
      body.newAcademicYear,
    );
  }

  @Post('demote-individual')
  @Permissions(Permission.ADMISSION_UPDATE)
  demoteIndividualStudents(@Body() body: DemoteIndividualDto) {
    return this.service.demoteIndividualStudents(body.studentIds, body.reason);
  }

  @Post('siblings/link')
  @Permissions(Permission.ADMISSION_UPDATE)
  linkSiblings(@Body() body: LinkSiblingsDto) {
    return this.service.linkSiblings(body.studentIds, body.siblingGroupId);
  }

  @Post('siblings/unlink')
  @Permissions(Permission.ADMISSION_UPDATE)
  unlinkSibling(@Body() body: { studentId: string }) {
    return this.service.unlinkSibling(body.studentId);
  }

  @Get(':id')
  @Permissions(Permission.ADMISSION_READ)
  findOne(@Param('id') id: string) {
    return this.service.getStudentById(id);
  }

  @Patch(':id/approval')
  @Permissions(Permission.ADMISSION_APPROVE)
  setApproval(
    @Param('id') id: string,
    @Body() body: SetAdmissionApprovalDto,
    @Req() req: any,
  ) {
    return this.service.setAdmissionApproval(
      id,
      body.approved,
      req?.user,
      body.reason,
    );
  }

  //   @Put(':id')
  //   @UseInterceptors(AnyFilesInterceptor(multerConfig))
  //   async update(@Param('id') id: string, @Body() body: any, @UploadedFiles() files: Array<Express.Multer.File>) {
  //     let parsedBody = body;
  //     if (body.data && typeof body.data === 'string') {
  //       try {
  //         parsedBody = JSON.parse(body.data);
  //       } catch (e) {
  //         console.error('JSON parse error:', e);
  //       }
  //     }

  //     // check  the exisitiong documents and the new uploaded documents and merge them properly
  // // ✅ STEP 0: Fetch existing student data to get current documents
  // const existingStudent = await this.service.getStudentById(id);
  // const existingDocuments = existingStudent?.documents || {};
  //     if (!parsedBody.documents) parsedBody.documents = {};

  //     if (files && files.length > 0) {
  //       files.forEach((file) => {
  //         if (!parsedBody.documents[file.fieldname]) parsedBody.documents[file.fieldname] = {};
  //         parsedBody.documents[file.fieldname].path = file.path.replace(/\\/g, '/');
  //         parsedBody.documents[file.fieldname].uploaded = true;
  //       });
  //     }

  //     return this.service.updateStudent(id, parsedBody);
  //   }
  @Put(':id')
  @Permissions(Permission.ADMISSION_UPDATE)
  @UseInterceptors(AnyFilesInterceptor({ storage: memoryStorage() }))
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    let parsedBody = body;

    // Parse JSON safely
    if (body.data && typeof body.data === 'string') {
      try {
        parsedBody = JSON.parse(body.data);
      } catch (e) {
        console.error('JSON parse error:', e);
      }
    }

    // Normalize documents when frontend sends an array of keyed items
    if (Array.isArray(parsedBody.documents)) {
      const normalizedDocs: Record<string, any> = {};
      parsedBody.documents.forEach((doc: any) => {
        if (!doc || typeof doc !== 'object' || !doc.key) return;
        normalizedDocs[doc.key] = { ...(normalizedDocs[doc.key] || {}), ...doc };
      });
      parsedBody.documents = normalizedDocs;
    }

    // Fetch existing student to access academicYear, admissionNo, standard
    const existingStudent = await this.service.getStudentById(id);
    const existingDocuments = existingStudent?.documents?.[0] || {};
    const existingAdmission = existingStudent?.admission?.[0] || existingStudent?.admission || {};

    const academicYear =
      parsedBody.academicYear ||
      existingAdmission.admissionYear ||
      existingStudent?.academicYear ||
      'UNKNOWN_YEAR';
    const admNo =
      existingAdmission.admissionNo ||
      existingStudent?.admission?.admissionNo ||
      id;
    const standard =
      parsedBody.standard ||
      existingAdmission.standard ||
      existingStudent?.standard ||
      'UNKNOWN';

    if (!parsedBody.documents) parsedBody.documents = {};

    // Write memory-storage files to the correct student folder (reuses existing folder)
    const uploadedMap: Record<string, string> = {};
    if (files?.length) {
      const folderPath = resolveStudentFolder(academicYear, admNo, standard);
      files.forEach((file) => {
        const savedPath = saveFileToDisk(file, folderPath);
        uploadedMap[file.fieldname] = savedPath;
      });
    }

    // Map profilePhoto → photo (canonical backend key)
    if (uploadedMap.profilePhoto) {
      uploadedMap.photo = uploadedMap.profilePhoto;
    }

    // Merge uploaded files + existing document paths
    const docKeys = [
      'photo',
      'birthCert',
      'communityCert',
      'aadharFather',
      'aadharMother',
      'aadharStudent',
      'transferCert',
      'entranceExam',
    ];

    docKeys.forEach((key) => {
      if (!parsedBody.documents[key]) parsedBody.documents[key] = {};

      if (uploadedMap[key]) {
        // New upload → use new path
        parsedBody.documents[key].path = uploadedMap[key];
        parsedBody.documents[key].uploaded = true;
      } else {
        // No upload → keep existing DB value
        const existingPath = existingDocuments[`${key}Path`] || '';
        parsedBody.documents[key].path = parsedBody.documents[key].path || existingPath;
        parsedBody.documents[key].uploaded = parsedBody.documents[key].uploaded ?? !!existingDocuments[key];
      }

      // Unchecked → clear path
      if (parsedBody.documents[key].uploaded === false) {
        parsedBody.documents[key].path = '';
      }

      // Preserve hardCopy flag
      if (parsedBody.documents[key].hardCopy === undefined) {
        parsedBody.documents[key].hardCopy = existingDocuments[`${key}HardCopy`] ?? false;
      }
    });

    // Remove transient frontend key once mapped to canonical backend key
    delete parsedBody.documents.profilePhoto;

    console.log('FINAL DOCUMENTS:', parsedBody.documents);

    return this.service.updateStudent(id, parsedBody);
  }

  @Patch(':id')
  @Permissions(Permission.ADMISSION_UPDATE)
  async patch(
    @Param('id') id: string,
    @Body() body: Partial<CreateAdmissionDto>,
  ) {
    return this.service.patchStudent(id, body);
  }

  @Post(':id/unarchive')
  unarchive(@Param('id') id: string) {
    return this.service.unarchiveStudent(id);
  }

  @Delete(':id')
  @Permissions(Permission.ADMISSION_DELETE)
  delete(@Param('id') id: string) {
    return this.service.deleteStudent(id);
  }
}
