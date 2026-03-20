import { PrismaClient, Role, Gender, Community, AcademicStream } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding started...');

  // 🔐 Hash password
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // ✅ 1. Admin User
  const admin = await prisma.user.upsert({
    where: { email: 'admin@school.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@school.com',
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });

  console.log('✅ Admin created:', admin.email);

  // ✅ 2. Create Student with full data
  const student = await prisma.student.create({
    data: {
      name: 'Arun Kumar',
      standard: '10',
      gender: Gender.MALE,
      dob: new Date('2010-05-15'),
      community: Community.BC,

      // 🔗 Create linked User
      users: {
        create: {
          name: 'Arun Kumar',
          email: 'student@school.com',
          password: await bcrypt.hash('student123', 10),
          role: Role.STUDENT,
        },
      },

      // 👨‍👩‍👦 Family
      family: {
        create: {
          fatherName: 'Ravi Kumar',
          fatherPhone: '9876543210',
          motherName: 'Lakshmi',
          motherPhone: '9876543211',
          familyIncome: 250000,
        },
      },

      // 🏠 Address
      address: {
        create: {
          line1: 'No 12, Main Road',
          line2: 'Near Temple',
          pin: '600001',
        },
      },

      // 🎓 Admission
      admission: {
        create: {
          admissionNo: 'ADM2026001',
          admissionDate: new Date(),
          standard: '10',
        },
      },

      // 📄 Documents
      documents: {
        create: [
          {
            photo: true,
            birthCert: true,
            aadharStudent: true,
          },
        ],
      },

      // 📚 Academic Details
      academics: {
        create: [
          {
            examName: 'Quarterly Exam',
            registerNo: 'REG123',
            monthYear: 'Sep 2025',
            totalPercentage: 85.5,
            stream: AcademicStream.CS_MATHS,

            subjects: {
              create: [
                {
                  subjectName: 'Maths',
                  maxMarks: 100,
                  obtainedMarks: 90,
                  percentage: 90,
                },
                {
                  subjectName: 'Science',
                  maxMarks: 100,
                  obtainedMarks: 85,
                  percentage: 85,
                },
              ],
            },
          },
        ],
      },
    },
    include: {
      users: true,
      family: true,
      address: true,
      admission: true,
      academics: {
        include: {
          subjects: true,
        },
      },
    },
  });

  console.log('✅ Student created:', student.name);

  console.log('🌱 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });