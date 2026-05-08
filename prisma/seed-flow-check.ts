import { PrismaClient, Community, DiscountType, Gender, Standard, StaffCategory } from '@prisma/client';

const prisma = new PrismaClient();

const FLOW_PREFIX = 'FLOWCHK';
const YEARS = ['2025-2026', '2026-2027'] as const;

function yearDate(academicYear: string, month: number, day: number) {
  const [start, end] = academicYear.split('-').map(Number);
  const y = month >= 4 ? start : end;
  return new Date(Date.UTC(y, month - 1, day, 8, 0, 0));
}

async function cleanupOldFlowData() {
  const seededAdmissions = await prisma.admission.findMany({
    where: { admissionNo: { startsWith: `${FLOW_PREFIX}/` } },
    select: { studentId: true },
  });

  const seededStudentIds = seededAdmissions.map((a) => a.studentId);
  if (seededStudentIds.length === 0) return;

  await prisma.paymentLink.deleteMany({ where: { studentFee: { studentId: { in: seededStudentIds } } } });
  await prisma.payment.deleteMany({ where: { studentFee: { studentId: { in: seededStudentIds } } } });
  await prisma.discount.deleteMany({ where: { studentFee: { studentId: { in: seededStudentIds } } } });
  await prisma.studentCustomFeeItem.deleteMany({ where: { studentFee: { studentId: { in: seededStudentIds } } } });
  await prisma.studentFeeTerm.deleteMany({ where: { studentFee: { studentId: { in: seededStudentIds } } } });
  await prisma.studentFee.deleteMany({ where: { studentId: { in: seededStudentIds } } });

  await prisma.admission.deleteMany({ where: { studentId: { in: seededStudentIds } } });
  await prisma.family.deleteMany({ where: { studentId: { in: seededStudentIds } } });
  await prisma.address.deleteMany({ where: { studentId: { in: seededStudentIds } } });
  await prisma.user.deleteMany({ where: { studentId: { in: seededStudentIds } } });
  await prisma.student.deleteMany({ where: { id: { in: seededStudentIds } } });
}

async function upsertAcademicYears() {
  for (const year of YEARS) {
    try {
      await prisma.academicYear.upsert({
        where: { year },
        update: {},
        create: { year },
      });
    } catch {
      console.warn('AcademicYear table is not available in current DB. Skipping dedicated academic year rows.');
      return;
    }
  }
}

async function upsertFlowFeeStructure(year: string) {
  const structure = await prisma.feeStructure.upsert({
    where: {
      standard_academicYear: {
        standard: Standard.STD_8,
        academicYear: year,
      },
    },
    update: {
      tuitionFee: 45000,
      transportFee: 9000,
      bookFee: 4000,
      hostelFee: 0,
      otherFee: 2000,
      numberOfTerms: 3,
    },
    create: {
      standard: Standard.STD_8,
      academicYear: year,
      tuitionFee: 45000,
      transportFee: 9000,
      bookFee: 4000,
      hostelFee: 0,
      otherFee: 2000,
      numberOfTerms: 3,
    },
  });

  await prisma.feeTermTemplate.deleteMany({ where: { feeStructureId: structure.id } });
  await prisma.customFeeItem.deleteMany({ where: { feeStructureId: structure.id } });

  await prisma.feeTermTemplate.createMany({
    data: [
      { feeStructureId: structure.id, termNumber: 1, termName: 'Term 1', dueDate: yearDate(year, 7, 10), amount: 18000 },
      { feeStructureId: structure.id, termNumber: 2, termName: 'Term 2', dueDate: yearDate(year, 10, 10), amount: 18000 },
      { feeStructureId: structure.id, termNumber: 3, termName: 'Term 3', dueDate: yearDate(year, 1, 10), amount: 18000 },
    ],
  });

  await prisma.customFeeItem.createMany({
    data: [
      { feeStructureId: structure.id, name: 'Lab Fee', amount: 1500 },
      { feeStructureId: structure.id, name: 'Activity Fee', amount: 1000 },
    ],
  });
}

async function upsertAcademicStreams() {
  const streams = [
    { name: 'BIO_MATHS', label: 'Biology & Mathematics' },
    { name: 'CS_MATHS', label: 'Computer Science & Mathematics' },
    { name: 'BIO_CS', label: 'Biology & Computer Science' },
    { name: 'COMMERCE', label: 'Commerce' },
    { name: 'HUMANITIES', label: 'Humanities' },
  ];

  for (const stream of streams) {
    await prisma.academicStream.upsert({
      where: { name: stream.name },
      update: { label: stream.label },
      create: { name: stream.name, label: stream.label, isCustom: false },
    });
  }
}


