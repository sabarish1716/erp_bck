import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto } from './create-student.dto';
import { Standard } from '@prisma/client';

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
  if (Object.values(Standard).includes(upper as Standard)) return upper as Standard;
  return Standard.STD_1;
}

@Injectable()
export class StudentService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateStudentDto) {
    return this.prisma.student.create({
      data: {
        name: data.name,
        standard: toStandardEnum(data.standard),
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
        // family: data.family ? { create: data.family } : undefined,
        // address: data.address ? { create: data.address } : undefined,
      },
      include: { family: true, address: true },
    });
  }

  findAll() {
    return this.prisma.student.findMany({ include: { family: true, address: true } });
  }

  findOne(id: string) {
    return this.prisma.student.findUnique({ where: { id }, include: { family: true, address: true } });
  }

  update(id: string, data: Partial<CreateStudentDto>) {
    // return this.prisma.student.update({
    //   where: { id },
    // //   data: {
    // //     ...data,
    // //     dob: data.dob ? new Date(data.dob) : undefined,
    // //     // family: data.family ? { update: data.family } : undefined,
    // //     // address: data.address ? { update: data.address } : undefined,
    // //   },
    //   include: { family: true, address: true },
    // });
  }

  delete(id: string) {
    return this.prisma.student.delete({ where: { id } });
  }
}
