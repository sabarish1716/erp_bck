import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdmissionDto } from './create-admission.dto';

@Injectable()
export class AdmissionService {
  constructor(private prisma: PrismaService) {}

async createAdmission(data: CreateAdmissionDto) {
  const normalizePath = (p: string | undefined | null) =>
    typeof p === 'string' ? p.replace(/\\/g, '/') : '';

  // ✅ Safe fallback
  const docs = data.documents || {};

  return this.prisma.student.create({
    data: {
      name: data.name,
      standard: data.standard || 'Unknown',
      gender: data.gender || 'MALE',
      dob: data.dob ? new Date(data.dob) : new Date(),
      religion: data.religion,
      community: data.community || 'OTHERS',
      caste: data.caste,
      motherTongue: data.motherTongue,
      aadharNo: data.aadharNo,
      bloodGroup: data.bloodGroup,
      identification1: data.identification1,
      identification2: data.identification2,
      previousSchool: data.previousSchool,
      transportMode: data.transportMode,
      rte: data.rte || false,

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

      // ✅ ACADEMICS
      academics:
        data.academics && data.academics.length > 0
          ? {
              create: data.academics.map((acad) => ({
                examName: acad.examName,
                registerNo: acad.registerNo,
                monthYear: acad.monthYear,
                totalPercentage: acad.totalPercentage
                  ? parseFloat(acad.totalPercentage as any)
                  : null,
              })),
            }
          : undefined,

      // ✅ ADMISSION
      admission: data.admission
        ? {
            create: {
              admissionNo: data.admission.admissionNo || 'TBD',
              admissionDate: data.admission.admissionDate
                ? new Date(data.admission.admissionDate)
                : new Date(),
              standard:
                data.admission.standard || data.standard || 'Unknown',
              staffSignature:
                data.admission.staffSignaturePath ||
                data.admission.staffSignature,
              principalSignature:
                data.admission.principalSignaturePath ||
                data.admission.principalSignature,
            },
          }
        : undefined,
    },

    include: {
      family: true,
      address: true,
      documents: true,
      academics: true,
      admission: true,
    },
  });
}

  async getAllStudents() {
    return this.prisma.student.findMany({
      include: {
        family: true,
        address: true,
        admission: true,
        academics: true,
        documents: true,
        users: {
          select: {
            id: true,
isActive: true,         },
        },
      },
    });
  }

  async getStudentById(id: string) {
    return this.prisma.student.findUnique({
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
  }
    async updateStudent(id: string, data: CreateAdmissionDto) {

    // Defensive: check for missing or invalid data
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid update data: expected an object');
    }
    const updateData: any = {
      name: data.name,
      standard: data.standard || 'Unknown',
      gender: data.gender || 'MALE',
      religion: data.religion,
      community: data.community || 'OTHERS',
      caste: data.caste,
      motherTongue: data.motherTongue,
      aadharNo: data.aadharNo,
      bloodGroup: data.bloodGroup,
      identification1: data.identification1,
      identification2: data.identification2,
      previousSchool: data.previousSchool,
      transportMode: data.transportMode,
      rte: typeof data.rte === 'boolean' ? data.rte : false,
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
    photo: data.documents?.profilePhoto?.uploaded ?? false,
    photoPath: normalizePath(data.documents?.profilePhoto?.path) || '',

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
    // Academics update logic can be more complex (delete/create or upsert per item)
    // For simplicity, not updating academics here
    if (data.admission) {
      updateData.admission = {
        upsert: {
          update: {
            admissionNo: data.admission.admissionNo || 'TBD',
            admissionDate: data.admission.admissionDate ? new Date(data.admission.admissionDate) : undefined,
            standard: data.admission.standard || data.standard || 'Unknown',
            staffSignature: data.admission.staffSignaturePath || data.admission.staffSignature,
            principalSignature: data.admission.principalSignaturePath || data.admission.principalSignature,
          },
          create: {
            admissionNo: data.admission.admissionNo || 'TBD',
            admissionDate: data.admission.admissionDate ? new Date(data.admission.admissionDate) : new Date(),
            standard: data.admission.standard || data.standard || 'Unknown',
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
        academics: true,
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
  }