async function main() {
  console.log('Seeding flow-check data...');

  await cleanupOldFlowData();
  await upsertAcademicYears();
  await upsertFlowFeeStructure('2026-2027');
  await upsertFlowFeeStructure('2025-2026');
  await upsertAcademicStreams();


  const flowStaff = await prisma.staff.upsert({
    where: { email: 'flowcheck.staff.parent@school.com' },
    update: {
      name: 'Flow Parent Staff',
      category: StaffCategory.TEACHING_REGULAR,
      designation: 'Teacher',
      department: 'Science',
      isActive: true,
    },
    create: {
      employeeId: 'FLOWSTF001',
      name: 'Flow Parent Staff',
      email: 'flowcheck.staff.parent@school.com',
      phone: '9000007711',
      designation: 'Teacher',
      department: 'Science',
      category: StaffCategory.TEACHING_REGULAR,
      isActive: true,
      paymentMode: 'BANK_TRANSFER',
    },
  });

  const arjun = await prisma.student.create({
    data: {
      name: 'Flow Arjun',
      standard: Standard.STD_8,
      section: 'A',
      academicYear: '2026-2027',
      gender: Gender.MALE,
      dob: new Date('2012-08-12T00:00:00.000Z'),
      community: Community.OBC,
      siblingGroupId: 'FLOW-SIB-G1',
      staffParent: { connect: { id: flowStaff.id } },

    },
  });

  const anitha = await prisma.student.create({
    data: {
      name: 'Flow Anitha',
      standard: Standard.STD_6,
      section: 'B',
      academicYear: '2026-2027',
      gender: Gender.FEMALE,
      dob: new Date('2014-04-02T00:00:00.000Z'),
      community: Community.BC,
      siblingGroupId: 'FLOW-SIB-G1',
    },
  });

  const bala = await prisma.student.create({
    data: {
      name: 'Flow Bala',
      standard: Standard.STD_7,
      section: 'C',
      academicYear: '2026-2027',
      gender: Gender.MALE,
      dob: new Date('2013-11-18T00:00:00.000Z'),
      community: Community.MBC,
    },
  });

  await prisma.family.createMany({
    data: [
      { studentId: arjun.id, fatherName: 'Raman', fatherPhone: '9876501001', motherPhone: '9876502001' },
      { studentId: anitha.id, fatherName: 'Raman', fatherPhone: '9876501001', motherPhone: '9876502001' },
      { studentId: bala.id, fatherName: 'Kumar', fatherPhone: '9876503001', motherPhone: '9876504001' },
    ],
  });

  await prisma.address.createMany({
    data: [
      { studentId: arjun.id, line1: 'No 10, Flow Street', line2: 'North Block', line3: 'Chennai', pin: '600001' },
      { studentId: anitha.id, line1: 'No 10, Flow Street', line2: 'North Block', line3: 'Chennai', pin: '600001' },
      { studentId: bala.id, line1: 'No 25, Test Avenue', line2: 'South Block', line3: 'Chennai', pin: '600089' },
    ],
  });

  await prisma.admission.createMany({
    data: [
      {
        studentId: arjun.id,
        admissionNo: `${FLOW_PREFIX}/26-27/0001`,
        admissionDate: yearDate('2026-2027', 6, 5),
        standard: Standard.STD_8,
        isApproved: true,
      },
      {
        studentId: anitha.id,
        admissionNo: `${FLOW_PREFIX}/26-27/0002`,
        admissionDate: yearDate('2026-2027', 6, 5),
        standard: Standard.STD_6,
        isApproved: true,
      },
      {
        studentId: bala.id,
        admissionNo: `${FLOW_PREFIX}/26-27/0003`,
        admissionDate: yearDate('2026-2027', 6, 5),
        standard: Standard.STD_7,
        isApproved: true,
      },
    ],
  });

  const arjunFee = await prisma.studentFee.create({
    data: {
      studentId: arjun.id,
      academicYear: '2026-2027',
      tuitionFee: 45000,
      transportFee: 9000,
      bookFee: 4000,
      hostelFee: 0,
      otherFee: 2000,
      totalFee: 61500,
      discount: 6150,
      netFee: 55350,
      numberOfTerms: 3,
      customItems: {
        create: [{ name: 'Lab Fee', amount: 1500 }],
      },
      terms: {
        create: [
          {
            termNumber: 1,
            termName: 'Term 1',
            amount: 18000,
            dueDate: yearDate('2026-2027', 7, 10),
            status: 'PAID',
            tuitionAmount: 15000,
            transportAmount: 3000,
          },
          {
            termNumber: 2,
            termName: 'Term 2',
            amount: 18000,
            dueDate: yearDate('2026-2027', 10, 10),
            status: 'PARTIAL',
            tuitionAmount: 15000,
            transportAmount: 3000,
          },
          {
            termNumber: 3,
            termName: 'Term 3',
            amount: 18000,
            dueDate: yearDate('2026-2027', 1, 10),
            status: 'PENDING',
            tuitionAmount: 15000,
            transportAmount: 3000,
          },
        ],
      },
    },
  });

  const arjunPrimaryPayment = await prisma.payment.create({
    data: {
      studentFeeId: arjunFee.id,
      amount: 18000,
      paymentMode: 'UPI',
      paymentDate: yearDate('2026-2027', 7, 12),
      receiptNo: 'RCP-0101',
      termNumber: 1,
      status: 'SUCCESS',
      remarks: 'Flow check: full payment term 1',
      receiptComponents: ['transportFee', 'bookFee'],
      paidComponents: { tuition: 15000, transport: 3000 },
    },
  });

  await prisma.payment.create({
    data: {
      studentFeeId: arjunFee.id,
      amount: 6000,
      paymentMode: 'CASH',
      paymentDate: yearDate('2026-2027', 10, 14),
      receiptNo: 'RCP-0102',
      termNumber: 2,
      status: 'REFUNDED',
      refundAmount: 1000,
      statusReason: 'Parent corrected duplicate payment',
      remarks: 'Flow check: refunded partial term 2',
      paidComponents: { tuition: 5000 },
    },
  });

  await prisma.payment.create({
    data: {
      studentFeeId: arjunFee.id,
      amount: 3000,
      paymentMode: 'BANK',
      paymentDate: yearDate('2026-2027', 12, 2),
      receiptNo: 'RCP-0103',
      termNumber: 3,
      status: 'CANCELLED',
      refundAmount: 3000,
      statusReason: 'Cheque bounce',
      remarks: 'Flow check: cancelled term 3 payment',
    },
  });

  await prisma.payment.create({
    data: {
      studentFeeId: arjunFee.id,
      amount: 4000,
      paymentMode: 'CASH',
      paymentDate: yearDate('2026-2027', 8, 2),
      receiptNo: 'RCP-0104',
      status: 'SUCCESS',
      remarks: 'Flow check: non-term fee payment',
      receiptComponents: ['bookFee', 'otherFee', 'customItems'],
      paidComponents: { book: 3000, other: 500, 'Lab Fee': 500 },
    },
  });

  await prisma.discount.create({
    data: {
      studentFeeId: arjunFee.id,
      type: DiscountType.TEACHER_DISCOUNT,
      value: 10,
      reason: 'Parent is school staff',
    },
  });

  await prisma.paymentLink.createMany({
    data: [
      {
        studentFeeId: arjunFee.id,
        amount: 13000,
        phoneNumber: '9876501001',
        channel: 'SMS',
        merchantTransactionId: `${FLOW_PREFIX}-PENDING-001`,
        phonePeUrl: 'https://pay.example/flowchk/pending-001',
        status: 'PENDING',
      },
      {
        studentFeeId: arjunFee.id,
        amount: 18000,
        phoneNumber: '9876501001',
        channel: 'WHATSAPP',
        merchantTransactionId: `${FLOW_PREFIX}-SUCCESS-001`,
        phonePeUrl: 'https://pay.example/flowchk/success-001',
        status: 'SUCCESS',
        paymentId: arjunPrimaryPayment.id,
      },
    ],
  });

  const anithaFeeCurrent = await prisma.studentFee.create({
    data: {
      studentId: anitha.id,
      academicYear: '2026-2027',
      tuitionFee: 42000,
      transportFee: 0,
      bookFee: 3000,
      hostelFee: 0,
      otherFee: 1000,
      totalFee: 46000,
      discount: 2300,
      netFee: 43700,
      numberOfTerms: 3,
      terms: {
        create: [
          {
            termNumber: 1,
            termName: 'Term 1',
            amount: 14000,
            dueDate: yearDate('2026-2027', 7, 10),
            status: 'PENDING',
            tuitionAmount: 14000,
          },
          {
            termNumber: 2,
            termName: 'Term 2',
            amount: 14000,
            dueDate: yearDate('2026-2027', 10, 10),
            status: 'PENDING',
            tuitionAmount: 14000,
          },
          {
            termNumber: 3,
            termName: 'Term 3',
            amount: 14000,
            dueDate: yearDate('2026-2027', 1, 10),
            status: 'PENDING',
            tuitionAmount: 14000,
          },
        ],
      },
    },
  });

  await prisma.discount.create({
    data: {
      studentFeeId: anithaFeeCurrent.id,
      type: DiscountType.SIBLING_DISCOUNT,
      value: 5,
      reason: 'Sibling enrolled in same school',
    },
  });

  await prisma.studentFee.create({
    data: {
      studentId: anitha.id,
      academicYear: '2025-2026',
      tuitionFee: 39000,
      transportFee: 0,
      bookFee: 2500,
      hostelFee: 0,
      otherFee: 1000,
      totalFee: 42500,
      discount: 2125,
      netFee: 40375,
      numberOfTerms: 3,
      terms: {
        create: [
          {
            termNumber: 1,
            termName: 'Term 1',
            amount: 13000,
            dueDate: yearDate('2025-2026', 7, 10),
            status: 'PAID',
            tuitionAmount: 13000,
          },
          {
            termNumber: 2,
            termName: 'Term 2',
            amount: 13000,
            dueDate: yearDate('2025-2026', 10, 10),
            status: 'PAID',
            tuitionAmount: 13000,
          },
          {
            termNumber: 3,
            termName: 'Term 3',
            amount: 13000,
            dueDate: yearDate('2025-2026', 1, 10),
            status: 'PARTIAL',
            tuitionAmount: 13000,
          },
        ],
      },
      payments: {
        create: [
          {
            amount: 13000,
            paymentMode: 'UPI',
            paymentDate: yearDate('2025-2026', 7, 15),
            receiptNo: 'RCP-0091',
            termNumber: 1,
            status: 'SUCCESS',
          },
          {
            amount: 13000,
            paymentMode: 'UPI',
            paymentDate: yearDate('2025-2026', 10, 15),
            receiptNo: 'RCP-0092',
            termNumber: 2,
            status: 'SUCCESS',
          },
          {
            amount: 5000,
            paymentMode: 'CASH',
            paymentDate: yearDate('2025-2026', 1, 20),
            receiptNo: 'RCP-0093',
            termNumber: 3,
            status: 'SUCCESS',
          },
        ],
      },
    },
  });

  const balaFee = await prisma.studentFee.create({
    data: {
      studentId: bala.id,
      academicYear: '2026-2027',
      tuitionFee: 30000,
      transportFee: 6000,
      bookFee: 2000,
      hostelFee: 0,
      otherFee: 0,
      totalFee: 38000,
      discount: 0,
      netFee: 38000,
      numberOfTerms: 3,
      terms: {
        create: [
          {
            termNumber: 1,
            termName: 'Term 1',
            amount: 12000,
            dueDate: yearDate('2026-2027', 7, 10),
            status: 'PAID',
            tuitionAmount: 10000,
            transportAmount: 2000,
          },
          {
            termNumber: 2,
            termName: 'Term 2',
            amount: 12000,
            dueDate: yearDate('2026-2027', 10, 10),
            status: 'PAID',
            tuitionAmount: 10000,
            transportAmount: 2000,
          },
          {
            termNumber: 3,
            termName: 'Term 3',
            amount: 12000,
            dueDate: yearDate('2026-2027', 1, 10),
            status: 'PAID',
            tuitionAmount: 10000,
            transportAmount: 2000,
          },
        ],
      },
      payments: {
        create: [
          {
            amount: 12000,
            paymentMode: 'UPI',
            paymentDate: yearDate('2026-2027', 7, 11),
            receiptNo: 'RCP-0105',
            termNumber: 1,
            status: 'SUCCESS',
          },
          {
            amount: 12000,
            paymentMode: 'UPI',
            paymentDate: yearDate('2026-2027', 10, 11),
            receiptNo: 'RCP-0106',
            termNumber: 2,
            status: 'SUCCESS',
          },
          {
            amount: 12000,
            paymentMode: 'UPI',
            paymentDate: yearDate('2026-2027', 1, 11),
            receiptNo: 'RCP-0107',
            termNumber: 3,
            status: 'SUCCESS',
          },
          {
            amount: 2000,
            paymentMode: 'CASH',
            paymentDate: yearDate('2026-2027', 8, 5),
            receiptNo: 'RCP-0108',
            status: 'SUCCESS',
            remarks: 'Flow check: book fee fully paid',
          },
        ],
      },
    },
  });

  console.log('Flow-check seed completed');
  console.log(`Students seeded: 3 (Arjun: ${arjun.id}, Anitha: ${anitha.id}, Bala: ${bala.id})`);
  console.log(`Student fee IDs: ${arjunFee.id}, ${anithaFeeCurrent.id}, ${balaFee.id}`);
  console.log(`Admission no search samples: ${FLOW_PREFIX}/26-27/0001, ${FLOW_PREFIX}/26-27/0002, ${FLOW_PREFIX}/26-27/0003`);
}

main()
  .catch((error) => {
    console.error('Flow-check seed failed');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
