import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdmissionService {
  constructor(private prisma: PrismaService) {}

  async createAdmission(data: any) {
    return this.prisma.student.create({
      data: {
        name: data.name,
        standard: data.standard,
        gender: data.gender,
        dob: new Date(data.dob),
        religion: data.religion,
        community: data.community,
        caste: data.caste,
        motherTongue: data.motherTongue,
        aadharNo: data.aadharNo,
        bloodGroup: data.bloodGroup,
        identification1: data.identification1,
        identification2: data.identification2,
        previousSchool: data.previousSchool,
        transportMode: data.transportMode,
        rte: data.rte,

        family: {
          create: {
            fatherName: data.fatherName,
            fatherPhone: data.fatherPhone,
            motherName: data.motherName,
            motherPhone: data.motherPhone,
            familyIncome: data.familyIncome,
            hostelRequired: data.hostelRequired,
          },
        },

        address: {
          create: {
            line1: data.address1,
            line2: data.address2,
            line3: data.address3,
            pin: data.pin,
          },
        },

        documents: {
          create: {
            photo: data.photo,
            birthCert: data.birthCert,
            communityCert: data.communityCert,
            aadharFather: data.aadharFather,
            aadharMother: data.aadharMother,
            aadharStudent: data.aadharStudent,
            transferCert: data.transferCert,
          },
        },

        admission: {
          create: {
            admissionNo: data.admissionNo,
            admissionDate: new Date(),
            standard: data.standard,
            staffSignature: data.staffSignature,
            principalSignature: data.principalSignature, // REQUIRED
          },
        },
      },
      include: {
        family: true,
        address: true,
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
}