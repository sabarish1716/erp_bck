import { BadRequestException, Injectable } from '@nestjs/common';
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
    if (num >= 1 && num <= 12) return `STD_${num}` as Standard;
  }
  if (Object.values(Standard).includes(upper as Standard))
    return upper as Standard;
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
    return this.prisma.student.findMany({
      include: { family: true, address: true },
    });
  }

  // Fetch student with siblings (for full bio)
  async findOneWithSiblings(id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: { family: true, address: true },
    });
    if (!student || !student.siblingGroupId) {
      return { ...student, siblings: [] };
    }
    // Get all students with the same siblingGroupId, excluding self
    const siblings = await this.prisma.student.findMany({
      where: { siblingGroupId: student.siblingGroupId, NOT: { id } },
      include: { family: true, address: true },
    });
    return { ...student, siblings };
  }

  async linkMultipleSiblings(id: string, siblingIds: string[]) {
    const targetIds = [
      ...new Set(
        (siblingIds || []).filter(Boolean).filter((sid) => sid !== id),
      ),
    ];
    if (targetIds.length === 0) {
      throw new BadRequestException('At least one sibling is required');
    }

    const uniqueIds = [id, ...targetIds];
    const selectedStudents = await this.prisma.student.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, siblingGroupId: true },
    });

    if (selectedStudents.length !== uniqueIds.length) {
      throw new BadRequestException('One or more students not found');
    }

    const existingGroupIds = [
      ...new Set(
        selectedStudents
          .map((s) => s.siblingGroupId)
          .filter(Boolean) as string[],
      ),
    ];
    const siblingGroupId = existingGroupIds[0] || `SIB-${Date.now()}`;

    const idsToLink = new Set(uniqueIds);
    if (existingGroupIds.length > 0) {
      const existingGroupMembers = await this.prisma.student.findMany({
        where: { siblingGroupId: { in: existingGroupIds } },
        select: { id: true },
      });
      existingGroupMembers.forEach((member) => idsToLink.add(member.id));
    }

    await this.prisma.student.updateMany({
      where: { id: { in: [...idsToLink] } },
      data: { siblingGroupId },
    });

    return this.findOneWithSiblings(id);
  }

  // Backward-compatible single sibling link
  async linkSiblings(id: string, siblingId: string) {
    return this.linkMultipleSiblings(id, [siblingId]);
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

  // Get distinct sections for a given standard and academic year
  async getSectionsByStandard(standard: string, academicYear?: string) {
    const standardEnum = toStandardEnum(standard);

    const students = await this.prisma.student.findMany({
      where: {
        standard: standardEnum,
        academicYear: academicYear || undefined,
      },
      select: { section: true },
      distinct: ['section'],
    });

    const sections = students
      .map((s) => s.section)
      .filter((section): section is string => !!section)
      .sort();

    return { sections: [...new Set(sections)] };
  }

  // Get students by standard and section
  async getStudentsByStandardAndSection(
    standard: string,
    section?: string,
    academicYear?: string,
  ) {
    const standardEnum = toStandardEnum(standard);

    const where: any = {
      standard: standardEnum,
      admission: { isApproved: true },
    };

    if (section) {
      where.section = section;
    }

    if (academicYear) {
      where.academicYear = academicYear;
    }

    const students = await this.prisma.student.findMany({
      where,
      select: {
        id: true,
        name: true,
        standard: true,
        section: true,
        academicYear: true,
      },
      orderBy: { name: 'asc' },
    });

    return students;
  }
}
