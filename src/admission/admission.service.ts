import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdmissionDto } from './create-admission.dto';
import { Standard, AcademicStream } from '@prisma/client';



// Calculates TOTAL row values for the qualifying examination table.
// Uses explicit values if provided by the frontend; falls back to summing subjects.
function calcAcademicTotals(acad: { totalMaxMarks?: number; totalObtainedMarks?: number; totalPercentage?: number; subjects?: { maxMarks: number; obtainedMarks: number }[] }) {
  const subjects = acad.subjects ?? [];
  const totalMax = acad.totalMaxMarks ?? subjects.reduce((s, x) => s + (x.maxMarks ?? 0), 0);
  const totalObtained = acad.totalObtainedMarks ?? subjects.reduce((s, x) => s + (x.obtainedMarks ?? 0), 0);
  const totalPct = acad.totalPercentage != null
    ? parseFloat(acad.totalPercentage as any)
    : totalMax > 0 ? parseFloat(((totalObtained / totalMax) * 100).toFixed(2)) : null;
  return { totalMaxMarks: totalMax || null, totalObtainedMarks: totalObtained || null, totalPercentage: totalPct };
}

// Map frontend standard values (e.g. "1", "LKG", "11") to Prisma Standard enum
function toStandardEnum(val?: string): Standard {
  if (!val) return Standard.STD_1;
  const upper = val.toUpperCase().trim();
  if (upper === 'LKG') return Standard.LKG;
  if (upper === 'UKG') return Standard.UKG;
  const numMatch = upper.replace(/[^0-9]/g, '');
  if (numMatch) {
    const num = parseInt(numMatch, 10);
    if (num >= 1 && num <= 12) return (`STD_${num}` as Standard);
  }
  // Already an enum value?
  if (Object.values(Standard).includes(upper as Standard)) return upper as Standard;
  return Standard.STD_1;
}

function toAcademicStreamEnum(val?: string | null): string | null {
  if (!val) return null;

  const normalized = String(val)
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, '_');

  // We return the normalized string which matches the 'name' in the AcademicStream model
  const standardStreams = ['BIO_MATHS', 'CS_MATHS', 'BIO_CS', 'COMMERCE', 'HUMANITIES', 'OTHERS'];
  if (standardStreams.includes(normalized)) {
    return normalized;
  }

  const aliases: Record<string, string> = {
    GROUP_1: 'BIO_MATHS',
    GROUP_2: 'CS_MATHS',
    GROUP_3: 'BIO_CS',
    GROUP_4: 'COMMERCE',
  };

  return aliases[normalized] ?? normalized;
}



function getAcademicYearDateRange(academicYear?: string) {
  if (!academicYear) return null;
  const match = academicYear.match(/(\d{4})\s*[-/]\s*(\d{2,4})/);
  if (!match) return null;

  const startYear = parseInt(match[1], 10);
  let endYear = parseInt(match[2], 10);
  if (endYear < 100) {
    endYear = Math.floor(startYear / 100) * 100 + endYear;
  }

  return {
    start: new Date(Date.UTC(startYear, 3, 1, 0, 0, 0)),
    end: new Date(Date.UTC(endYear, 2, 31, 23, 59, 59)),
  };
}

function normalizeAcademicYear(academicYear?: string | null) {
  if (!academicYear) return null;
  const match = String(academicYear).trim().match(/(\d{4})\s*[-/]\s*(\d{2,4})/);
  if (!match) return null;

  const startYear = parseInt(match[1], 10);
  let endYear = parseInt(match[2], 10);
  if (endYear < 100) {
    endYear = Math.floor(startYear / 100) * 100 + endYear;
  }

  return `${startYear}-${endYear}`;
}

function getPreviousAcademicYear(academicYear?: string | null) {
  const normalized = normalizeAcademicYear(academicYear);
  if (!normalized) return null;

  const [startYear] = normalized.split('-').map((value) => parseInt(value, 10));
  return `${startYear - 1}-${startYear}`;
}
function getNextAcademicYear(academicYear?: string | null) {
  const normalized = normalizeAcademicYear(academicYear);
  if (!normalized) return null;

  const [, endYear] = normalized.split('-').map((value) => parseInt(value, 10));
  return `${endYear}-${endYear + 1}`;
}

function asOptionalString(value: unknown) {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
}

function parseBooleanFlag(value: unknown) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['true', 'yes', '1', 'y'].includes(normalized);
}

function parseOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function parseSubjectsJson(value: unknown) {
  const raw = asOptionalString(value);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((subject) => ({
        subjectName: asOptionalString(subject?.subjectName ?? subject?.subject ?? subject?.name),
        maxMarks: parseOptionalNumber(subject?.maxMarks ?? subject?.maxMark),
        obtainedMarks: parseOptionalNumber(subject?.obtainedMarks ?? subject?.marksObtained ?? subject?.score),
      }))
      .filter((subject) => subject.subjectName && subject.maxMarks != null && subject.obtainedMarks != null);
  } catch {
    return [];
  }
}

const BULK_UPLOAD_ALLOWED_KEYS = new Set(
  [
    'name',
    'standard',
    'gender',
    'dob',
    'religion',
    'community',
    'communityother',
    'customcommunity',
    'caste',
    'mothertongue',
    'aadharno',
    'bloodgroup',
    'identitymark1',
    'identitymark2',
    'previouslystudied',
    'previousschool',
    'transportmode',
    'vanneeded',
    'rte',
    'rteapplied',
    'section',
    'academicyear',
    'academicstream',
    'academicstreamcustom',
    'preferredphone',
    'parentsemail',
    'email',
    'fathername',
    'fatherphone',
    'fatherwhatsappno',
    'fatherwhatsapp',
    'fatheraadharno',
    'fatheraadhar',
    'fatheroccupation',
    'mothername',
    'motherphone',
    'motherwhatsappno',
    'motherwhatsapp',
    'motheraadharno',
    'motheraadhar',
    'motheroccupation',
    'familyincome',
    'siblingscount',
    'sibblings',
    'hostelrequired',
    'issingleparent',
    'guardianname',
    'guardianphone',
    'guardianwhatsapp',
    'guardianaadhar',
    'guardianoccupation',
    'guardianrelation',
    'sibling1name',
    'sibling1standard',
    'sibling1school',
    'sibling2name',
    'sibling2standard',
    'sibling2school',
    'doorno',
    'street',
    'landmark',
    'city',
    'state',
    'pin',
    'line1',
    'line2',
    'line3',
    'examname',
    'boardexamtype',
    'boardname',
    'registerno',
    'monthyear',
    'totalmaxmarks',
    'totalobtainedmarks',
    'totalpercentage',
    'subjectsjson',
    'admissiondate',
    'admissionfrom',
    'admissionto',
    'admissionno',
    'admissionnumber',
    'taluk',
    'district',
    'pincode',
    'examinationname',
    'overallpercentage',
    'studentname',
    'dateofbirth',
    'rteappliedstudent',
    'fathermobile',
    'fatherwhatsapp',
    'mothermobile',
    'motherwhatsapp',
    'numberofsiblings',
    'preferredcontact',
    'parentsemailid',
    'singleparent',
    'doornohoouseno',
    'streetvillage',
    'dateofappearance',
  ],
);

