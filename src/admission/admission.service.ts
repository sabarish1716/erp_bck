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

@Injectable()
export class AdmissionService {
  constructor(private prisma: PrismaService) {}

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
    if (lastAdmission?.admissionNo) {
      const parts = lastAdmission.admissionNo.split('/');
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) nextSeq = lastNum + 1;
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
    const results: { row: number; status: string; admissionNo?: string; error?: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const admissionNo = await this.generateAdmissionNo();

        await this.prisma.student.create({
          data: {
            name: row.name || 'Unknown',
            standard: toStandardEnum(row.standard),
            gender: row.gender === 'FEMALE' ? 'FEMALE' : 'MALE',
            dob: row.dob ? new Date(row.dob) : new Date(),
            religion: row.religion || null,
            community: row.community || 'OTHERS',
            caste: row.caste || null,
            motherTongue: row.motherTongue || null,
            aadharNo: row.aadharNo || null,
            bloodGroup: row.bloodGroup || null,
            previousSchool: row.previousSchool || null,
            transportMode: row.transportMode || null,
            rte: row.rte === 'true' || row.rte === true,

            family: row.fatherName || row.motherName ? {
              create: {
                fatherName: row.fatherName || null,
                fatherPhone: row.fatherPhone || null,
                motherName: row.motherName || null,
                motherPhone: row.motherPhone || null,
              },
            } : undefined,

            address: row.address ? {
              create: {
                line1: row.address || 'Pending',
                pin: row.pin || '000000',
              },
            } : undefined,

            admission: {
              create: {
                admissionNo,
                admissionDate: row.admissionDate ? new Date(row.admissionDate) : new Date(),
                standard: toStandardEnum(row.standard),
              },
            },

            users: {
              create: {
                name: row.name || 'Unknown',
                email: row.email || `student_${Date.now()}_${i}@school.local`,
                password: 'defaultpassword',
                role: 'STUDENT',
              },
            },
          },
        });

        results.push({ row: i + 1, status: 'success', admissionNo });
      } catch (err) {
        results.push({ row: i + 1, status: 'error', error: err.message || 'Unknown error' });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    return { total: rows.length, successCount, errorCount, results };
  }

async createAdmission(data: CreateAdmissionDto) {
  const normalizePath = (p: string | undefined | null) =>
    typeof p === 'string' ? p.replace(/\\/g, '/') : '';

  // ✅ Safe fallback
  const docs = data.documents || {};

  return this.prisma.student.create({
    data: {
      name: data.name,
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
      academicStream: data.academicStream ?? null,
      staffParentId: data.staffParentId || null,
      siblingGroupId: data.siblingGroupId || null,

      // ✅ FAMILY
      family: data.family
        ? {
            create: {
              fatherName: data.family.fatherName,
              fatherPhone: data.family.fatherPhone,
              fatherWhatsapp: data.family.fatherWhatsapp,
              fatherAadhar: data.family.fatherAadhar,
              fatherOccupation: data.family.fatherOccupation,

              motherName: data.family.motherName,
              motherPhone: data.family.motherPhone,
              motherWhatsapp: data.family.motherWhatsapp,
              motherAadhar: data.family.motherAadhar,
              motherOccupation: data.family.motherOccupation,

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
              line1: data.address.line1 || 'Pending',
              line2: data.address.line2,
              line3: data.address.line3,
              pin: data.address.pin || '000000',
            },
          }
        : undefined,

      // ✅ DOCUMENTS (FIXED)
      documents: data.documents
        ? {
            create: [
              {
                photo: docs.profilePhoto?.uploaded ?? false,
                photoPath: normalizePath(docs.profilePhoto?.path),

                birthCert: docs.birthCert?.uploaded ?? false,
                birthCertPath: normalizePath(docs.birthCert?.path),

                communityCert: docs.communityCert?.uploaded ?? false,
                communityCertPath: normalizePath(docs.communityCert?.path),

                aadharStudent: docs.aadharStudent?.uploaded ?? false,
                aadharStudentPath: normalizePath(docs.aadharStudent?.path),

                aadharFather: docs.aadharFather?.uploaded ?? false,
                aadharFatherPath: normalizePath(docs.aadharFather?.path),

                aadharMother: docs.aadharMother?.uploaded ?? false,
                aadharMotherPath: normalizePath(docs.aadharMother?.path),

                transferCert: docs.transferCert?.uploaded ?? false,
                transferCertPath: normalizePath(docs.transferCert?.path),
              },
            ],
          }
        : undefined,

      // ✅ ACADEMICS — stores the qualifying examination table (SSLC/MATRIC/CBSE)
      academics:
        data.academics && data.academics.length > 0
          ? {
              create: data.academics.map((acad) => {
                const totals = calcAcademicTotals(acad);
                return {
                  examName: acad.examName,
                  registerNo: acad.registerNo,
                  monthYear: acad.monthYear,
                  totalMaxMarks: totals.totalMaxMarks,
                  totalObtainedMarks: totals.totalObtainedMarks,
                  totalPercentage: totals.totalPercentage,
                  stream: acad.stream || null,
                  subjects: acad.subjects && acad.subjects.length > 0
                    ? {
                        create: acad.subjects.map((s) => ({
                          subjectName: s.subjectName,
                          maxMarks: s.maxMarks,
                          obtainedMarks: s.obtainedMarks,
                          percentage: s.percentage ?? (s.maxMarks > 0 ? parseFloat(((s.obtainedMarks / s.maxMarks) * 100).toFixed(2)) : 0),
                        })),
                      }
                    : undefined,
                };
              }),
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
              admissionFrom: data.admission.admissionFrom
                ? new Date(data.admission.admissionFrom)
                : undefined,  
              admissionTo: data.admission.admissionTo
                ? new Date(data.admission.admissionTo)
                : undefined,
              standard: toStandardEnum(data.admission.standard || data.standard),
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
            name: data.name,
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
    });

    // Group siblings based on siblingGroupId
    const siblingGroups = new Map<string, any[]>();
    students.forEach((s) => {
      if (s.siblingGroupId) {
        if (!siblingGroups.has(s.siblingGroupId)) {
          siblingGroups.set(s.siblingGroupId, []);
        }
        siblingGroups.get(s.siblingGroupId).push({
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
        ? siblingGroups.get(s.siblingGroupId).filter((sib) => sib.id !== s.id)
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
      name: data.name,
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
      academicStream: data.academicStream ?? null,
      staffParentId: data.staffParentId ?? undefined,
      siblingGroupId: data.siblingGroupId ?? undefined,
    };
    if (data.dob) updateData.dob = new Date(data.dob);

    if (data.family) {
      updateData.family = {
        upsert: {
          update: {
            fatherName: data.family.fatherName,
            fatherPhone: data.family.fatherPhone,
            fatherWhatsapp: data.family.fatherWhatsapp,
            fatherAadhar: data.family.fatherAadhar,
            fatherOccupation: data.family.fatherOccupation,
            motherName: data.family.motherName,
            motherPhone: data.family.motherPhone,
            motherWhatsapp: data.family.motherWhatsapp,
            motherAadhar: data.family.motherAadhar,
            motherOccupation: data.family.motherOccupation,
            familyIncome: data.family.familyIncome ? parseFloat(data.family.familyIncome) : null,
            siblings: data.family.siblings,
            hostelRequired: data.family.hostelRequired || false,
          },
          create: {
            fatherName: data.family.fatherName,
            fatherPhone: data.family.fatherPhone,
            fatherWhatsapp: data.family.fatherWhatsapp,
            fatherAadhar: data.family.fatherAadhar,
            fatherOccupation: data.family.fatherOccupation,
            motherName: data.family.motherName,
            motherPhone: data.family.motherPhone,
            motherWhatsapp: data.family.motherWhatsapp,
            motherAadhar: data.family.motherAadhar,
            motherOccupation: data.family.motherOccupation,
            familyIncome: data.family.familyIncome ? parseFloat(data.family.familyIncome) : null,
            siblings: data.family.siblings,
            hostelRequired: data.family.hostelRequired || false,
          },
        },
      };
    }
    if (data.address) {
      updateData.address = {
        upsert: {
          update: {
            line1: data.address.line1 || 'Pending',
            line2: data.address.line2,
            line3: data.address.line3,
            pin: data.address.pin || '000000',
          },
          create: {
            line1: data.address.line1 || 'Pending',
            line2: data.address.line2,
            line3: data.address.line3,
            pin: data.address.pin || '000000',
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

    communityCert: data.documents?.communityCert?.uploaded ?? false,
    communityCertPath: normalizePath(data.documents?.communityCert?.path) || '',

    aadharStudent: data.documents?.aadharStudent?.uploaded ?? false,
    aadharStudentPath: normalizePath(data.documents?.aadharStudent?.path) || '',

    aadharFather: data.documents?.aadharFather?.uploaded ?? false,
    aadharFatherPath: normalizePath(data.documents?.aadharFather?.path) || '',

    aadharMother: data.documents?.aadharMother?.uploaded ?? false,
    aadharMotherPath: normalizePath(data.documents?.aadharMother?.path) || '',

    transferCert: data.documents?.transferCert?.uploaded ?? false,
    transferCertPath: normalizePath(data.documents?.transferCert?.path) || '',
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
        create: data.academics.map((acad) => {
          const totals = calcAcademicTotals(acad);
          return {
            examName: acad.examName,
            registerNo: acad.registerNo,
            monthYear: acad.monthYear,
            totalMaxMarks: totals.totalMaxMarks,
            totalObtainedMarks: totals.totalObtainedMarks,
            totalPercentage: totals.totalPercentage,
            stream: acad.stream || null,
            subjects: acad.subjects && acad.subjects.length > 0
              ? {
                  create: acad.subjects.map((s) => ({
                    subjectName: s.subjectName,
                    maxMarks: s.maxMarks,
                    obtainedMarks: s.obtainedMarks,
                    percentage: s.percentage ?? (s.maxMarks > 0 ? parseFloat(((s.obtainedMarks / s.maxMarks) * 100).toFixed(2)) : 0),
                  })),
                }
              : undefined,
          };
        }),
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

  async getAdmissionDashboard(academicYear?: string) {
    const dateRange = getAcademicYearDateRange(academicYear);
    const where = dateRange
      ? { admissionDate: { gte: dateRange.start, lte: dateRange.end } }
      : undefined;

    const [total, approved, pending, byStandard, seatsConfigRaw] = await Promise.all([
      this.prisma.admission.count({ where }),
      this.prisma.admission.count({ where: { ...(where || {}), isApproved: true } }),
      this.prisma.admission.count({ where: { ...(where || {}), isApproved: false } }),
      this.prisma.admission.groupBy({
        by: ['standard'],
        where,
        _count: { _all: true },
      }),
      this.prisma.appSetting.findUnique({ where: { key: 'admission.standardSeats' } }),
    ]);

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
      .sort()
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

    return {
      academicYear: academicYear || null,
      total,
      approved,
      pending,
      byStandard: byStandard.map((s) => ({ standard: s.standard, count: s._count._all })),
      standardSeats: seatMap,
      seatSummary,
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
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = [
      'Student Name',
      'Admission No',
      'Standard',
      'Academic Year',
      'Approved',
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

  async promoteStudents(fromStandard: string, toStandard: string, academicYear?: string) {
    const from = toStandardEnum(fromStandard);
    const to = toStandardEnum(toStandard);

    if (from === to) {
      throw new BadRequestException('From and To standards cannot be the same');
    }

    // Validate promotion direction (must be upward)
    const standardOrder = [
      'LKG', 'UKG',
      'STD_1', 'STD_2', 'STD_3', 'STD_4', 'STD_5', 'STD_6',
      'STD_7', 'STD_8', 'STD_9', 'STD_10', 'STD_11', 'STD_12',
    ];
    const fromIdx = standardOrder.indexOf(from);
    const toIdx = standardOrder.indexOf(to);
    if (fromIdx >= 0 && toIdx >= 0 && toIdx <= fromIdx) {
      throw new BadRequestException('Promotion must be to a higher standard');
    }

    const dateRange = getAcademicYearDateRange(academicYear);
    const admissionFilter = dateRange
      ? {
          isApproved: true,
          admissionDate: { gte: dateRange.start, lte: dateRange.end },
        }
      : { isApproved: true };

    // Get students being promoted for tracking
    const studentsToPromote = await this.prisma.student.findMany({
      where: {
        standard: from,
        admission: { is: admissionFilter },
      },
      select: { id: true, name: true, standard: true },
    });

    const result = await this.prisma.student.updateMany({
      where: {
        standard: from,
        admission: { is: admissionFilter },
      },
      data: { standard: to },
    });

    await this.prisma.admission.updateMany({
      where: {
        standard: from,
        ...admissionFilter,
      },
      data: { standard: to },
    });

    return {
      fromStandard: from,
      toStandard: to,
      updatedCount: result.count,
      academicYear: academicYear || null,
      promotedStudents: studentsToPromote.map(s => ({ id: s.id, name: s.name })),
    };
  }

  async linkSiblings(studentIds: string[], siblingGroupId?: string) {
    const uniqueIds = [...new Set((studentIds || []).filter(Boolean))];
    if (uniqueIds.length < 2) {
      throw new BadRequestException('At least 2 students are required to create a sibling group');
    }

    const groupId = siblingGroupId || `SIB-${Date.now()}`;

    await this.prisma.student.updateMany({
      where: { id: { in: uniqueIds } },
      data: { siblingGroupId: groupId },
    });

    const students = await this.prisma.student.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, name: true, standard: true, siblingGroupId: true },
      orderBy: { name: 'asc' },
    });

    return { siblingGroupId: groupId, students };
  }
}