import { Controller, Post, Body, Get, Param, UseInterceptors, UploadedFiles, Put, Delete } from '@nestjs/common';
import { AnyFilesInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../utils/multer.config';
import { AdmissionService } from './admission.service';
import { CreateAdmissionDto } from './create-admission.dto';
import { diskStorage } from 'multer';
import { extname } from 'path/win32';


@Controller('admissions')
export class AdmissionController {
  constructor(private readonly service: AdmissionService) {}





  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profilePhoto', maxCount: 1 },
        { name: 'birthCert', maxCount: 1 },
        { name: 'communityCert', maxCount: 1 },
          { name: 'aadharStudent', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: './uploads',
          filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const ext = extname(file.originalname);
            cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
          },
        }),
      },
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
    },
  ) {
    let parsedBody = body;

    // ✅ Parse JSON string from form-data
    if (body.data && typeof body.data === 'string') {
      try {
        parsedBody = JSON.parse(body.data);
      } catch (e) {
        console.error('JSON parse error:', e);
      }
    }

    // ✅ Convert documents array → object
    if (Array.isArray(parsedBody.documents)) {
      const docObj = {};
      parsedBody.documents.forEach((doc) => {
        docObj[doc.key] = doc;
      });
      parsedBody.documents = docObj;
    }

    // ✅ Ensure documents exists
    if (!parsedBody.documents) {
      parsedBody.documents = {};
    }

    // ✅ Attach uploaded file paths
    if (files) {
      Object.keys(files).forEach((key) => {
        const file = files[key][0];

        if (!parsedBody.documents[key]) {
          parsedBody.documents[key] = {};
        }

        parsedBody.documents[key].path = file.path.replace(/\\/g, '/');
        parsedBody.documents[key].uploaded = true;
      });
    }

    // ✅ Final save
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
@UseInterceptors(AnyFilesInterceptor(multerConfig))
async update(
  @Param('id') id: string,
  @Body() body: any,
  @UploadedFiles() files: Array<Express.Multer.File>
) {
  let parsedBody = body;

  // ✅ Parse JSON safely
  if (body.data && typeof body.data === 'string') {
    try {
      parsedBody = JSON.parse(body.data);
    } catch (e) {
      console.error('JSON parse error:', e);
    }
  }

  // ✅ STEP 0: Fetch existing student
  const existingStudent = await this.service.getStudentById(id);

  // ⚠️ documents is array → take first element
  const existingDocuments = existingStudent?.documents?.[0] || {};

  // ✅ Ensure documents object exists
  if (!parsedBody.documents) parsedBody.documents = {};

  // ✅ Normalize path helper
  const normalizePath = (p: string) => p.replace(/\\/g, '/');

  // ✅ STEP 1: Convert uploaded files → map
  const uploadedMap: Record<string, string> = {};

  if (files?.length) {
    files.forEach((file) => {
      uploadedMap[file.fieldname] = normalizePath(file.path);
    });
  }

  // ✅ STEP 2: Merge logic (VERY IMPORTANT)
  const docKeys = [
    'profilePhoto',
    'photo',
    'birthCert',
    'communityCert',
    'aadharFather',
    'aadharMother',
    'aadharStudent',
    'transferCert',
  ];

  // profilephoto is from frontend but our seid we use photo

  docKeys.forEach((key) => {
    if(key === 'profilePhoto' && uploadedMap['profilePhoto']) {
       parsedBody.documents['photo'] = {
        path: uploadedMap[key],
        uploaded: true
      };
    }

    if (!parsedBody.documents[key]) {
      parsedBody.documents[key] = {};
    }

    // 🔥 CASE 1: New upload → replace
    if (uploadedMap[key]) {
      parsedBody.documents[key].path = uploadedMap[key];
      parsedBody.documents[key].uploaded = true;
    } 
    // 🔥 CASE 2: No upload → keep existing DB value
    else {
      const existingPath = existingDocuments[`${key}Path`] || '';

      parsedBody.documents[key].path =
        parsedBody.documents[key].path || existingPath;

      parsedBody.documents[key].uploaded =
        parsedBody.documents[key].uploaded ??
        !!existingDocuments[key];
    }

    // 🔥 CASE 3: If unchecked → clear path
    if (parsedBody.documents[key].uploaded === false) {
      parsedBody.documents[key].path = '';
    }
  });

  // ✅ DEBUG (optional)
  console.log('FINAL DOCUMENTS:', parsedBody.documents);

  return this.service.updateStudent(id, parsedBody);
}
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.deleteStudent(id);
}

}