function normalizeBulkUploadKey(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

const BULK_UPLOAD_TEMPLATE_HEADERS = [
  'Student Name',
  'Standard',
  'Section',
  'Academic Year',
  'Admission Date',
  'Admission No',
  'Admission Number',
  'Admission From',
  'Admission To',
  'Gender',
  'Date of Birth',
  'Religion',
  'Community',
  'Custom Community',
  'Caste',
  'Mother Tongue',
  'Aadhar No',
  'Blood Group',
  'Identity Mark 1',
  'Identity Mark 2',
  'Previously Studied',
  'Previous School Standard',
  'Transport Mode',
  'RTE Applied Student',
  'Father Name',
  'Father Mobile',
  'Father WhatsApp',
  'Father Occupation',
  'Father Aadhar',
  'Mother Name',
  'Mother Mobile',
  'Mother WhatsApp',
  'Mother Occupation',
  'Mother Aadhar',
  'Family Income',
  'Number of Siblings',
  'Preferred Contact',
  'Parents Email ID',
  'Single Parent',
  'Guardian Relation',
  'Guardian Name',
  'Guardian Phone',
  'Guardian WhatsApp',
  'Guardian Aadhar',
  'Guardian Occupation',
  'Sibling 1 Name',
  'Sibling 1 School',
  'Sibling 1 Standard',
  'Sibling 2 Name',
  'Sibling 2 School',
  'Sibling 2 Standard',
  'Door No / House No',
  'Street / Village',
  'Taluk',
  'District',
  'State',
  'Pincode',
  'Examination Name',
  'Board Name',
  'Register No',
  'Date of Appearance',
  'Academic Stream',
  'Total Max Marks',
  'Total Obtained Marks',
  'Overall Percentage',
  'Subjects JSON',
  'Academic Stream Custom',
];

/**
 * Process and validate sibling school selection.
 * Logic:
 * - If school is "Other School", the customSchoolName is required and stored
 * - If school is anything else (e.g., "Same School" or predefined), customSchoolName is cleared
 * - Validates that customSchoolName is provided when "Other School" is selected
 * 
 * @param siblingNumber - "1" or "2" for the sibling identifier
 * @param schoolValue - The selected school value
 * @param customSchoolName - The custom school name (for "Other School" selection)
 * @returns Object with processedSchool and processedCustomSchoolName
 */
function processSiblingSchoolSelection(
  siblingNumber: string,
  schoolValue?: string,
  customSchoolName?: string,
): { processedSchool: string | null; processedCustomSchoolName: string | null } {
  // If no school selected, return nulls
  if (!schoolValue) {
    return { processedSchool: null, processedCustomSchoolName: null };
  }

  // If "Other School" is selected, custom school name is required
  if (schoolValue === "Other School") {
    if (!customSchoolName || customSchoolName.trim() === "") {
      throw new BadRequestException(
        `Sibling ${siblingNumber}: "Other School" selected but school name not provided. Please enter the school name.`
      );
    }
    // Store the custom school name and set school to "Other School"
    return {
      processedSchool: "Other School",
      processedCustomSchoolName: customSchoolName.trim(),
    };
  }

  // For any other selection (e.g., "Same School" or predefined schools), clear custom name
  return {
    processedSchool: schoolValue,
    processedCustomSchoolName: null, // Clear the custom school name
  };
}

@Injectable()
export class AdmissionService {
  constructor(private prisma: PrismaService) {}





   // 👇 your methods here

  async saveFamily(data: any) {
    const familyData = {
      fatherName: data.fatherName,
      fatherPhone: data.fatherPhone,
      fatherWhatsapp: data.fatherWhatsapp,
      fatherAadhar: data.fatherAadhar,
      fatherOccupation: data.fatherOccupation,
      preferredPhone: data.preferredPhone,
      parentsEmail: data.parentsEmail
    };

    const existingFamily = await this.prisma.family.findUnique({
      where: { studentId: data.studentId }
    });

    if (existingFamily) {
      return this.prisma.family.update({
        where: { studentId: data.studentId },
        data: familyData
      });
    }

    return this.prisma.family.create({
      data: {
        studentId: data.studentId,
        ...familyData
      }
    });
  }

  private escapeCsvCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    const str = String(value).replace(/\r?\n/g, ' ');
    if (/[",]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Auto-generate next admission number based on school code + academic year + sequence.
   * Format: PSF/2026-27/0001
   */
  async generateAdmissionNo(): Promise<string> {
    const settingsRow = await this.prisma.appSetting.findUnique({
      where: { key: 'admin.settings' },
    });
    const settings = (settingsRow?.value as Record<string, unknown>) || {};
    const schoolCode = String(settings.schoolCode || 'PSF');
    const academicYear = String(settings.academicYear || '2026-2027');
    const prefix = `${schoolCode}/${academicYear}/`;

    const lastAdmission = await this.prisma.admission.findFirst({
      where: { admissionNo: { startsWith: prefix } },
      orderBy: { admissionNo: 'desc' },
      select: { admissionNo: true },
    });

    let nextSeq = 1;
    // Rule: For 2026-2027, sequence must start at 12299
    if (academicYear === '2026-2027') {
      nextSeq = 12299;
    }

    if (lastAdmission?.admissionNo) {
      const parts = lastAdmission.admissionNo.split('/');
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) {
        nextSeq = Math.max(nextSeq, lastNum + 1);
      }
    }


    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  /**
   * Bulk approve/reject multiple admissions at once.
   */
  async bulkApproval(
    studentIds: string[],
    approved: boolean,
    approver?: { role?: string; email?: string },
    reason?: string,
  ) {
    const uniqueIds = [...new Set(studentIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      throw new BadRequestException('No student IDs provided');
    }

    const updateData = {
      isApproved: approved,
      approvedAt: approved ? new Date() : null,
      approvedByRole: approved ? ((approver?.role as any) ?? null) : null,
      approvedByEmail: approved ? (approver?.email ?? null) : null,
      approvalNote: reason ?? null,
    };

    const result = await this.prisma.admission.updateMany({
      where: { studentId: { in: uniqueIds } },
      data: updateData,
    });

    return { updatedCount: result.count, approved, studentIds: uniqueIds };
  }

  /**
   * Bulk create admissions from parsed CSV rows.
   */
  async bulkCreateFromCsv(rows: any[]) {
    this.validateBulkUploadRows(rows);

    const results: { row: number; status: string; admissionNo?: string; error?: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const requestedAdmissionNo = asOptionalString(row.admissionNo || row.admissionNumber);
        const admissionNo =
          !requestedAdmissionNo || requestedAdmissionNo.toUpperCase() === 'AUTO'
            ? await this.generateAdmissionNo()
            : requestedAdmissionNo;

        const rowAcademicYear = normalizeAcademicYear(asOptionalString(row.academicYear)) || undefined;
        const rowSubjects = parseSubjectsJson(row.subjectsJson);
        const boardName = asOptionalString(row.boardName);

        const transportRaw = asOptionalString(row.transportmode || row.transportMode);
        let transportMode = transportRaw;
        if (transportRaw?.toLowerCase() === 'school van') transportMode = 'School Van';
        if (transportRaw?.toLowerCase() === 'local') transportMode = 'Local';
        if (transportRaw?.toLowerCase() === 'van') transportMode = 'School Van';

        await this.createAdmission({
          name: asOptionalString(row.name || row.studentName) || 'Unknown',
          standard: asOptionalString(row.standard),
          gender: asOptionalString(row.gender) === 'FEMALE' ? 'FEMALE' : 'MALE',
          dob: asOptionalString(row.dob || row.dateOfBirth),
          religion: asOptionalString(row.religion),
          community: asOptionalString(row.community) || 'OTHERS',
          customCommunity: asOptionalString(row.communityOther || row.customCommunity),
          caste: asOptionalString(row.caste),
          motherTongue: asOptionalString(row.motherTongue),
          aadharNo: asOptionalString(row.aadharNo),
          bloodGroup: asOptionalString(row.bloodGroup),
          identification1: asOptionalString(row.identityMark1 || row.identification1),
          identification2: asOptionalString(row.identityMark2 || row.identification2),
          previousSchool: asOptionalString(row.previouslyStudied || row.previousSchool),
          transportMode: transportMode || (parseBooleanFlag(row.vanNeeded) ? 'School Van' : undefined),
          rte: parseBooleanFlag(row.rte) || parseBooleanFlag(row.rteApplied || row.rteAppliedStudent),
          section: asOptionalString(row.section),
          academicYear: rowAcademicYear,
          academicStream: toAcademicStreamEnum(asOptionalString(row.academicStream)),
          preferredPhone: asOptionalString(row.preferredPhone || row.preferredContact),
          parentsEmail: asOptionalString(row.parentsEmail || row.parentsEmailId || row.email),
          
          address: {
            doorNo: asOptionalString(row.doorNo || row.doorNoHouseNo),
            street: asOptionalString(row.street || row.streetVillage),
            landmark: asOptionalString(row.taluk || row.landmark),
            city: asOptionalString(row.district || row.city),
            state: asOptionalString(row.state),
            pin: asOptionalString(row.pin || row.pincode),
            line1: asOptionalString(row.doorNo || row.doorNoHouseNo) || asOptionalString(row.line1),
            line2: asOptionalString(row.street || row.streetVillage) || asOptionalString(row.line2),
            line3: asOptionalString(row.line3),
          },

          academics: [
            {
              examName: asOptionalString(row.examName || row.examinationName),
              boardName: boardName,
              registerNo: asOptionalString(row.registerNo),
              monthYear: asOptionalString(row.monthYear || row.dateOfAppearance),
              totalMaxMarks: Number(row.totalMaxMarks) || undefined,
              totalObtainedMarks: Number(row.totalObtainedMarks) || undefined,
              totalPercentage: Number(row.totalPercentage || row.overallPercentage) || undefined,
              subjects: rowSubjects,
              stream: toAcademicStreamEnum(asOptionalString(row.academicStream)),
            }
          ],

          family: {
            fatherName: asOptionalString(row.fatherName),
            fatherPhone: asOptionalString(row.fatherPhone || row.fatherMobile),
            fatherWhatsapp: asOptionalString(row.fatherWhatsAppNo || row.fatherWhatsApp || row.fatherWhatsapp),
            fatherAadhar: asOptionalString(row.fatherAadharNo || row.fatherAadhar),
            fatherOccupation: asOptionalString(row.fatherOccupation),
            motherName: asOptionalString(row.motherName),
            motherPhone: asOptionalString(row.motherPhone || row.motherMobile),
            motherWhatsapp: asOptionalString(row.motherWhatsAppNo || row.motherWhatsApp || row.motherWhatsapp),
            motherAadhar: asOptionalString(row.motherAadharNo || row.motherAadhar),
            motherOccupation: asOptionalString(row.motherOccupation),
            familyIncome: asOptionalString(row.familyIncome),
            siblings: asOptionalString(row.siblingsCount || row.numberOfSiblings || row.sibblings),
            hostelRequired: parseBooleanFlag(row.hostelRequired),
            isSingleParent: parseBooleanFlag(row.isSingleParent || row.singleParent),
            guardianName: asOptionalString(row.guardianName),
            guardianPhone: asOptionalString(row.guardianPhone),
            guardianWhatsapp: asOptionalString(row.guardianWhatsapp || row.guardianWhatsApp),
            guardianAadhar: asOptionalString(row.guardianAadhar || row.guardianAadhar),
            guardianOccupation: asOptionalString(row.guardianOccupation),
            guardianRelation: asOptionalString(row.guardianRelation),
            sibling1Name: asOptionalString(row.sibling1Name),
            sibling1Standard: asOptionalString(row.sibling1Standard),
            sibling1School: asOptionalString(row.sibling1School),
            sibling2Name: asOptionalString(row.sibling2Name),
            sibling2Standard: asOptionalString(row.sibling2Standard),
            sibling2School: asOptionalString(row.sibling2School),
          },
          admission: {
            admissionNo,
            admissionDate: asOptionalString(row.admissionDate),
            standard: asOptionalString(row.standard),
            admissionFrom: asOptionalString(row.admissionFrom),
            admissionTo: asOptionalString(row.admissionTo),
            principalSignature: 'Pending',
          },
          email: asOptionalString(row.email) || `student_${Date.now()}_${i}@school.local`,
        } as CreateAdmissionDto);

        results.push({ row: i + 1, status: 'success', admissionNo });
      } catch (error: any) {
        results.push({ row: i + 1, status: 'error', error: error?.message || 'Upload failed' });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    return { total: rows.length, successCount, errorCount, results };
  }

  getBulkUploadTemplateCsv() {
    const sampleRow = [
      'Arun Kumar',
      'STD_6',
      'A',
      '2026-2027',
      '2026-04-10',
      'AUTO',
      'AUTO',
      '2026-04-10',
      '2029-04-10',
      'MALE',
      '2015-03-14',
      'Hindu',
      'BC',
      '',
      'Vellalar',
      'Tamil',
      '123456789012',
      'B+',
      'Mole on right cheek',
      'Scar on left hand',
      'Govt Hr Sec School',
      '5',
      'School Van',
      'false',
      'Ravi Kumar',
      '9876543210',
      '9876543210',
      'Agriculture',
      '123456789013',
      'Meena',
      '9876543211',
      '9876543211',
      'Home Maker',
      '123456789014',
      '150000',
      '1',
      'father',
      'parents@example.com',
      'false',
      '',
      '',
      '',
      '',
      '',
      '',
      'Sibling One',
      'Same School',
      'LKG',
      '',
      '',
      '',
      '12/4',
      'North Street',
      'Near Temple',
      'Madurai',
      'Tamil Nadu',
      '625001',
      '10th Standard',
      'State Board',
      '2025001234',
      'March 2025',
      'BIO_CS',
      '600',
      '513',
      '85.5',
      '[{"subjectName":"Tamil","maxMarks":150,"obtainedMarks":130}]',
      '',
    ].map((cell) => this.escapeCsvCell(cell));

    return [BULK_UPLOAD_TEMPLATE_HEADERS.join(','), sampleRow.join(',')].join('\n');
  }

  private validateBulkUploadRows(rows: any[]) {
    rows.forEach((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new BadRequestException(`Row ${index + 1} is invalid. Each row must be an object.`);
      }

      const keys = Object.keys(row).filter((key) => key.trim() !== '');
      if (keys.length === 0) {
        throw new BadRequestException(`Row ${index + 1} is empty.`);
      }

      const unsupported = keys.filter((key) => !BULK_UPLOAD_ALLOWED_KEYS.has(normalizeBulkUploadKey(key)));
      if (unsupported.length > 0) {
        throw new BadRequestException(
          `Row ${index + 1} contains non-application columns: ${unsupported.join(', ')}. Download and use the bulk upload template.`,
        );
      }
    });
  }

  async createAdmission(data: CreateAdmissionDto, user?: any, files?: any) {
  // Fetch admin settings to check if approval is required
  const settingsRow = await this.prisma.appSetting.findUnique({ where: { key: 'admin.settings' } });
  const settings = (settingsRow?.value as Record<string, unknown>) || {};
  const requireApproval = settings.requireApprovalForAdmission === true || settings.requireApprovalForAdmission === 'true';

  const normalizePath = (p: string | undefined | null) =>
    typeof p === 'string' ? p.replace(/\\/g, '/') : '';

  // ✅ Safe fallback
  const docs = data.documents || {};

  
  return this.prisma.student.create({
    data: {
  name: data.name ?? '',   // ✅ fix
      standard: toStandardEnum(data.standard),
      gender: data.gender || 'MALE',
      dob: data.dob ? new Date(data.dob) : new Date(),
      religion: data.religion,
      community: data.community || 'OTHERS',
      caste: data.caste,
      customCommunity: data.customCommunity,
      motherTongue: data.motherTongue,
      aadharNo: data.aadharNo,
      bloodGroup: data.bloodGroup,
      identification1: data.identification1,
      identification2: data.identification2,
      previousSchool: data.previousSchool,
      transportMode: data.transportMode,
      rte: data.rte || false,
      academicStream: (val => val ? { connect: { name: val } } : undefined)(toAcademicStreamEnum(data.academicStream)),




      section: data.section || null,

      academicYear: data.academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      staffParent: data.staffParentId ? { connect: { id: data.staffParentId } } : undefined,

      siblingGroupId: data.siblingGroupId || null,

      // ✅ FAMILY
      family: data.family
  ? {
      create: {
        fatherName: data.family.isSingleParent && data.family.guardianRelation !== 'father' ? null : data.family.fatherName,
        fatherPhone: data.family.isSingleParent && data.family.guardianRelation !== 'father' ? null : data.family.fatherPhone,
        fatherWhatsapp: data.family.isSingleParent && data.family.guardianRelation !== 'father' ? null : data.family.fatherWhatsapp,
        fatherAadhar: data.family.isSingleParent && data.family.guardianRelation !== 'father' ? null : data.family.fatherAadhar,
        fatherOccupation: data.family.isSingleParent && data.family.guardianRelation !== 'father' ? null : data.family.fatherOccupation,
preferredPhone: data.preferredPhone,
parentsEmail: data.parentsEmail,
        motherName: data.family.isSingleParent && data.family.guardianRelation !== 'mother' ? null : data.family.motherName,
        motherPhone: data.family.isSingleParent && data.family.guardianRelation !== 'mother' ? null : data.family.motherPhone,
        motherWhatsapp: data.family.isSingleParent && data.family.guardianRelation !== 'mother' ? null : data.family.motherWhatsapp,
        motherAadhar: data.family.isSingleParent && data.family.guardianRelation !== 'mother' ? null : data.family.motherAadhar,
        motherOccupation: data.family.isSingleParent && data.family.guardianRelation !== 'mother' ? null : data.family.motherOccupation,

        // Single parent & guardian
        isSingleParent: data.family.isSingleParent || false,
        guardianName: data.family.guardianName,
        guardianPhone: data.family.guardianPhone,
        guardianWhatsapp: data.family.guardianWhatsapp,
        guardianAadhar: data.family.guardianAadhar,
        guardianOccupation: data.family.guardianOccupation,
        guardianRelation: data.family.guardianRelation,

        // ✅ Sibling 1 details with school selection validation
        sibling1Name: data.family.sibling1Name,
        sibling1Standard: data.family.sibling1Standard,
        ...(() => {
          const sibling1Result = processSiblingSchoolSelection(
            "1",
            data.family.sibling1School,
            data.family.sibling1OtherSchoolName,
          );
          return {
            sibling1School: sibling1Result.processedSchool,
            sibling1OtherSchoolName: sibling1Result.processedCustomSchoolName,
          };
        })(),

        // ✅ Sibling 2 details with school selection validation
        sibling2Name: data.family.sibling2Name,
        sibling2Standard: data.family.sibling2Standard,
        ...(() => {
          const sibling2Result = processSiblingSchoolSelection(
            "2",
            data.family.sibling2School,
            data.family.sibling2OtherSchoolName,
          );
          return {
            sibling2School: sibling2Result.processedSchool,
            sibling2OtherSchoolName: sibling2Result.processedCustomSchoolName,
          };
        })(),

        familyIncome: data.family.familyIncome
          ? parseFloat(data.family.familyIncome)
          : null,
        siblings: data.family.siblings,
        hostelRequired: data.family.hostelRequired || false,
      },
    }
        : undefined,

      // ✅ ADDRESS
      address: data.address
        ? {
            create: {
               doorNo: data.address.doorNo || data.address.line1 || 'Pending',
  street: data.address.street || data.address.line2 || '',
  landmark: data.address.landmark || '',
  city: data.address.city || '',
  state: data.address.state || '',
  line1: data.address.doorNo || data.address.line1 || 'Pending',
  line2: data.address.street || data.address.line2 || '',
  line3: `${data.address.landmark || ''}, ${data.address.city || ''}, ${data.address.state || ''}` || data.address.line3 || '',
  pin: data.address.pin || '000000',
}
          }
        : undefined,

      // ✅ DOCUMENTS (FIXED)
      documents: data.documents
        ? {
            create: [
              {
                photo: docs.profilePhoto?.uploaded ?? docs.photo?.uploaded ?? false,
                photoPath: normalizePath(docs.profilePhoto?.path || docs.photo?.path),

                birthCert: docs.birthCert?.uploaded ?? false,
                birthCertPath: normalizePath(docs.birthCert?.path),
                birthCertHardCopy: docs.birthCert?.hardCopy ?? false,

                communityCert: docs.communityCert?.uploaded ?? false,
                communityCertPath: normalizePath(docs.communityCert?.path),
                communityCertHardCopy: docs.communityCert?.hardCopy ?? false,

                aadharStudent: docs.aadharStudent?.uploaded ?? false,
                aadharStudentPath: normalizePath(docs.aadharStudent?.path),
                aadharStudentHardCopy: docs.aadharStudent?.hardCopy ?? false,

                aadharFather: docs.aadharFather?.uploaded ?? false,
                aadharFatherPath: normalizePath(docs.aadharFather?.path),
                aadharFatherHardCopy: docs.aadharFather?.hardCopy ?? false,

                aadharMother: docs.aadharMother?.uploaded ?? false,
                aadharMotherPath: normalizePath(docs.aadharMother?.path),
                aadharMotherHardCopy: docs.aadharMother?.hardCopy ?? false,

                transferCert: docs.transferCert?.uploaded ?? false,
                transferCertPath: normalizePath(docs.transferCert?.path),
                transferCertHardCopy: docs.transferCert?.hardCopy ?? false,

                photosReceived: (data as any).photosReceived ?? docs.photosReceived ?? false,
              },
            ],
          }
        : undefined,

      // ✅ ACADEMICS — stores the qualifying examination table (SSLC/MATRIC/CBSE)
      academics:
        data.academics && data.academics.length > 0
          ? {
              create: await Promise.all(data.academics.map(async (acad) => {
                const totals = calcAcademicTotals({
                  ...acad,
                  subjects: acad.subjects?.map(s => ({
                    maxMarks: s.maxMarks ?? 0,
                    obtainedMarks: s.obtainedMarks ?? 0
                  }))
                });
                return {
                  examName: acad.examName,
                  boardName: acad.boardName || 'State Board',
                  registerNo: acad.registerNo,
                  monthYear: acad.monthYear,
                  totalMaxMarks: totals.totalMaxMarks,
                  totalObtainedMarks: totals.totalObtainedMarks,
                  totalPercentage: totals.totalPercentage,
                  academicStream: (val => val ? { connect: { name: val } } : undefined)(toAcademicStreamEnum(acad.stream)),



                  subjects: acad.subjects && acad.subjects.length > 0
                    ? {
                        create: acad.subjects.map((s) => ({
                          subjectName: s.subjectName || 'N/A',
                          maxMarks: s.maxMarks ?? 0,
                          obtainedMarks: s.obtainedMarks ?? 0,
                          percentage: s.percentage ?? (
                            (s.maxMarks ?? 0) > 0
                              ? parseFloat((((s.obtainedMarks ?? 0) / (s.maxMarks ?? 1)) * 100).toFixed(2))
                              : 0
                          ),
                        })),
                      }
                    : undefined,

                };
              })),
            }
          : undefined,


      // ✅ ADMISSION (auto-generate admission number if not provided or 'AUTO')
     admission: data.admission
  ? {
      create: {
        admissionNo: (!data.admission.admissionNo || data.admission.admissionNo === 'AUTO')
          ? await this.generateAdmissionNo()
          : data.admission.admissionNo,

        admissionDate: data.admission.admissionDate
          ? new Date(data.admission.admissionDate)
          : new Date(),

        standard: toStandardEnum(data.admission.standard || data.standard),

        // Approval logic based on settings
        isApproved: requireApproval
          ? (user?.permissions?.includes('admission:approve') || false)
          : true,
        staffSignature:
          data.admission.staffSignaturePath ||
          data.admission.staffSignature,

        principalSignature:
          data.admission.principalSignaturePath ||
          data.admission.principalSignature,
      },
    }
        : undefined,
        users: {
          create: {
           name: data.name ?? '',
            email: data?.email ?? `user${data.admission?.admissionNo}@example.com`,
            password: 'defaultpassword', // In real app, hash this and generate properly
            role: 'STUDENT',
            // isActive: true,
           
          },
        },
    },
    

    include: {
      family: true,
      address: true,
      documents: true,
      academics: { include: { subjects: true } },
      admission: true,
    },
  });
}

  async getAllStudents() {
    const students = await this.prisma.student.findMany({
      include: {
        family: true,
        address: true,
        admission: true,
        academics: {
          include: {
            subjects: true,
          },
        },
        documents: true,
        users: {
          select: {
            id: true,
            isActive: true,
          },
        },
      },
      orderBy: [
        { standard: 'asc' },
        { name: 'asc' },
      ],
    });

    // Group siblings based on siblingGroupId
    const siblingGroups = new Map<string, any[]>();
    students.forEach((s) => {
      if (s.siblingGroupId) {
        if (!siblingGroups.has(s.siblingGroupId)) {
          siblingGroups.set(s.siblingGroupId, []);
        }
        siblingGroups.get(s.siblingGroupId)?.push({
          id: s.id,
          name: s.name,
          standard: s.standard,
          admission: s.admission,
        });
      }
    });

    return students.map((s) => ({
      ...s,
      siblings: s.siblingGroupId
        ? (siblingGroups.get(s.siblingGroupId) || []).filter((sib) => sib.id !== s.id)
        : [],
    }));
  }

  async getStudentById(id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        family: true,
        address: true,
        documents: true,
        academics: {
          include: {
            subjects: true,
          },
        },
        admission: true,
      },
    });

    if (student?.siblingGroupId) {
      const siblings = await this.prisma.student.findMany({
        where: {
          siblingGroupId: student.siblingGroupId,
          id: { not: id },
        },
        include: {
          admission: true,
        },
      });
      return { ...student, siblings };
    }

    return { ...student, siblings: [] };
  }

  async getPendingAdmissions() {
    return this.prisma.student.findMany({
      where: {
        admission: {
          is: {
            isApproved: false,
          },
        },
      },
      include: {
        admission: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async setAdmissionApproval(
    studentId: string,
    approved: boolean,
    approver?: { role?: string; email?: string },
    reason?: string,
  ) {
    const existing = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        admission: {
          select: { id: true },
        },
      },
    });

    if (!existing?.admission?.id) {
      throw new Error('Admission record not found for this student');
    }

    return this.prisma.admission.update({
      where: { studentId },
      data: {
        isApproved: approved,
        approvedAt: approved ? new Date() : null,
        approvedByRole: approved ? ((approver?.role as any) ?? null) : null,
        approvedByEmail: approved ? (approver?.email ?? null) : null,
        approvalNote: approved ? (reason ?? null) : null,
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            standard: true,
          },
        },
      },
    });
  }

    async updateStudent(id: string, data: CreateAdmissionDto) {

    // Defensive: check for missing or invalid data
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid update data: expected an object');
    }

    const updateData: any = {
      name: data.name ?? '',
      standard: toStandardEnum(data.standard),
      gender: data.gender || 'MALE',
      religion: data.religion,
      community: data.community || 'OTHERS',
      customCommunity: data.customCommunity,
      caste: data.caste,
      motherTongue: data.motherTongue,
      aadharNo: data.aadharNo,
      bloodGroup: data.bloodGroup,
      identification1: data.identification1,
      identification2: data.identification2,
      previousSchool: data.previousSchool,
      transportMode: data.transportMode,
      rte: typeof data.rte === 'boolean' ? data.rte : false,
      academicStream: (val => val ? { connect: { name: val } } : { disconnect: true })(toAcademicStreamEnum(data.academicStream)),


      section: data.section ?? undefined,
      academicYear: data.academicYear ?? `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      staffParent: data.staffParentId ? { connect: { id: data.staffParentId } } : { disconnect: true },
      siblingGroupId: data.siblingGroupId ?? undefined,
      kitTag: data.kitTag ?? undefined,
    };


    if (data.dob) updateData.dob = new Date(data.dob);

    if (data.family) {
      const familyAny = data.family as any;
      updateData.family = {
        upsert: {
          update: {
            fatherName: data.family.isSingleParent && data.family.guardianRelation !== 'father' ? null : data.family.fatherName,
            fatherPhone: data.family.isSingleParent && data.family.guardianRelation !== 'father' ? null : data.family.fatherPhone,
            fatherWhatsapp: data.family.isSingleParent && data.family.guardianRelation !== 'father' ? null : data.family.fatherWhatsapp,
            fatherAadhar: data.family.isSingleParent && data.family.guardianRelation !== 'father' ? null : data.family.fatherAadhar,
            fatherOccupation: data.family.isSingleParent && data.family.guardianRelation !== 'father' ? null : data.family.fatherOccupation,
            preferredPhone: familyAny.preferredPhone || data.preferredPhone,
            parentsEmail: familyAny.parentsEmail || data.parentsEmail,
            motherName: data.family.isSingleParent && data.family.guardianRelation !== 'mother' ? null : data.family.motherName,
            motherPhone: data.family.isSingleParent && data.family.guardianRelation !== 'mother' ? null : data.family.motherPhone,
            motherWhatsapp: data.family.isSingleParent && data.family.guardianRelation !== 'mother' ? null : data.family.motherWhatsapp,
            motherAadhar: data.family.isSingleParent && data.family.guardianRelation !== 'mother' ? null : data.family.motherAadhar,
            motherOccupation: data.family.isSingleParent && data.family.guardianRelation !== 'mother' ? null : data.family.motherOccupation,
            isSingleParent: data.family.isSingleParent || false,
            guardianName: data.family.guardianName,
            guardianPhone: data.family.guardianPhone,
            guardianWhatsapp: data.family.guardianWhatsapp,
            guardianAadhar: data.family.guardianAadhar,
            guardianOccupation: data.family.guardianOccupation,
            guardianRelation: data.family.guardianRelation,
            // ✅ Sibling 1 with school selection validation
            sibling1Name: data.family.sibling1Name,
            sibling1Standard: data.family.sibling1Standard,
            ...(() => {
              const sibling1Result = processSiblingSchoolSelection(
                "1",
                data.family.sibling1School,
                data.family.sibling1OtherSchoolName,
              );
              return {
                sibling1School: sibling1Result.processedSchool,
                sibling1OtherSchoolName: sibling1Result.processedCustomSchoolName,
              };
            })(),
            // ✅ Sibling 2 with school selection validation
            sibling2Name: data.family.sibling2Name,
            sibling2Standard: data.family.sibling2Standard,
            ...(() => {
              const sibling2Result = processSiblingSchoolSelection(
                "2",
                data.family.sibling2School,
                data.family.sibling2OtherSchoolName,
              );
              return {
                sibling2School: sibling2Result.processedSchool,
                sibling2OtherSchoolName: sibling2Result.processedCustomSchoolName,
              };
            })(),
            familyIncome: data.family.familyIncome ? parseFloat(data.family.familyIncome) : null,
            siblings: data.family.siblings,
            hostelRequired: data.family.hostelRequired || false,
          },
          create: {
            fatherName: data.family.isSingleParent && data.family.guardianRelation !== 'father' ? null : data.family.fatherName,
            fatherPhone: data.family.isSingleParent && data.family.guardianRelation !== 'father' ? null : data.family.fatherPhone,
            fatherWhatsapp: data.family.isSingleParent && data.family.guardianRelation !== 'father' ? null : data.family.fatherWhatsapp,
            fatherAadhar: data.family.isSingleParent && data.family.guardianRelation !== 'father' ? null : data.family.fatherAadhar,
            fatherOccupation: data.family.isSingleParent && data.family.guardianRelation !== 'father' ? null : data.family.fatherOccupation,
            preferredPhone: familyAny.preferredPhone || data.preferredPhone,
            parentsEmail: familyAny.parentsEmail || data.parentsEmail,
            motherName: data.family.isSingleParent && data.family.guardianRelation !== 'mother' ? null : data.family.motherName,
            motherPhone: data.family.isSingleParent && data.family.guardianRelation !== 'mother' ? null : data.family.motherPhone,
            motherWhatsapp: data.family.isSingleParent && data.family.guardianRelation !== 'mother' ? null : data.family.motherWhatsapp,
            motherAadhar: data.family.isSingleParent && data.family.guardianRelation !== 'mother' ? null : data.family.motherAadhar,
            motherOccupation: data.family.isSingleParent && data.family.guardianRelation !== 'mother' ? null : data.family.motherOccupation,
            isSingleParent: data.family.isSingleParent || false,
            guardianName: data.family.guardianName,
            guardianPhone: data.family.guardianPhone,
            guardianWhatsapp: data.family.guardianWhatsapp,
            guardianAadhar: data.family.guardianAadhar,
            guardianOccupation: data.family.guardianOccupation,
            guardianRelation: data.family.guardianRelation,
            // ✅ Sibling 1 with school selection validation
            sibling1Name: data.family.sibling1Name,
            sibling1Standard: data.family.sibling1Standard,
            ...(() => {
              const sibling1Result = processSiblingSchoolSelection(
                "1",
                data.family.sibling1School,
                data.family.sibling1OtherSchoolName,
              );
              return {
                sibling1School: sibling1Result.processedSchool,
                sibling1OtherSchoolName: sibling1Result.processedCustomSchoolName,
              };
            })(),
            // ✅ Sibling 2 with school selection validation
            sibling2Name: data.family.sibling2Name,
            sibling2Standard: data.family.sibling2Standard,
            ...(() => {
              const sibling2Result = processSiblingSchoolSelection(
                "2",
                data.family.sibling2School,
                data.family.sibling2OtherSchoolName,
              );
              return {
                sibling2School: sibling2Result.processedSchool,
                sibling2OtherSchoolName: sibling2Result.processedCustomSchoolName,
              };
            })(),
            familyIncome: data.family.familyIncome ? parseFloat(data.family.familyIncome) : null,
            siblings: data.family.siblings,
            hostelRequired: data.family.hostelRequired || false,
          },
        },
      };
    }
    if (data.address) {
  const addressAny = data.address as any;
  updateData.address = {
    upsert: {
      update: {
        doorNo: addressAny.doorNo || addressAny.line1 || 'Pending',
        street: addressAny.street || addressAny.village || addressAny.line2 || '',
        landmark: addressAny.landmark || addressAny.taluk || '',
        city: addressAny.city || addressAny.district || '',
        state: addressAny.state || '',
        line1: addressAny.doorNo || addressAny.line1 || 'Pending',
        line2: addressAny.street || addressAny.village || addressAny.line2 || '',
        line3:
          `${addressAny.landmark || addressAny.taluk || ''}, ${addressAny.city || addressAny.district || ''}, ${addressAny.state || ''}`.trim() ||
          addressAny.line3 ||
          '',
        pin: addressAny.pin || '000000',
      },
      create: {
        doorNo: addressAny.doorNo || addressAny.line1 || 'Pending',
        street: addressAny.street || addressAny.village || addressAny.line2 || '',
        landmark: addressAny.landmark || addressAny.taluk || '',
        city: addressAny.city || addressAny.district || '',
        state: addressAny.state || '',
        line1: addressAny.doorNo || addressAny.line1 || 'Pending',
        line2: addressAny.street || addressAny.village || addressAny.line2 || '',
        line3:
          `${addressAny.landmark || addressAny.taluk || ''}, ${addressAny.city || addressAny.district || ''}, ${addressAny.state || ''}`.trim() ||
          addressAny.line3 ||
          '',
        pin: addressAny.pin || '000000',
      },
    },
  };
}
    if (data.documents) {
        // Helper to normalize slashes
        const normalizePath = (p: string | undefined | null) =>
          typeof p === 'string' ? p.replace(/\\/g, '/') : p;
        updateData.documents = {
          deleteMany: {},
          create: [
  {
photo: data.documents?.photo?.uploaded ?? false,
photoPath: normalizePath(data.documents?.photo?.path) || '',

    birthCert: data.documents?.birthCert?.uploaded ?? false,
    birthCertPath: normalizePath(data.documents?.birthCert?.path) || '',
    birthCertHardCopy: data.documents?.birthCert?.hardCopy ?? false,

    communityCert: data.documents?.communityCert?.uploaded ?? false,
    communityCertPath: normalizePath(data.documents?.communityCert?.path) || '',
    communityCertHardCopy: data.documents?.communityCert?.hardCopy ?? false,

    aadharStudent: data.documents?.aadharStudent?.uploaded ?? false,
    aadharStudentPath: normalizePath(data.documents?.aadharStudent?.path) || '',
    aadharStudentHardCopy: data.documents?.aadharStudent?.hardCopy ?? false,

    aadharFather: data.documents?.aadharFather?.uploaded ?? false,
    aadharFatherPath: normalizePath(data.documents?.aadharFather?.path) || '',
    aadharFatherHardCopy: data.documents?.aadharFather?.hardCopy ?? false,

    aadharMother: data.documents?.aadharMother?.uploaded ?? false,
    aadharMotherPath: normalizePath(data.documents?.aadharMother?.path) || '',
    aadharMotherHardCopy: data.documents?.aadharMother?.hardCopy ?? false,

    transferCert: data.documents?.transferCert?.uploaded ?? false,
    transferCertPath: normalizePath(data.documents?.transferCert?.path) || '',
    transferCertHardCopy: data.documents?.transferCert?.hardCopy ?? false,

    photosReceived: (data as any).photosReceived ?? data.documents?.photosReceived ?? false,
  },
]
        };
    }
    // Academics update: delete existing and recreate with subjects
    if (data.academics && data.academics.length > 0) {
      // First delete existing subject marks for all academics
      const existingAcademics = await this.prisma.academicDetail.findMany({
        where: { studentId: id },
        select: { id: true },
      });
      if (existingAcademics.length > 0) {
        await this.prisma.subjectMark.deleteMany({
          where: { academicId: { in: existingAcademics.map((a) => a.id) } },
        });
        await this.prisma.academicDetail.deleteMany({
          where: { studentId: id },
        });
      }
      updateData.academics = {
        create: await Promise.all(data.academics.map(async (acad) => {
          const totals = calcAcademicTotals({
            ...acad,
            subjects: acad.subjects?.map(s => ({
              maxMarks: s.maxMarks ?? 0,
              obtainedMarks: s.obtainedMarks ?? 0
            }))
          });
          return {
            examName: acad.examName,
            boardName: acad.boardName || 'State Board',
            registerNo: acad.registerNo,
            monthYear: acad.monthYear,
            totalMaxMarks: totals.totalMaxMarks,
            totalObtainedMarks: totals.totalObtainedMarks,
            totalPercentage: totals.totalPercentage,
            academicStream: (val => val ? { connect: { name: val } } : undefined)(toAcademicStreamEnum(acad.stream)),



            subjects: acad.subjects && acad.subjects.length > 0
              ? {
                  create: acad.subjects.map((s) => ({
                    subjectName: s.subjectName || 'N/A',
                    maxMarks: s.maxMarks ?? 0,
                    obtainedMarks: s.obtainedMarks ?? 0,
                    percentage: s.percentage ?? (
                      (s.maxMarks ?? 0) > 0
                        ? parseFloat((((s.obtainedMarks ?? 0) / (s.maxMarks ?? 1)) * 100).toFixed(2))
                        : 0
                    ),
                  })),

                }
              : undefined,
          };
        })),
      };

    }
    if (data.admission) {
      updateData.admission = {
        upsert: {
          update: {
            admissionNo: data.admission.admissionNo || 'TBD',
            admissionFrom: data.admission.admissionFrom ? new Date(data.admission.admissionFrom) : undefined,
            admissionTo: data.admission.admissionTo ? new Date(data.admission.admissionTo) : undefined,
            admissionDate: data.admission.admissionDate ? new Date(data.admission.admissionDate) : undefined,
            standard: toStandardEnum(data.admission.standard || data.standard),
            staffSignature: data.admission.staffSignaturePath || data.admission.staffSignature,
            principalSignature: data.admission.principalSignaturePath || data.admission.principalSignature,
          },
          create: {
            admissionNo: data.admission.admissionNo || 'TBD',
            admissionDate: data.admission.admissionDate ? new Date(data.admission.admissionDate) : new Date(),
            admissionFrom: data.admission.admissionFrom ? new Date(data.admission.admissionFrom) : undefined,
            admissionTo: data.admission.admissionTo ? new Date(data.admission.admissionTo) : undefined,
            standard: toStandardEnum(data.admission.standard || data.standard),
            staffSignature: data.admission.staffSignaturePath || data.admission.staffSignature,
            principalSignature: data.admission.principalSignaturePath || data.admission.principalSignature,
          },
        },
      };
    }
    return this.prisma.student.update({
      // where: { id },
      where:{ id },
      data: updateData,
      include: {
        family: true,
        address: true,
        documents: true,
        academics: { include: { subjects: true } },
        admission: true,
      },
    });
  }

  async patchStudent(id: string, data: Partial<CreateAdmissionDto>) {
    const updateData: any = {};
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.kitTag !== undefined) updateData.kitTag = data.kitTag;
    if (data.standard !== undefined) updateData.standard = toStandardEnum(data.standard as any);
    if (data.section !== undefined) updateData.section = data.section;
    if (data.academicYear !== undefined) updateData.academicYear = data.academicYear;
    
    return this.prisma.student.update({
      where: { id },
      data: updateData,
      include: {
        admission: true,
      }
    });
  }

  async deleteStudent(id: string) {
    // Soft delete: mark as inactive instead of removing from database
    return this.prisma.student.update({
      where: { id },
      data: { users:{
        update: {
          isActive: false,
        },
      } } },
     );
    }

  async unarchiveStudent(id: string) {
    return this.prisma.student.update({
      where: { id },
      data: {
        users: {
          update: {
            isActive: true,
          },
        },
      },
    });
  }

  async getAdmissionDashboard(academicYear?: string) {
    const settingsRow = await this.prisma.appSetting.findUnique({
      where: { key: 'admin.settings' },
      select: { value: true }
    });
    const settings = (settingsRow?.value as Record<string, unknown> | undefined) || {};
    const resolvedAcademicYear =
      normalizeAcademicYear(academicYear) ||
      normalizeAcademicYear(String(settings.academicYear || '')) ||
      academicYear ||
      null;
    const previousAcademicYear = getPreviousAcademicYear(resolvedAcademicYear);
    const dateRange = getAcademicYearDateRange(resolvedAcademicYear || undefined);
    const previousDateRange = getAcademicYearDateRange(previousAcademicYear || undefined);
    const where = dateRange
      ? { admissionDate: { gte: dateRange.start, lte: dateRange.end } }
      : undefined;
    const previousWhere = previousDateRange
      ? { admissionDate: { gte: previousDateRange.start, lte: previousDateRange.end } }
      : undefined;

    const admissionStudentIds = dateRange
      ? await this.prisma.admission
          .findMany({ where, select: { studentId: true } })
          .then((rows) => rows.map((r) => r.studentId))
      : null;

    const docsMissingWhere = admissionStudentIds !== null
      ? { id: { in: admissionStudentIds } }
      : {};

    const [total, approved, pending, byStandardRaw, seatsConfigRaw, previousYearTotal, docsMissing, recentAdmissions] = await Promise.all([
      this.prisma.admission.count({ where }),
      this.prisma.admission.count({ where: { ...(where || {}), isApproved: true } }),
      this.prisma.admission.count({ where: { ...(where || {}), isApproved: false } }),
      this.prisma.admission.groupBy({
        by: ['standard'],
        where,
        _count: { _all: true },
      }),
      this.prisma.appSetting.findUnique({ where: { key: 'admission.standardSeats' } }),
      previousWhere ? this.prisma.admission.count({ where: previousWhere }) : Promise.resolve(0),
      this.prisma.student.count({
        where: {
          ...docsMissingWhere,
          OR: [
            { documents: { none: {} } },
            {
              documents: {
                some: {
                  OR: [
                    { birthCert: false, birthCertPath: null },
                    { communityCert: false, communityCertPath: null },
                    { aadharStudent: false, aadharStudentPath: null },
                  ],
                },
              },
            },
          ],
        },
      }),
      this.prisma.admission.findMany({
        where,
        orderBy: { admissionDate: 'desc' },
        take: 10,
        select: {
          id: true,
          admissionNo: true,
          admissionDate: true,
          standard: true,
          isApproved: true,
          student: {
            select: {
              id: true,
              name: true,
              gender: true,
              section: true,
            },
          },
        },
      }),
    ]);

    // Sort byStandard by standard ascending
    const byStandard = [...byStandardRaw].sort((a, b) => String(a.standard).localeCompare(String(b.standard)));

    const approvedByStandardRaw = await this.prisma.admission.groupBy({
      by: ['standard'],
      where: { ...(where || {}), isApproved: true },
      _count: { _all: true },
    });

    const seatMap = ((seatsConfigRaw?.value as Record<string, number>) || {}) as Record<string, number>;
    const approvedCountMap = new Map<string, number>(
      approvedByStandardRaw.map((x) => [String(x.standard), x._count._all]),
    );

    const standards = new Set<string>([
      ...Object.keys(seatMap),
      ...byStandard.map((x) => x.standard),
    ]);

    const seatSummary = [...standards]
      .sort((a, b) => String(a).localeCompare(String(b)))
      .map((standard) => {
        const totalSeats = Number(seatMap[standard] || 0);
        const filledSeats = Number(approvedCountMap.get(standard) || 0);
        const pendingSeats = Math.max(totalSeats - filledSeats, 0);
        return {
          standard,
          totalSeats,
          filledSeats,
          pendingSeats,
        };
      });

    const totalSeatCapacity = Object.values(seatMap).reduce((sum, value) => sum + Number(value || 0), 0);
    const progressBase = totalSeatCapacity > 0 ? totalSeatCapacity : Math.max(total, 1);
    const progressValue = totalSeatCapacity > 0 ? approved : total;
    const progressPercent = progressBase > 0
      ? Number(((progressValue / progressBase) * 100).toFixed(2))
      : 0;
    const milestoneThresholds = [25, 50, 75, 100];
    const milestones = milestoneThresholds.map((threshold) => {
      const targetCount = Math.max(1, Math.ceil((progressBase * threshold) / 100));
      const achieved = progressValue >= targetCount;
      return {
        label: `${threshold}% admissions milestone`,
        threshold,
        targetCount,
        currentCount: progressValue,
        remainingCount: Math.max(targetCount - progressValue, 0),
        achieved,
      };
    });
    const percentageChange = previousYearTotal > 0
      ? Number((((total - previousYearTotal) / previousYearTotal) * 100).toFixed(2))
      : total > 0 ? 100 : 0;

    return {
      academicYear: resolvedAcademicYear,
      total,
      approved,
      pending,
      docsMissing,
      byStandard: byStandard.map((s) => ({ standard: s.standard, count: s._count._all })),
      standardSeats: seatMap,
      seatSummary,
      yearComparison: {
        currentAcademicYear: resolvedAcademicYear,
        previousAcademicYear,
        currentTotal: total,
        previousTotal: previousYearTotal,
        difference: total - previousYearTotal,
        percentageChange,
        trend: percentageChange >= 0 ? 'up' : 'down',
      },
      admissionProgress: {
        basis: totalSeatCapacity > 0 ? 'approved_vs_total_seats' : 'total_admissions',
        totalTarget: progressBase,
        currentCount: progressValue,
        progressPercent,
      },
      milestones,
      upcomingMilestones: milestones.filter((milestone) => !milestone.achieved).slice(0, 3),
      recentApplicants: recentAdmissions.map((a) => ({
        id: a.id,
        admissionNo: a.admissionNo,
        admissionDate: a.admissionDate,
        standard: a.standard,
        isApproved: a.isApproved,
        studentId: a.student.id,
        studentName: a.student.name,
        gender: a.student.gender,
        section: a.student.section,
      })),
    };
  }

  async getStandardSeatConfig() {
    const settings = await this.prisma.appSetting.findUnique({
      where: { key: 'admission.standardSeats' },
    });
    return { seats: (settings?.value as Record<string, number>) || {} };
  }

  async updateStandardSeatConfig(seats: Record<string, number>, updatedByEmail?: string) {
    const sanitized: Record<string, number> = {};
    for (const [key, value] of Object.entries(seats || {})) {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) continue;
      sanitized[key] = Math.floor(n);
    }

    const saved = await this.prisma.appSetting.upsert({
      where: { key: 'admission.standardSeats' },
      update: { value: sanitized, updatedByEmail },
      create: { key: 'admission.standardSeats', value: sanitized, updatedByEmail },
    });
    return { seats: (saved.value as Record<string, number>) || {} };
  }

  async exportAdmissionsCsv(academicYear?: string) {
    const dateRange = getAcademicYearDateRange(academicYear);
    const where = dateRange
      ? { admission: { is: { admissionDate: { gte: dateRange.start, lte: dateRange.end } } } }
      : undefined;

    const students = await this.prisma.student.findMany({
      where,
      include: {
        family: true,
        admission: true,
        users: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = [
      'Student Name',
      'Admission No',
      'Standard',
      'Academic Year',
      'Approved',
      'Status',
      'Admission Date',
      'Father Name',
      'Father Phone',
      'Mother Name',
      'Mother Phone',
      'Sibling Group Id',
    ];

    const rows = students.map((s) => {
      const ad = s.admission;
      const acad = ad?.admissionDate
        ? `${ad.admissionDate.getUTCFullYear()}-${String((ad.admissionDate.getUTCFullYear() + 1) % 100).padStart(2, '0')}`
        : '';
      return [
        s.name,
        ad?.admissionNo || '',
        s.standard,
        academicYear || acad,
        ad?.isApproved ? 'Yes' : 'No',
        s.users?.isActive === false ? 'Archived' : 'Active',
        ad?.admissionDate ? ad.admissionDate.toISOString().slice(0, 10) : '',
        s.family?.fatherName || '',
        s.family?.fatherPhone || '',
        s.family?.motherName || '',
        s.family?.motherPhone || '',
        s.siblingGroupId || '',
      ].map((cell) => this.escapeCsvCell(cell));
    });

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  async promoteAllStudents(academicYear: string, newAcademicYear: string) {
    const students = await this.prisma.student.findMany({
      where: { academicYear },
      include: {
        admission: {
          select: {
            admissionNo: true,
            isApproved: true,
          },
        },
      },
    });

    let updatedCount = 0;
    let autoFeeAssignedCount = 0;

  const getNextStandard = (standard: string) => {
    const map = {
      LKG: 'UKG',
      UKG: 'STD_1',
      STD_1: 'STD_2',
      STD_2: 'STD_3',
      STD_3: 'STD_4',
      STD_4: 'STD_5',
      STD_5: 'STD_6',
      STD_6: 'STD_7',
      STD_7: 'STD_8',
      STD_8: 'STD_9',
      STD_9: 'STD_10',
      STD_10: 'STD_11',
      STD_11: 'STD_12',
      STD_12: 'GRADUATED',
    };

    return map[standard] || standard;
  };

  const isPromotableStandard = (standard: string) => standard !== 'GRADUATED';

  const getEffectivePaid = (payment: { amount: number; status?: string | null; refundAmount?: number | null }) => {
    const status = payment.status || 'SUCCESS';
    if (status === 'CANCELLED') return 0;
    if (status === 'REFUNDED') {
      const refunded = Number(payment.refundAmount ?? payment.amount);
      return Math.max(Number(payment.amount) - refunded, 0);
    }
    return Number(payment.amount);
  };

  const targetStandards = Array.from(new Set(
    students
      .map((student) => getNextStandard(student.standard))
      .filter((standard) => isPromotableStandard(standard)),
  ));

  const structures = await this.prisma.feeStructure.findMany({
    where: {
      academicYear: newAcademicYear,
      standard: { in: targetStandards as Standard[] },
    },
    include: {
      customItems: true,
      terms: { orderBy: { termNumber: 'asc' } },
    },
  });

  const structureByStandard = new Map(structures.map((structure) => [structure.standard, structure]));
  const missingStandards = targetStandards.filter((standard) => !structureByStandard.has(standard as Standard));

  if (missingStandards.length > 0) {
    throw new BadRequestException({
      message: `Promotion blocked. Create fee structures for ${newAcademicYear} before promoting.`,
      code: 'MISSING_FEE_STRUCTURES',
      academicYear: newAcademicYear,
      missingFeeStructures: missingStandards,
    });
  }

  const currentYearFees = await this.prisma.studentFee.findMany({
    where: {
      academicYear,
      studentId: { in: students.map((student) => student.id) },
    },
    include: {
      payments: true,
    },
  });

  // Also fetch fee structures for the OLD academic year so we can flag
  // students whose fees were never assigned (no studentFee record exists)
  const currentYearStandards = Array.from(new Set(students.map((s) => s.standard)));
  const oldYearStructures = await this.prisma.feeStructure.findMany({
    where: {
      academicYear,
      standard: { in: currentYearStandards as Standard[] },
    },
    select: { standard: true, tuitionFee: true, transportFee: true, bookFee: true, hostelFee: true, otherFee: true },
  });
  const oldStructureByStandard = new Map(oldYearStructures.map((s) => [s.standard, s]));

  const feeByStudentId = new Map(currentYearFees.map((fee) => [fee.studentId, fee]));
  const studentsWithPreviousYearPending: Array<{
    studentId: string;
    name: string;
    admissionNo: string | null;
    currentStandard: string;
    promotedToStandard: string;
    previousAcademicYear: string;
    pendingAmount: number;
    feeNotAssigned?: boolean;
  }> = [];

    for (const student of students) {
      const nextStandard = getNextStandard(student.standard);

    const currentYearFee = feeByStudentId.get(student.id);
    if (currentYearFee) {
      const totalPaid = currentYearFee.payments.reduce((sum, payment) => sum + getEffectivePaid(payment), 0);
      const pendingAmount = Math.max(Number(currentYearFee.netFee || 0) - totalPaid, 0);
      if (pendingAmount > 0) {
        studentsWithPreviousYearPending.push({
          studentId: student.id,
          name: student.name,
          admissionNo: student.admission?.admissionNo || null,
          currentStandard: student.standard,
          promotedToStandard: nextStandard,
          previousAcademicYear: academicYear,
          pendingAmount: Math.round(pendingAmount * 100) / 100,
        });
      }
    } else {
      // No fee record assigned — check if a fee structure existed for their standard
      const oldStructure = oldStructureByStandard.get(student.standard as Standard);
      if (oldStructure) {
        const fullFee = Number(oldStructure.tuitionFee || 0)
          + Number(oldStructure.transportFee || 0)
          + Number(oldStructure.bookFee || 0)
          + Number(oldStructure.hostelFee || 0)
          + Number(oldStructure.otherFee || 0);
        if (fullFee > 0) {
          studentsWithPreviousYearPending.push({
            studentId: student.id,
            name: student.name,
            admissionNo: student.admission?.admissionNo || null,
            currentStandard: student.standard,
            promotedToStandard: nextStandard,
            previousAcademicYear: academicYear,
            pendingAmount: Math.round(fullFee * 100) / 100,
            feeNotAssigned: true,
          });
        }
      }
    }

      // Update student standard and academicYear
      await this.prisma.student.update({
        where: { id: student.id },
        data: {
          standard: nextStandard,
          academicYear: newAcademicYear,
        },
      });

      // Update admission record's standard
      await this.prisma.admission.updateMany({
        where: { studentId: student.id },
        data: { standard: nextStandard },
      });

      // Update studentTransport record's academicYear (if exists)
      await this.prisma.studentTransport.updateMany({
        where: { studentId: student.id },
        data: { academicYear: newAcademicYear },
      });

      if (isPromotableStandard(nextStandard)) {
        const existingTargetYearFee = await this.prisma.studentFee.findFirst({
          where: {
            studentId: student.id,
            academicYear: newAcademicYear,
          },
          select: { id: true },
        });

        if (!existingTargetYearFee) {
          const structure = structureByStandard.get(nextStandard as Standard);
          if (!structure) {
            throw new BadRequestException(`Fee structure not found for ${nextStandard} in ${newAcademicYear}`);
          }

          const tuitionFee = Number(structure.tuitionFee || 0);
          const transportFee = Number(structure.transportFee || 0);
          const bookFee = Number(structure.bookFee || 0);
          const hostelFee = Number(structure.hostelFee || 0);
          const otherFee = Number(structure.otherFee || 0);
          const customItems = structure.customItems || [];
          const customTotal = customItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
          const totalFee = tuitionFee + transportFee + bookFee + hostelFee + otherFee + customTotal;

          const splitEvenly = (value: number, count: number) => {
            const perTerm = Math.round((value / count) * 100) / 100;
            return Array.from({ length: count }, (_, index) =>
              index === count - 1
                ? Math.round((value - perTerm * (count - 1)) * 100) / 100
                : perTerm,
            );
          };

          const numberOfTerms = structure.numberOfTerms || 1;
          const tuitionSplit = splitEvenly(tuitionFee, numberOfTerms);
          const transportSplit = splitEvenly(transportFee, numberOfTerms);

          const termTemplates = structure.terms?.length > 0
            ? structure.terms
            : Array.from({ length: numberOfTerms }, (_, index) => ({
                termNumber: index + 1,
                termName: numberOfTerms === 1 ? 'Full Fee' : `Term ${index + 1}`,
                dueDate: null,
              }));

          await this.prisma.studentFee.create({
            data: {
              studentId: student.id,
              academicYear: newAcademicYear,
              tuitionFee,
              transportFee,
              bookFee,
              hostelFee,
              otherFee,
              totalFee,
              discount: 0,
              netFee: totalFee,
              numberOfTerms,
              customItems: customItems.length > 0
                ? {
                    create: customItems.map((item) => ({
                      name: item.name,
                      amount: Number(item.amount || 0),
                    })),
                  }
                : undefined,
              terms: {
                create: termTemplates.map((template, index) => ({
                  termNumber: template.termNumber,
                  termName: template.termName,
                  dueDate: template.dueDate || null,
                  amount: (tuitionSplit[index] || 0) + (transportSplit[index] || 0),
                  tuitionAmount: tuitionSplit[index] || 0,
                  transportAmount: transportSplit[index] || 0,
                  bookAmount: 0,
                  hostelAmount: 0,
                  otherAmount: 0,
                })),
              },
            },
          });

          autoFeeAssignedCount++;
        }
      }

      updatedCount++;
    }

  return {
    updatedCount,
    newAcademicYear,
    autoFeeAssignedCount,
    studentsWithPreviousYearPendingCount: studentsWithPreviousYearPending.length,
    studentsWithPreviousYearPending,
  };
}

  async demoteAllStudents(academicYear: string, newAcademicYear: string) {
  const students = await this.prisma.student.findMany({
    where: { academicYear },
  });

  let updatedCount = 0;

  const getPreviousStandard = (standard: string) => {
    const map = {
      UKG: 'LKG',
      STD_1: 'UKG',
      STD_2: 'STD_1',
      STD_3: 'STD_2',
      STD_4: 'STD_3',
      STD_5: 'STD_4',
      STD_6: 'STD_5',
      STD_7: 'STD_6',
      STD_8: 'STD_7',
      STD_9: 'STD_8',
      STD_10: 'STD_9',
      STD_11: 'STD_10',
      STD_12: 'STD_11',
    };

    return map[standard] || standard;
  };

  for (const student of students) {
    const prevStandard = getPreviousStandard(student.standard);

    await this.prisma.student.update({
      where: { id: student.id },
      data: {
        standard: prevStandard,
        academicYear: newAcademicYear,
      },
    });

    updatedCount++;
  }

  return {
    updatedCount,
    newAcademicYear,
  };
}

  async linkSiblings(studentIds: string[], siblingGroupId?: string) {
    const uniqueIds = [...new Set((studentIds || []).filter(Boolean))];
    if (uniqueIds.length < 2) {
      throw new BadRequestException('At least 2 students are required to create a sibling group');
    }

    const selectedStudents = await this.prisma.student.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, siblingGroupId: true },
    });

    if (selectedStudents.length !== uniqueIds.length) {
      throw new BadRequestException('One or more students not found');
    }

    const existingGroupIds = [...new Set(selectedStudents.map((s) => s.siblingGroupId).filter(Boolean) as string[])];
    const groupId = siblingGroupId || existingGroupIds[0] || `SIB-${Date.now()}`;

    const idsToLink = new Set(uniqueIds);
    if (existingGroupIds.length > 0) {
      const existingGroupMembers = await this.prisma.student.findMany({
        where: { siblingGroupId: { in: existingGroupIds } },
        select: { id: true },
      });
      existingGroupMembers.forEach((member) => idsToLink.add(member.id));
    }

    const mergedIds = [...idsToLink];

    await this.prisma.student.updateMany({
      where: { id: { in: mergedIds } },
      data: { siblingGroupId: groupId },
    });

    const students = await this.prisma.student.findMany({
      where: { id: { in: mergedIds } },
      select: { id: true, name: true, standard: true, siblingGroupId: true },
      orderBy: { name: 'asc' },
    });

    return { siblingGroupId: groupId, students };
  }

  async demoteIndividualStudents(studentIds: string[], reason?: string) {
    const uniqueIds = [...new Set((studentIds || []).filter(Boolean))];
    if (uniqueIds.length === 0) throw new BadRequestException('No student IDs provided');

    const standardOrder = [
      'LKG', 'UKG',
      'STD_1', 'STD_2', 'STD_3', 'STD_4', 'STD_5', 'STD_6',
      'STD_7', 'STD_8', 'STD_9', 'STD_10', 'STD_11', 'STD_12',
    ];

    // Derive the previous academic year string from e.g. "2026-2027" → "2025-2026"
    const getPreviousAcademicYear = (year: string): string | null => {
      const match = year?.match(/^(\d{4})-(\d{4})$/);
      if (!match) return null;
      const start = parseInt(match[1], 10);
      const end = parseInt(match[2], 10);
      return `${start - 1}-${end - 1}`;
    };

    const results: any[] = [];
    for (const sid of uniqueIds) {
      const student = await this.prisma.student.findUnique({
        where: { id: sid },
        select: { id: true, name: true, standard: true, academicYear: true },
      });

      if (!student) {
        results.push({ id: sid, status: 'error', message: 'Student not found' });
        continue;
      }

      const currentStd = student.standard;
      const idx = standardOrder.indexOf(currentStd);

      if (idx <= 0) {
        results.push({ id: sid, name: student.name, status: 'error', message: 'Already at lowest standard' });
        continue;
      }

      const prevStd = standardOrder[idx - 1] as Standard;
      const currentAcademicYear = student.academicYear;
      const prevAcademicYear = currentAcademicYear
        ? getPreviousAcademicYear(currentAcademicYear)
        : null;

      // Update student standard and academic year
      await this.prisma.student.update({
        where: { id: sid },
        data: {
          standard: prevStd,
          ...(prevAcademicYear ? { academicYear: prevAcademicYear } : {}),
        },
      });

      // Update admission record
      await this.prisma.admission.updateMany({
        where: { studentId: sid },
        data: { standard: prevStd },
      });

      // Switch StudentFee active flags (no create/delete — just toggle isActive)
      if (currentAcademicYear) {
        await this.prisma.studentFee.updateMany({
          where: { studentId: sid, academicYear: currentAcademicYear },
          data: { isActive: false },
        });
      }
      if (prevAcademicYear) {
        const prevFee = await this.prisma.studentFee.findFirst({
          where: { studentId: sid, academicYear: prevAcademicYear },
          select: { id: true },
        });
        if (prevFee) {
          await this.prisma.studentFee.updateMany({
            where: { studentId: sid, academicYear: prevAcademicYear },
            data: { isActive: true },
          });
        }
      }

      // Revert StudentTransport to previous academic year (single record per student)
      if (prevAcademicYear) {
        await this.prisma.studentTransport.updateMany({
          where: { studentId: sid },
          data: { academicYear: prevAcademicYear },
        });
      }

      results.push({
        id: sid,
        name: student.name,
        status: 'success',
        from: currentStd,
        to: prevStd,
        academicYearFrom: currentAcademicYear,
        academicYearTo: prevAcademicYear,
      });
    }

    return {
      total: uniqueIds.length,
      successCount: results.filter((r) => r.status === 'success').length,
      results,
    };
  }

  async unlinkSibling(studentId: string) {
    if (!studentId) throw new BadRequestException('Student ID is required');
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new BadRequestException('Student not found');
    
    await this.prisma.student.update({
      where: { id: studentId },
      data: { siblingGroupId: null },
    });

    return { success: true, message: 'Sibling unlinked successfully' };
  }
}