import {
  PrismaClient,
  Role,
  Gender,
  Community,
  ExamSession,
  Standard,
  DiscountType,
  AttendanceStatus,
  PunchMethod,
  LeaveStatus,
  ItemCategory,
  StaffCategory,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const ACADEMIC_YEARS = ['2025-2026', '2026-2027'] as const;

function parseAcademicYear(academicYear: string) {
  const [start, end] = academicYear.split('-').map((v) => Number(v));
  return { start, end };
}

function dateInAcademicYear(academicYear: string, month: number, day: number) {
  const { start, end } = parseAcademicYear(academicYear);
  const year = month >= 4 ? start : end;
  return new Date(Date.UTC(year, month - 1, day, 8, 0, 0));
}

function admissionNo(schoolCode: string, academicYear: string, sequence: number) {
  return `${schoolCode}/${academicYear}/${String(sequence).padStart(4, '0')}`;
}

function toStandardLabel(standard: Standard) {
  if (standard === Standard.LKG || standard === Standard.UKG) return standard;
  const value = Number(String(standard).replace('STD_', ''));
  const suffix = value === 1 ? 'st' : value === 2 ? 'nd' : value === 3 ? 'rd' : 'th';
  return `${value}${suffix} Standard`;
}

async function resetDatabase() {
  // POS models (child → parent order)
  await prisma.posTransaction.deleteMany();
  await prisma.teacherFreeItem.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.stockTransferItem.deleteMany();
  await prisma.stockTransfer.deleteMany();
  await prisma.storeStock.deleteMany();
  await prisma.storeItem.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.store.deleteMany();

  await prisma.paymentLink.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.discount.deleteMany();
  await prisma.studentCustomFeeItem.deleteMany();
  await prisma.studentFeeTerm.deleteMany();
  await prisma.studentFee.deleteMany();

  await prisma.customFeeItem.deleteMany();
  await prisma.feeTermTemplate.deleteMany();
  await prisma.feeStructure.deleteMany();

  await prisma.location.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.bus.deleteMany();

  await prisma.studentTransport.deleteMany();
  await prisma.transportStop.deleteMany();
  await prisma.transportRoute.deleteMany();

  await prisma.attendance.deleteMany();
  await prisma.leaveApplication.deleteMany();
  await prisma.permissionRequest.deleteMany();
  await prisma.staffAdvance.deleteMany();
  await prisma.payroll.deleteMany();
  await prisma.staffStatutory.deleteMany();
  await prisma.eSSLStaffMapping.deleteMany();
  await prisma.eSSLPunchLog.deleteMany();
  await prisma.eSSLSyncHistory.deleteMany();
  await prisma.eSSLDevice.deleteMany();
  await prisma.leaveBalance.deleteMany();
  await prisma.leaveType.deleteMany();
  await prisma.statutorySettings.deleteMany();

  await prisma.examSeatAllocation.deleteMany();
  await prisma.examScheduleHall.deleteMany();
  await prisma.examSchedule.deleteMany();
  await prisma.examRollNumber.deleteMany();
  await prisma.examSubject.deleteMany();
  await prisma.examHall.deleteMany();
  await prisma.exam.deleteMany();

  await prisma.subjectMark.deleteMany();
  await prisma.academicDetail.deleteMany();
  await prisma.document.deleteMany();
  await prisma.docRequest.deleteMany();
  await prisma.admission.deleteMany();
  await prisma.family.deleteMany();
  await prisma.address.deleteMany();

  await prisma.user.deleteMany();
  await prisma.student.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.appSetting.deleteMany();
}

async function main() {
  console.log('🌱 Seeding started...');

  await resetDatabase();

  const adminPassword = await bcrypt.hash('admin123', 10);
  const staffPassword = await bcrypt.hash('staff123', 10);
  const studentPassword = await bcrypt.hash('student123', 10);

  const admin = await prisma.user.create({
    data: {
      name: 'Super Admin',
      email: 'admin@school.com',
      password: adminPassword,
      role: Role.ADMIN,
    },
  });

  const principal = await prisma.user.create({
    data: {
      name: 'Principal Priya',
      email: 'principal@school.com',
      password: adminPassword,
      role: Role.PRINCIPAL,
    },
  });

  const schoolCode = 'PSF';
  await prisma.appSetting.create({
    data: {
      key: 'admin.settings',
      value: {
        schoolName: 'PSF Matriculation Higher Secondary School',
        schoolCode,
        academicYear: ACADEMIC_YEARS[1],
        requireApprovalForAdmission: false,
        allowAdmissionEditAfterApproval: false,
        enableFeesModule: true,
        enableTransportModule: true,
        enableStaffModule: true,
        admissionNoAutoGenerate: true,
      },
      updatedByEmail: admin.email,
    },
  });

  await prisma.appSetting.create({
    data: {
      key: 'admission.standardSeats',
      value: {
        STD_8: 90,
        STD_9: 90,
        STD_10: 90,
        STD_11: 80,
        STD_12: 80,
      },
      updatedByEmail: admin.email,
    },
  });

  const staffRecords = await Promise.all([
    // ── TEACHING REGULAR (4) ──
    prisma.staff.create({
      data: {
        employeeId: 'EMP0001',
        name: 'Raghavan Iyer',
        email: 'raghavan.staff@school.com',
        phone: '9000000001',
        designation: 'HOD',
        department: 'Mathematics',
        otherQualifications: 'M.Sc., B.Ed.',
        joiningDate: new Date('2020-06-10T00:00:00.000Z'),
        salary: 65000,
        category: StaffCategory.TEACHING_REGULAR,
        paymentMode: 'BANK_TRANSFER',
        bankName: 'Indian Bank',
        bankAccountNo: '6543210001',
        bankIfsc: 'IDIB000C001',
        pfJoiningDate: new Date('2020-06-10T00:00:00.000Z'),
      },
    }),
    prisma.staff.create({
      data: {
        employeeId: 'EMP0002',
        name: 'Meena Ravi',
        email: 'meena.staff@school.com',
        phone: '9000000002',
        designation: 'Teacher',
        department: 'Science',
        otherQualifications: 'M.Sc., B.Ed.',
        joiningDate: new Date('2021-06-15T00:00:00.000Z'),
        salary: 54000,
        category: StaffCategory.TEACHING_REGULAR,
        paymentMode: 'BANK_TRANSFER',
        bankName: 'SBI',
        bankAccountNo: '6543210002',
        bankIfsc: 'SBIN0001234',
        pfJoiningDate: new Date('2021-06-15T00:00:00.000Z'),
      },
    }),
    prisma.staff.create({
      data: {
        employeeId: 'EMP0004',
        name: 'Lakshmi Narayanan',
        email: 'lakshmi.staff@school.com',
        phone: '9000000004',
        designation: 'Teacher',
        department: 'English',
        otherQualifications: 'M.A., B.Ed.',
        joiningDate: new Date('2019-06-01T00:00:00.000Z'),
        salary: 58000,
        category: StaffCategory.TEACHING_REGULAR,
        paymentMode: 'BANK_TRANSFER',
        bankName: 'IOB',
        bankAccountNo: '6543210004',
        bankIfsc: 'IOBA0000123',
        pfJoiningDate: new Date('2019-06-01T00:00:00.000Z'),
      },
    }),
    prisma.staff.create({
      data: {
        employeeId: 'EMP0005',
        name: 'Srinivasan K',
        email: 'srinivasan.staff@school.com',
        phone: '9000000005',
        designation: 'Teacher',
        department: 'Tamil',
        otherQualifications: 'M.A., B.Ed.',
        joiningDate: new Date('2018-07-01T00:00:00.000Z'),
        salary: 62000,
        category: StaffCategory.TEACHING_REGULAR,
        paymentMode: 'BANK_TRANSFER',
        bankName: 'Canara Bank',
        bankAccountNo: '6543210005',
        bankIfsc: 'CNRB0001234',
        pfJoiningDate: new Date('2018-07-01T00:00:00.000Z'),
      },
    }),
    // ── TEACHING TRAINEE (3) ──
    prisma.staff.create({
      data: {
        employeeId: 'EMP0006',
        name: 'Priya Dharshini',
        email: 'priya.staff@school.com',
        phone: '9000000006',
        designation: 'Trainee Teacher',
        department: 'Mathematics',
        otherQualifications: 'B.Sc., B.Ed.',
        joiningDate: new Date('2025-06-15T00:00:00.000Z'),
        salary: 22000,
        category: StaffCategory.TEACHING_TRAINEE,
        paymentMode: 'CASH',
      },
    }),
    prisma.staff.create({
      data: {
        employeeId: 'EMP0007',
        name: 'Arun Kumar M',
        email: 'arun.staff@school.com',
        phone: '9000000007',
        designation: 'Trainee Teacher',
        department: 'Science',
        otherQualifications: 'B.Sc., B.Ed.',
        joiningDate: new Date('2025-07-01T00:00:00.000Z'),
        salary: 20000,
        category: StaffCategory.TEACHING_TRAINEE,
        paymentMode: 'CASH',
      },
    }),
    prisma.staff.create({
      data: {
        employeeId: 'EMP0008',
        name: 'Divya S',
        email: 'divya.staff@school.com',
        phone: '9000000008',
        designation: 'Trainee Teacher',
        department: 'Social Science',
        otherQualifications: 'B.A., B.Ed.',
        joiningDate: new Date('2025-09-01T00:00:00.000Z'),
        salary: 18000,
        category: StaffCategory.TEACHING_TRAINEE,
        paymentMode: 'BANK_TRANSFER',
        bankName: 'SBI',
        bankAccountNo: '6543210008',
        bankIfsc: 'SBIN0005678',
      },
    }),
    // ── NON-TEACHING REGULAR (3) ──
    prisma.staff.create({
      data: {
        employeeId: 'EMP0003',
        name: 'Karthik Raj',
        email: 'karthik.staff@school.com',
        phone: '9000000003',
        designation: 'Clerk',
        department: 'Administration',
        otherQualifications: 'B.Com',
        joiningDate: new Date('2022-01-10T00:00:00.000Z'),
        salary: 32000,
        category: StaffCategory.NON_TEACHING_REGULAR,
        paymentMode: 'BANK_TRANSFER',
        bankName: 'Indian Bank',
        bankAccountNo: '6543210003',
        bankIfsc: 'IDIB000C002',
        pfJoiningDate: new Date('2022-01-10T00:00:00.000Z'),
      },
    }),
    prisma.staff.create({
      data: {
        employeeId: 'EMP0009',
        name: 'Murugan P',
        email: 'murugan.staff@school.com',
        phone: '9000000009',
        designation: 'Lab Assistant',
        department: 'Science',
        otherQualifications: 'B.Sc.',
        joiningDate: new Date('2021-08-10T00:00:00.000Z'),
        salary: 28000,
        category: StaffCategory.NON_TEACHING_REGULAR,
        paymentMode: 'BANK_TRANSFER',
        bankName: 'BOB',
        bankAccountNo: '6543210009',
        bankIfsc: 'BARB0001234',
        pfJoiningDate: new Date('2021-08-10T00:00:00.000Z'),
      },
    }),
    prisma.staff.create({
      data: {
        employeeId: 'EMP0010',
        name: 'Selvi R',
        email: 'selvi.staff@school.com',
        phone: '9000000010',
        designation: 'Office Admin',
        department: 'Administration',
        otherQualifications: 'B.Com',
        joiningDate: new Date('2020-03-01T00:00:00.000Z'),
        salary: 35000,
        category: StaffCategory.NON_TEACHING_REGULAR,
        paymentMode: 'BANK_TRANSFER',
        bankName: 'SBI',
        bankAccountNo: '6543210010',
        bankIfsc: 'SBIN0009876',
        pfJoiningDate: new Date('2020-03-01T00:00:00.000Z'),
      },
    }),
    // ── NON-TEACHING TRAINEE (2) ──
    prisma.staff.create({
      data: {
        employeeId: 'EMP0011',
        name: 'Vignesh K',
        email: 'vignesh.staff@school.com',
        phone: '9000000011',
        designation: 'Trainee Clerk',
        department: 'Administration',
        otherQualifications: 'B.Com',
        joiningDate: new Date('2025-11-01T00:00:00.000Z'),
        salary: 15000,
        category: StaffCategory.NON_TEACHING_TRAINEE,
        paymentMode: 'CASH',
      },
    }),
    prisma.staff.create({
      data: {
        employeeId: 'EMP0012',
        name: 'Nandhini M',
        email: 'nandhini.staff@school.com',
        phone: '9000000012',
        designation: 'Trainee Lab Asst',
        department: 'Science',
        otherQualifications: 'B.Sc.',
        joiningDate: new Date('2026-01-15T00:00:00.000Z'),
        salary: 14000,
        category: StaffCategory.NON_TEACHING_TRAINEE,
        paymentMode: 'CASH',
      },
    }),
    prisma.staff.create({
      data: {
        employeeId: 'EMP0013',
        name: 'Harini V',
        email: 'harini.staff@school.com',
        phone: '9000000013',
        designation: 'Accountant',
        department: 'Accounts',
        otherQualifications: 'B.Com., M.Com.',
        joiningDate: new Date('2026-02-10T00:00:00.000Z'),
        salary: 30000,
        category: StaffCategory.NON_TEACHING_REGULAR,
        paymentMode: 'BANK_TRANSFER',
        bankName: 'Indian Overseas Bank',
        bankAccountNo: '6543210013',
        bankIfsc: 'IOBA0000456',
        pfJoiningDate: new Date('2026-02-10T00:00:00.000Z'),
      },
    }),
    // ── TEACHING PART-TIME (2) ──
    prisma.staff.create({
      data: {
        employeeId: 'EMP0014',
        name: 'Kavitha Suresh',
        email: 'kavitha.staff@school.com',
        phone: '9000000014',
        designation: 'Part-time Teacher',
        department: 'Mathematics',
        otherQualifications: 'B.Sc., B.Ed.',
        joiningDate: new Date('2026-01-01T00:00:00.000Z'),
        salary: 15000,
        category: StaffCategory.TEACHING_PART_TIME,
        paymentMode: 'CASH',
      },
    }),
    prisma.staff.create({
      data: {
        employeeId: 'EMP0015',
        name: 'Ramesh Babu',
        email: 'ramesh.staff@school.com',
        phone: '9000000015',
        designation: 'Part-time Teacher',
        department: 'Arts',
        otherQualifications: 'B.A.',
        joiningDate: new Date('2026-02-01T00:00:00.000Z'),
        salary: 12000,
        category: StaffCategory.TEACHING_PART_TIME,
        paymentMode: 'CASH',
      },
    }),
    // ── NON-TEACHING SECURITY (2) – daily rate ₹400/day ──
    prisma.staff.create({
      data: {
        employeeId: 'EMP0016',
        name: 'Selvam G',
        email: 'selvam.staff@school.com',
        phone: '9000000016',
        designation: 'Security Guard',
        department: 'Security',
        otherQualifications: 'SSLC',
        joiningDate: new Date('2025-06-01T00:00:00.000Z'),
        salary: 10400,  // 400 × 26 working days
        category: StaffCategory.NON_TEACHING_SECURITY,
        paymentMode: 'CASH',
      },
    }),
    prisma.staff.create({
      data: {
        employeeId: 'EMP0017',
        name: 'Pandian R',
        email: 'pandian.staff@school.com',
        phone: '9000000017',
        designation: 'Security Guard',
        department: 'Security',
        otherQualifications: 'SSLC',
        joiningDate: new Date('2025-08-01T00:00:00.000Z'),
        salary: 10400,
        category: StaffCategory.NON_TEACHING_SECURITY,
        paymentMode: 'CASH',
      },
    }),
    // ── NON-TEACHING SPORTS (2) – daily rate ₹1500/day ──
    prisma.staff.create({
      data: {
        employeeId: 'EMP0018',
        name: 'Dinesh Kumar',
        email: 'dinesh.staff@school.com',
        phone: '9000000018',
        designation: 'Sports Coach',
        department: 'Sports',
        otherQualifications: 'B.P.Ed.',
        joiningDate: new Date('2025-07-01T00:00:00.000Z'),
        salary: 39000,  // 1500 × 26 working days
        category: StaffCategory.NON_TEACHING_SPORTS,
        paymentMode: 'BANK_TRANSFER',
        bankName: 'SBI',
        bankAccountNo: '6543210018',
        bankIfsc: 'SBIN0001111',
        pfJoiningDate: new Date('2025-07-01T00:00:00.000Z'),
      },
    }),
    prisma.staff.create({
      data: {
        employeeId: 'EMP0019',
        name: 'Anitha Priya',
        email: 'anitha.staff@school.com',
        phone: '9000000019',
        designation: 'Sports Coach',
        department: 'Sports',
        otherQualifications: 'M.P.Ed.',
        joiningDate: new Date('2025-09-01T00:00:00.000Z'),
        salary: 39000,
        category: StaffCategory.NON_TEACHING_SPORTS,
        paymentMode: 'BANK_TRANSFER',
        bankName: 'Canara Bank',
        bankAccountNo: '6543210019',
        bankIfsc: 'CNRB0002222',
        pfJoiningDate: new Date('2025-09-01T00:00:00.000Z'),
      },
    }),
    // ── NON-TEACHING ACTING DRIVER (2) – daily rate configurable ──
    prisma.staff.create({
      data: {
        employeeId: 'EMP0020',
        name: 'Rajesh Kumar',
        email: 'rajesh.actingdriver@school.com',
        phone: '9000000020',
        designation: 'Acting Driver',
        department: 'Transport',
        otherQualifications: 'HSC',
        joiningDate: new Date('2026-01-05T00:00:00.000Z'),
        salary: 23400, // fallback = 900 x 26
        category: StaffCategory.NON_TEACHING_ACTING_DRIVER,
        paymentMode: 'BANK_TRANSFER',
        bankName: 'Indian Bank',
        bankAccountNo: '6543210020',
        bankIfsc: 'IDIB000C020',
      },
    }),
    prisma.staff.create({
      data: {
        employeeId: 'EMP0021',
        name: 'Prabhu N',
        email: 'prabhu.actingdriver@school.com',
        phone: '9000000021',
        designation: 'Acting Driver',
        department: 'Transport',
        otherQualifications: 'SSLC',
        joiningDate: new Date('2026-02-01T00:00:00.000Z'),
        salary: 22100, // fallback = 850 x 26
        category: StaffCategory.NON_TEACHING_ACTING_DRIVER,
        paymentMode: 'CASH',
      },
    }),
  ]);

  for (const staff of staffRecords) {
    await prisma.user.create({
      data: {
        name: staff.name,
        email: staff.email || '',
        password: staffPassword,
        role: Role.STAFF,
      },
    });
  }

  const statutorySettings = await prisma.statutorySettings.create({
    data: {
      pfEnabled: true,
      pfEmployeeRate: 12,
      pfEmployerRate: 12,
      pfWageLimit: 15000,
      pfAdminCharges: 0.5,
      pfEdliCharges: 0.5,
      esiEnabled: true,
      esiEmployeeRate: 0.75,
      esiEmployerRate: 3.25,
      esiWageLimit: 21000,
      esiDailyWageThreshold: 176,
      ptEnabled: true,
      ptAmount: 200,
      // Salary structure (Gross = Basic 50% + HRA 30% + Travel 0% + Other 0%)
      basicRate: 50,
      hraRate: 30,
      travelAllowanceRate: 0,
      otherAllowanceRate: 0,
      clLapseMonths: 3,
    },
  });

  const leaveTypes = await Promise.all([
    prisma.leaveType.create({
      data: { name: 'Casual Leave', code: 'CL', maxPerYear: 12, carryForward: false },
    }),
    prisma.leaveType.create({
      data: { name: 'Sick Leave', code: 'SL', maxPerYear: 10, carryForward: true },
    }),
    prisma.leaveType.create({
      data: { name: 'Earned Leave', code: 'EL', maxPerYear: 15, carryForward: true },
    }),
    prisma.leaveType.create({
      data: { name: 'Maternity Leave', code: 'ML', maxPerYear: 180, carryForward: false },
    }),
    prisma.leaveType.create({
      data: { name: 'Paternity Leave', code: 'PL', maxPerYear: 15, carryForward: false },
    }),
    prisma.leaveType.create({
      data: { name: 'Loss of Pay', code: 'LOP', maxPerYear: 999, carryForward: false },
    }),
  ]);

  for (const staff of staffRecords) {
    const isTrainee = ([StaffCategory.TEACHING_TRAINEE, StaffCategory.NON_TEACHING_TRAINEE] as StaffCategory[]).includes(staff.category);
    const isPartTime = staff.category === StaffCategory.TEACHING_PART_TIME;
    const isDailyRateStaff = ([
      StaffCategory.NON_TEACHING_SECURITY,
      StaffCategory.NON_TEACHING_SPORTS,
      StaffCategory.NON_TEACHING_ACTING_DRIVER,
    ] as StaffCategory[]).includes(staff.category);
    // One part-time teacher (EMP0015) is on stipend — no PF/ESI
    const isStipend = staff.employeeId === 'EMP0015';
    const dailyRate = staff.category === StaffCategory.NON_TEACHING_SECURITY ? 400
      : staff.category === StaffCategory.NON_TEACHING_SPORTS ? 1500
      : staff.category === StaffCategory.NON_TEACHING_ACTING_DRIVER
        ? (staff.employeeId === 'EMP0020' ? 900 : 850)
      : undefined;
    // Gross for daily-rate staff = 26 working days × daily rate; others = salary
    const grossForStatutory = isDailyRateStaff ? 26 * (dailyRate ?? 0) : (staff.salary || 0);
    const basicForStatutory = Math.round(grossForStatutory * 0.5);
    await prisma.staffStatutory.create({
      data: {
        staffId: staff.id,
        pfNumber: (isTrainee || isPartTime) ? null : `PF-${staff.employeeId}`,
        uanNumber: (isTrainee || isPartTime) ? null : `10001000${staff.employeeId.slice(-2)}`,
        esiNumber: (isTrainee || isPartTime) ? null : `ESI-${staff.employeeId}`,
        pfEnabled: !isTrainee && !isStipend,
        esiEnabled: !isTrainee && !isStipend && grossForStatutory <= 21000,
        isStipend,
        ...(dailyRate !== undefined && { dailyRate }),
        basicSalary: basicForStatutory,
        grossSalary: grossForStatutory,
      },
    });

    for (const year of ACADEMIC_YEARS) {
      for (const leaveType of leaveTypes) {
        await prisma.leaveBalance.create({
          data: {
            staffId: staff.id,
            leaveTypeId: leaveType.id,
            year,
            total: leaveType.maxPerYear,
            used: leaveType.code === 'CL' && year === '2026-2027' ? 2 : 1,
            remaining: leaveType.maxPerYear - (leaveType.code === 'CL' && year === '2026-2027' ? 2 : 1),
          },
        });
      }
    }
  }

  const esslDevice = await prisma.eSSLDevice.create({
    data: {
      name: 'Main Gate Device',
      ipAddress: '192.168.1.50',
      port: 4370,
      serialNumber: 'ESSL-0001',
      deviceType: 'fingerprint',
      location: 'Main Block',
      isOnline: true,
      lastSyncAt: new Date(),
    },
  });

  for (let i = 0; i < 2; i += 1) {
    await prisma.eSSLStaffMapping.create({
      data: {
        staffId: staffRecords[i].id,
        deviceId: esslDevice.id,
        deviceUserId: `DU${String(i + 1).padStart(3, '0')}`,
      },
    });
  }

  for (const staff of staffRecords) {
    await prisma.attendance.create({
      data: {
        staffId: staff.id,
        date: new Date('2026-08-01T00:00:00.000Z'),
        status: AttendanceStatus.PRESENT,
        checkIn: '09:00',
        checkOut: '16:45',
        punchMethod: PunchMethod.FINGERPRINT,
        workingHours: 7.75,
        isESSLSync: true,
      },
    });
    await prisma.attendance.create({
      data: {
        staffId: staff.id,
        date: new Date('2026-08-02T00:00:00.000Z'),
        status: staff.designation === 'Clerk' ? AttendanceStatus.LATE : AttendanceStatus.PRESENT,
        checkIn: staff.designation === 'Clerk' ? '09:20' : '08:55',
        checkOut: '16:40',
        punchMethod: PunchMethod.MANUAL,
        workingHours: 7.2,
      },
    });
  }

  const lastMonthStaff = staffRecords.find((staff) => staff.employeeId === 'EMP0013');
  if (lastMonthStaff) {
    await prisma.attendance.createMany({
      data: [
        {
          staffId: lastMonthStaff.id,
          date: new Date('2026-03-03T00:00:00.000Z'),
          status: AttendanceStatus.PRESENT,
          checkIn: '08:58',
          checkOut: '17:10',
          punchMethod: PunchMethod.FINGERPRINT,
          workingHours: 8,
          isESSLSync: true,
        },
        {
          staffId: lastMonthStaff.id,
          date: new Date('2026-03-04T00:00:00.000Z'),
          status: AttendanceStatus.LATE,
          checkIn: '09:18',
          checkOut: '17:06',
          punchMethod: PunchMethod.MANUAL,
          workingHours: 7.5,
        },
        {
          staffId: lastMonthStaff.id,
          date: new Date('2026-03-05T00:00:00.000Z'),
          status: AttendanceStatus.PRESENT,
          checkIn: '08:54',
          checkOut: '17:14',
          punchMethod: PunchMethod.FINGERPRINT,
          workingHours: 8.1,
          isESSLSync: true,
        },
        {
          staffId: lastMonthStaff.id,
          date: new Date('2026-03-06T00:00:00.000Z'),
          status: AttendanceStatus.HALF_DAY,
          checkIn: '09:02',
          checkOut: '13:05',
          punchMethod: PunchMethod.MANUAL,
          workingHours: 4,
        },
      ],
    });
  }

  const actingDriver1 = staffRecords.find((staff) => staff.employeeId === 'EMP0020');
  const actingDriver2 = staffRecords.find((staff) => staff.employeeId === 'EMP0021');

  if (actingDriver1 && actingDriver2) {
    await prisma.attendance.createMany({
      data: [
        {
          staffId: actingDriver1.id,
          date: new Date('2026-04-03T00:00:00.000Z'),
          status: AttendanceStatus.PRESENT,
          checkIn: '08:45',
          checkOut: '17:20',
          punchMethod: PunchMethod.MANUAL,
          workingHours: 8.5,
        },
        {
          staffId: actingDriver1.id,
          date: new Date('2026-04-04T00:00:00.000Z'),
          status: AttendanceStatus.HALF_DAY,
          checkIn: '08:55',
          checkOut: '13:00',
          punchMethod: PunchMethod.MANUAL,
          workingHours: 4,
        },
        {
          staffId: actingDriver1.id,
          date: new Date('2026-04-05T00:00:00.000Z'),
          status: AttendanceStatus.PRESENT,
          checkIn: '08:50',
          checkOut: '17:10',
          punchMethod: PunchMethod.FINGERPRINT,
          workingHours: 8.2,
          isESSLSync: true,
        },
        {
          staffId: actingDriver2.id,
          date: new Date('2026-04-03T00:00:00.000Z'),
          status: AttendanceStatus.PRESENT,
          checkIn: '08:48',
          checkOut: '17:05',
          punchMethod: PunchMethod.MANUAL,
          workingHours: 8,
        },
        {
          staffId: actingDriver2.id,
          date: new Date('2026-04-04T00:00:00.000Z'),
          status: AttendanceStatus.ABSENT,
          punchMethod: PunchMethod.MANUAL,
          workingHours: 0,
          remarks: 'Unavailable for replacement duty',
        },
        {
          staffId: actingDriver2.id,
          date: new Date('2026-04-05T00:00:00.000Z'),
          status: AttendanceStatus.PRESENT,
          checkIn: '08:52',
          checkOut: '17:18',
          punchMethod: PunchMethod.FINGERPRINT,
          workingHours: 8.3,
          isESSLSync: true,
        },
      ],
    });
  }

  await prisma.leaveApplication.create({
    data: {
      staffId: staffRecords[1].id,
      leaveTypeId: leaveTypes[1].id,
      fromDate: new Date('2026-09-10T00:00:00.000Z'),
      toDate: new Date('2026-09-11T00:00:00.000Z'),
      days: 2,
      reason: 'Medical rest',
      status: LeaveStatus.APPROVED,
      approvedBy: principal.email,
    },
  });

  await prisma.leaveApplication.create({
    data: {
      staffId: staffRecords[2].id,
      leaveTypeId: leaveTypes[0].id,
      fromDate: new Date('2026-10-05T00:00:00.000Z'),
      toDate: new Date('2026-10-05T00:00:00.000Z'),
      days: 1,
      halfDay: true,
      reason: 'Personal work',
      status: LeaveStatus.PENDING,
    },
  });

  await prisma.permissionRequest.create({
    data: {
      staffId: staffRecords[0].id,
      date: new Date('2026-09-20T00:00:00.000Z'),
      fromTime: '13:00',
      toTime: '15:00',
      hours: 2,
      reason: 'Bank visit',
      status: LeaveStatus.APPROVED,
      approvedBy: principal.email,
    },
  });

  await prisma.permissionRequest.create({
    data: {
      staffId: staffRecords[1].id,
      date: new Date('2026-09-21T00:00:00.000Z'),
      fromTime: '11:00',
      toTime: '12:00',
      hours: 1,
      reason: 'Medical consultation',
      status: LeaveStatus.PENDING,
    },
  });

  // ═══════════════════════════════════════════════
  // PAYROLL – March 2026 (approved) + April 2026 (generated — current month)
  // ═══════════════════════════════════════════════
  // ── Payroll rate constants from statutory settings ──
  const BASIC_RATE   = statutorySettings.basicRate / 100;          // 0.50
  const HRA_RATE     = statutorySettings.hraRate / 100;            // 0.30
  const PF_EMP_RATE  = statutorySettings.pfEmployeeRate / 100;     // 0.12
  const PF_EMP_ER_RATE = statutorySettings.pfEmployerRate / 100;   // 0.12
  const PF_WAGE_LIM  = statutorySettings.pfWageLimit;              // 15000
  const ESI_EMP_RATE = statutorySettings.esiEmployeeRate / 100;    // 0.0075
  const ESI_EMP_ER_RATE = statutorySettings.esiEmployerRate / 100; // 0.0325
  const ESI_WAGE_LIM = statutorySettings.esiWageLimit;             // 21000
  const ESI_DAILY_TH = statutorySettings.esiDailyWageThreshold;    // 176
  const PT_AMT       = statutorySettings.ptAmount;                 // 200

  for (const month of ['2026-03', '2026-04']) {
    for (const staff of staffRecords) {
      const isTraineePay  = ([StaffCategory.TEACHING_TRAINEE, StaffCategory.NON_TEACHING_TRAINEE] as StaffCategory[]).includes(staff.category);
      const isPartTimePay = staff.category === StaffCategory.TEACHING_PART_TIME;
      const isDailyRatePay = ([
        StaffCategory.NON_TEACHING_SECURITY,
        StaffCategory.NON_TEACHING_SPORTS,
        StaffCategory.NON_TEACHING_ACTING_DRIVER,
      ] as StaffCategory[]).includes(staff.category);
      const isStipendPay  = staff.employeeId === 'EMP0015';

      // LOP: part-time teachers and daily-rate staff have no LOP concept
      const lopDays = (isPartTimePay || isDailyRatePay) ? 0
        : month === '2026-04' ? ((staff.salary || 0) > 50000 ? 0 : 1) : 1;

      const totalWorkingDays = 26;
      const presentDays = totalWorkingDays - lopDays;

      // Gross: daily-rate staff = presentDays × rate; others = fixed salary
      const dailyRateVal = staff.category === StaffCategory.NON_TEACHING_SECURITY ? 400
        : staff.category === StaffCategory.NON_TEACHING_SPORTS ? 1500
          : staff.category === StaffCategory.NON_TEACHING_ACTING_DRIVER
            ? (staff.employeeId === 'EMP0020' ? 900 : 850)
            : 0;
      const gross = isDailyRatePay ? presentDays * dailyRateVal : (staff.salary || 0);

      // Earnings breakdown
      const basic        = Math.round(gross * BASIC_RATE);   // 50%
      const hra          = Math.round(gross * HRA_RATE);     // 30%
      const da           = 0;                                // legacy, always 0
      const otherAllows  = 0;                                // configurable, default 0
      const lopDed       = isDailyRatePay ? 0 : Math.round(gross / totalWorkingDays * lopDays);

      // PF: on Basic (50% of gross), capped at pfWageLimit
      const hasPF     = !isTraineePay && !isStipendPay && !!staff.pfJoiningDate;
      const pfBase    = basic;
      const pfWage    = Math.min(pfBase, PF_WAGE_LIM);
      const empPF     = hasPF ? Math.round(pfWage * PF_EMP_RATE) : 0;
      const empErPF   = hasPF ? Math.round(pfWage * PF_EMP_ER_RATE) : 0;

      // ESI: on Basic+HRA (~80% of gross), skip if daily wage < threshold
      const esiBase      = basic + hra;   // ~80% of gross
      const dailyEsiWage = Math.round(esiBase / 30);
      const esiApplicable = hasPF && dailyEsiWage >= ESI_DAILY_TH && esiBase <= ESI_WAGE_LIM;
      const empESI    = esiApplicable ? Math.round(esiBase * ESI_EMP_RATE) : 0;
      const empErESI  = esiApplicable ? Math.round(esiBase * ESI_EMP_ER_RATE) : 0;

      // PT only for regular permanent staff with PF
      const pt = hasPF ? PT_AMT : 0;

      // CTC = Gross + Employer PF + Employer ESI
      const ctc = gross + empErPF + empErESI;

      // Advance deductions (0 in seed baseline — actual deductions handled in service)
      const fixedAdv = 0;
      const salAdv   = 0;
      const otherAdv = 0;

      // Extra allowance for trainees in April
      const extra = isTraineePay && month === '2026-04' ? 500 : 0;

      const totalDed = empPF + empESI + pt + lopDed + fixedAdv + salAdv + otherAdv;
      const net = gross + extra - totalDed;

      await prisma.payroll.create({
        data: {
          staffId: staff.id,
          month,
          basicSalary: basic,
          hra,
          da,
          travelAllowance: 0,
          otherAllowances: otherAllows,
          grossSalary: gross,
          totalWorkingDays,
          presentDays,
          lopDays,
          lopDeduction: lopDed,
          lopCancelled: false,
          permissionHoursUsed: month === '2026-04' ? 3 : 2,
          permissionLopDays: 0,
          permissionLopDeduction: 0,
          pfBase,
          esiBase,
          pfDeduction: empPF,
          esiDeduction: empESI,
          ptDeduction: pt,
          employerPfContribution: empErPF,
          employerEsiContribution: empErESI,
          ctc,
          fixedAdvanceDeduction: fixedAdv,
          salaryAdvanceDeduction: salAdv,
          otherAdvanceDeduction: otherAdv,
          extraAllowance: extra,
          bonusIncentive: 0,
          totalDeductions: totalDed,
          netSalary: net,
          status: month === '2026-03' ? 'approved' : 'generated',
        },
      });
    }
  }

  // ═══════════════════════════════════════════════
  // ADVANCE / LOAN TICKETS  (various statuses)
  // ═══════════════════════════════════════════════
  const advances = [
    // Raghavan – Fixed advance, fully repaid & CLOSED
    {
      ticketNo: 'ADV-2026-00001',
      staffId: staffRecords[0].id,
      type: 'FIXED_ADVANCE',
      amount: 10000,
      reason: 'Festival advance',
      monthlyDeduction: 2500,
      totalRepaid: 10000,
      balanceRemaining: 0,
      status: 'CLOSED',
      requestedAt: new Date('2025-12-01'),
      approvedByEmail: 'admin@school.com',
      approvedAt: new Date('2025-12-02'),
      disbursedAt: new Date('2025-12-03'),
      closedAt: new Date('2026-03-03'),
    },
    // Meena – Salary advance, currently REPAYING
    {
      ticketNo: 'ADV-2026-00002',
      staffId: staffRecords[1].id,
      type: 'SALARY_ADVANCE',
      amount: 25000,
      reason: 'Medical emergency',
      monthlyDeduction: 5000,
      totalRepaid: 10000,
      balanceRemaining: 15000,
      status: 'REPAYING',
      requestedAt: new Date('2026-01-10'),
      approvedByEmail: 'admin@school.com',
      approvedAt: new Date('2026-01-11'),
      disbursedAt: new Date('2026-01-12'),
    },
    // Lakshmi – Fixed advance, DISBURSED (not yet started deduction)
    {
      ticketNo: 'ADV-2026-00003',
      staffId: staffRecords[2].id,
      type: 'FIXED_ADVANCE',
      amount: 8000,
      reason: 'Personal loan',
      monthlyDeduction: 2000,
      totalRepaid: 0,
      balanceRemaining: 8000,
      status: 'DISBURSED',
      requestedAt: new Date('2026-03-20'),
      approvedByEmail: 'admin@school.com',
      approvedAt: new Date('2026-03-21'),
      disbursedAt: new Date('2026-03-28'),
    },
    // Karthik (NT Regular) – Other advance, APPROVED (not yet disbursed)
    {
      ticketNo: 'ADV-2026-00004',
      staffId: staffRecords[7].id,
      type: 'OTHER_ADVANCE',
      amount: 5000,
      reason: 'Uniform allowance',
      monthlyDeduction: 1000,
      totalRepaid: 0,
      balanceRemaining: 5000,
      status: 'APPROVED',
      requestedAt: new Date('2026-03-25'),
      approvedByEmail: 'admin@school.com',
      approvedAt: new Date('2026-03-26'),
    },
    // Priya (Teaching Trainee) – Salary advance, REQUESTED (pending approval)
    {
      ticketNo: 'ADV-2026-00005',
      staffId: staffRecords[4].id,
      type: 'SALARY_ADVANCE',
      amount: 10000,
      reason: 'House rent deposit',
      monthlyDeduction: 2500,
      totalRepaid: 0,
      balanceRemaining: 10000,
      status: 'REQUESTED',
      requestedAt: new Date('2026-04-01'),
    },
    // Srinivasan – Fixed advance, REJECTED
    {
      ticketNo: 'ADV-2026-00006',
      staffId: staffRecords[3].id,
      type: 'FIXED_ADVANCE',
      amount: 50000,
      reason: 'Vehicle purchase',
      monthlyDeduction: 5000,
      totalRepaid: 0,
      balanceRemaining: 50000,
      status: 'REJECTED',
      requestedAt: new Date('2026-02-15'),
      rejectedByEmail: 'admin@school.com',
      rejectedAt: new Date('2026-02-16'),
      rejectionReason: 'Amount exceeds policy limit',
    },
    // Murugan (NT Regular) – Salary advance, REPAYING
    {
      ticketNo: 'ADV-2026-00007',
      staffId: staffRecords[8].id,
      type: 'SALARY_ADVANCE',
      amount: 15000,
      reason: 'Child school fees',
      monthlyDeduction: 3000,
      totalRepaid: 6000,
      balanceRemaining: 9000,
      status: 'REPAYING',
      requestedAt: new Date('2026-01-05'),
      approvedByEmail: 'admin@school.com',
      approvedAt: new Date('2026-01-06'),
      disbursedAt: new Date('2026-01-07'),
    },
    // Selvi (NT Regular) – Other advance, REQUESTED
    {
      ticketNo: 'ADV-2026-00008',
      staffId: staffRecords[9].id,
      type: 'OTHER_ADVANCE',
      amount: 3000,
      reason: 'Travel reimbursement advance',
      monthlyDeduction: 1500,
      totalRepaid: 0,
      balanceRemaining: 3000,
      status: 'REQUESTED',
      requestedAt: new Date('2026-04-02'),
    },
  ];

  for (const adv of advances) {
    await prisma.staffAdvance.create({ data: adv });
  }

  // ── More attendance for April 2026 (first 2 days) ──
  const aprilDates = [new Date('2026-04-01T00:00:00.000Z'), new Date('2026-04-02T00:00:00.000Z')];
  for (const staff of staffRecords) {
    for (let d = 0; d < aprilDates.length; d++) {
      const isLate = staff.designation.includes('Trainee') && d === 0;
      await prisma.attendance.create({
        data: {
          staffId: staff.id,
          date: aprilDates[d],
          status: isLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT,
          checkIn: isLate ? '09:18' : '08:55',
          checkOut: '16:40',
          punchMethod: d === 0 ? PunchMethod.FINGERPRINT : PunchMethod.MANUAL,
          workingHours: isLate ? 7.0 : 7.75,
          isESSLSync: d === 0,
          remarks: isLate ? 'Late arrival' : undefined,
        },
      });
    }
  }

  // ── Leave applications for April ──
  await prisma.leaveApplication.create({
    data: {
      staffId: staffRecords[4].id, // Priya
      leaveTypeId: leaveTypes[0].id,
      fromDate: new Date('2026-04-07T00:00:00.000Z'),
      toDate: new Date('2026-04-07T00:00:00.000Z'),
      days: 1,
      reason: 'Family function',
      status: LeaveStatus.PENDING,
    },
  });
  await prisma.leaveApplication.create({
    data: {
      staffId: staffRecords[8].id, // Murugan
      leaveTypeId: leaveTypes[1].id,
      fromDate: new Date('2026-04-03T00:00:00.000Z'),
      toDate: new Date('2026-04-04T00:00:00.000Z'),
      days: 2,
      reason: 'Fever and cold',
      status: LeaveStatus.APPROVED,
      approvedBy: principal.email,
    },
  });

  // ── Permission requests for April ──
  await prisma.permissionRequest.create({
    data: {
      staffId: staffRecords[3].id, // Srinivasan
      date: new Date('2026-04-02T00:00:00.000Z'),
      fromTime: '14:00',
      toTime: '16:00',
      hours: 2,
      reason: 'Bank work',
      status: LeaveStatus.APPROVED,
      approvedBy: principal.email,
    },
  });
  await prisma.permissionRequest.create({
    data: {
      staffId: staffRecords[5].id, // Arun Kumar
      date: new Date('2026-04-01T00:00:00.000Z'),
      fromTime: '10:00',
      toTime: '11:30',
      hours: 1.5,
      reason: 'Apartment maintenance meeting',
      status: LeaveStatus.PENDING,
    },
  });

  console.log('✅ HR module seeded: 19 staff (7 categories: teaching-regular/trainee/part-time, non-teaching-regular/trainee/security/sports), payroll Mar+Apr 2026 with new PF/ESI/CTC formula, 8 advance tickets, attendance, leaves, permissions');

  await prisma.eSSLPunchLog.createMany({
    data: [
      {
        deviceId: esslDevice.id,
        staffId: staffRecords[0].id,
        employeeId: staffRecords[0].employeeId,
        punchTime: new Date('2026-08-01T03:25:00.000Z'),
        punchType: 'IN',
        punchMethod: PunchMethod.FINGERPRINT,
      },
      {
        deviceId: esslDevice.id,
        staffId: staffRecords[0].id,
        employeeId: staffRecords[0].employeeId,
        punchTime: new Date('2026-08-01T11:10:00.000Z'),
        punchType: 'OUT',
        punchMethod: PunchMethod.FINGERPRINT,
      },
      {
        deviceId: esslDevice.id,
        staffId: staffRecords[1].id,
        employeeId: staffRecords[1].employeeId,
        punchTime: new Date('2026-08-01T03:35:00.000Z'),
        punchType: 'IN',
        punchMethod: PunchMethod.FACE,
      },
    ],
  });

  await prisma.eSSLSyncHistory.create({
    data: {
      deviceId: esslDevice.id,
      status: 'success',
      recordsCount: 3,
      syncedAt: new Date(),
    },
  });

  const routeA = await prisma.transportRoute.create({
    data: {
      routeName: 'Route A - Velachery',
      routeNo: 'R-A1',
      baseFee: 12000,
      splClassFee: 1500,
      description: 'Southern corridor route',
      stops: {
        create: [
          { stopName: 'Velachery Bus Stand', stopOrder: 1, distanceKm: 2.5, pickupTime: '07:20', dropTime: '16:25', fee: 11000 },
          { stopName: 'Taramani Signal', stopOrder: 2, distanceKm: 5.2, pickupTime: '07:35', dropTime: '16:10', fee: 12000 },
          { stopName: 'Thiruvanmiyur Depot', stopOrder: 3, distanceKm: 7.1, pickupTime: '07:50', dropTime: '15:55', fee: 13000 },
        ],
      },
    },
    include: { stops: true },
  });

  const routeB = await prisma.transportRoute.create({
    data: {
      routeName: 'Route B - Tambaram',
      routeNo: 'R-B1',
      baseFee: 10000,
      splClassFee: 1200,
      description: 'Western corridor route',
      stops: {
        create: [
          { stopName: 'Tambaram East', stopOrder: 1, distanceKm: 3.1, pickupTime: '07:10', dropTime: '16:35', fee: 9800 },
          { stopName: 'Chromepet Market', stopOrder: 2, distanceKm: 5.8, pickupTime: '07:25', dropTime: '16:20', fee: 10400 },
          { stopName: 'Pallavaram Signal', stopOrder: 3, distanceKm: 7.5, pickupTime: '07:40', dropTime: '16:05', fee: 11200 },
        ],
      },
    },
    include: { stops: true },
  });

  const busA = await prisma.bus.create({
    data: {
      number: 'TN-01-AB-1234',
      routeName: routeA.routeName,
      routeId: routeA.id,
      capacity: 45,
    },
  });

  const busB = await prisma.bus.create({
    data: {
      number: 'TN-01-AB-2345',
      routeName: routeB.routeName,
      routeId: routeB.id,
      capacity: 40,
    },
  });

  const driverA = await prisma.driver.create({
    data: {
      name: 'Driver Anand',
      email: 'driver.anand@school.com',
      phone: '9001001001',
      deviceId: 'DRV-A1',
      busId: busA.id,
    },
  });

  const driverB = await prisma.driver.create({
    data: {
      name: 'Driver Baskar',
      email: 'driver.baskar@school.com',
      phone: '9001001002',
      deviceId: 'DRV-B1',
      busId: busB.id,
    },
  });

  await prisma.location.createMany({
    data: [
      {
        driverId: driverA.id,
        busId: busA.id,
        latitude: 12.9784,
        longitude: 80.2202,
        speed: 32,
        createdAt: new Date('2026-08-01T02:00:00.000Z'),
      },
      {
        driverId: driverA.id,
        busId: busA.id,
        latitude: 12.9821,
        longitude: 80.2287,
        speed: 28,
        createdAt: new Date('2026-08-01T02:05:00.000Z'),
      },
      {
        driverId: driverB.id,
        busId: busB.id,
        latitude: 12.9245,
        longitude: 80.1213,
        speed: 35,
        createdAt: new Date('2026-08-01T02:00:00.000Z'),
      },
      {
        driverId: driverB.id,
        busId: busB.id,
        latitude: 12.9314,
        longitude: 80.1372,
        speed: 30,
        createdAt: new Date('2026-08-01T02:05:00.000Z'),
      },
    ],
  });

  const studentBlueprints = [
    {
      name: 'Arun Kumar',
      standard: Standard.STD_10,
      gender: Gender.MALE,
      community: Community.BC,
      academicYear: '2025-2026',
      transportMode: 'VAN',
      stream: 'CS_MATHS',

      email: 'arun.kumar@student.com',
      father: 'Ravi Kumar',
      mother: 'Lakshmi Ravi',
      admissionIndex: 1,
      siblingsGroup: 'SIB-1001',
    },
    {
      name: 'Anita Kumar',
      standard: Standard.STD_8,
      gender: Gender.FEMALE,
      community: Community.BC,
      academicYear: '2025-2026',
      transportMode: 'VAN',
      stream: null,
      email: 'anita.kumar@student.com',
      father: 'Ravi Kumar',
      mother: 'Lakshmi Ravi',
      admissionIndex: 2,
      siblingsGroup: 'SIB-1001',
    },
    {
      name: 'Rahul Mehta',
      standard: Standard.STD_9,
      gender: Gender.MALE,
      community: Community.MBC,
      academicYear: '2025-2026',
      transportMode: 'LOCAL',
      stream: null,
      email: 'rahul.mehta@student.com',
      father: 'Mohan Mehta',
      mother: 'Geetha Mehta',
      admissionIndex: 3,
      siblingsGroup: null,
    },
    {
      name: 'Sneha Devi',
      standard: Standard.STD_11,
      gender: Gender.FEMALE,
      community: Community.SC,
      academicYear: '2025-2026',
      transportMode: 'VAN',
      stream: 'BIO_MATHS',

      email: 'sneha.devi@student.com',
      father: 'Devan',
      mother: 'Uma Devi',
      admissionIndex: 4,
      siblingsGroup: null,
    },
    {
      name: 'Kiran Raj',
      standard: Standard.STD_10,
      gender: Gender.MALE,
      community: Community.OBC,
      academicYear: '2026-2027',
      transportMode: 'VAN',
      stream: 'CS_MATHS',

      email: 'kiran.raj@student.com',
      father: 'Rajesh',
      mother: 'Priya Rajesh',
      admissionIndex: 1,
      siblingsGroup: null,
    },
    {
      name: 'Divya Raj',
      standard: Standard.STD_9,
      gender: Gender.FEMALE,
      community: Community.OBC,
      academicYear: '2026-2027',
      transportMode: 'VAN',
      stream: null,
      email: 'divya.raj@student.com',
      father: 'Rajesh',
      mother: 'Priya Rajesh',
      admissionIndex: 2,
      siblingsGroup: null,
    },
    {
      name: 'Pranav S',
      standard: Standard.STD_8,
      gender: Gender.MALE,
      community: Community.ST,
      academicYear: '2026-2027',
      transportMode: 'LOCAL',
      stream: null,
      email: 'pranav.s@student.com',
      father: 'Suresh',
      mother: 'Kala Suresh',
      admissionIndex: 3,
      siblingsGroup: null,
    },
    {
      name: 'Nisha Paul',
      standard: Standard.STD_12,
      gender: Gender.FEMALE,
      community: Community.BC,
      academicYear: '2026-2027',
      transportMode: 'VAN',
      stream: 'COMMERCE',

      email: 'nisha.paul@student.com',
      father: 'Paulraj',
      mother: 'Mary Paul',
      admissionIndex: 4,
      siblingsGroup: null,
    },
  ] as const;

  const students: Array<{ id: string; name: string; standard: Standard; academicYear: string; staffParentId?: string | null; transportMode?: string | null }> = [];

  for (const blueprint of studentBlueprints) {
    const student = await prisma.student.create({
      data: {
        name: blueprint.name,
        standard: blueprint.standard,
        gender: blueprint.gender,
        dob: new Date(`${blueprint.academicYear.startsWith('2025') ? 2010 : 2011}-06-15T00:00:00.000Z`),
        religion: 'Hindu',
        community: blueprint.community,
        caste: 'General',
        motherTongue: 'Tamil',
        aadharNo: `1234123412${Math.floor(Math.random() * 90 + 10)}`,
        bloodGroup: 'B+',
        identification1: 'Mole on chin',
        previousSchool: 'City Public School',
        transportMode: blueprint.transportMode,
        rte: blueprint.community === Community.SC || blueprint.community === Community.ST,
        academicStream: blueprint.stream ? { connect: { name: blueprint.stream } } : undefined,



        staffParent: blueprint.name === 'Divya Raj' ? { connect: { id: staffRecords[0].id } } : undefined,

        siblingGroupId: blueprint.siblingsGroup,

        users: {
          create: {
            name: blueprint.name,
            email: blueprint.email,
            password: studentPassword,
            role: Role.STUDENT,
          },
        },

        family: {
          create: {
            fatherName: blueprint.father,
            fatherPhone: `91${Math.floor(7000000000 + Math.random() * 2000000000)}`,
            motherName: blueprint.mother,
            motherPhone: `91${Math.floor(7000000000 + Math.random() * 2000000000)}`,
            familyIncome: blueprint.community === Community.ST ? 180000 : 320000,
            hostelRequired: false,
          },
        },

        address: {
          create: {
            line1: `No ${10 + blueprint.admissionIndex}, Lake View Street`,
            line2: 'Near Bus Stop',
            pin: '600001',
          },
        },

        documents: {
          create: [{
            photo: true,
            birthCert: true,
            communityCert: blueprint.community === Community.SC || blueprint.community === Community.ST,
            aadharStudent: true,
            aadharFather: true,
            aadharMother: true,
            transferCert: true,
          }],
        },

        academics: {
          create: [{
            examName: 'Annual Exam',
            registerNo: `REG-${blueprint.academicYear.slice(2, 4)}-${blueprint.admissionIndex}`,
            monthYear: 'March',
            totalMaxMarks: 500,
            totalObtainedMarks: 390 + blueprint.admissionIndex * 10,
            totalPercentage: Number(((390 + blueprint.admissionIndex * 10) / 5).toFixed(2)),
            stream: blueprint.stream ? ({ connect: { name: blueprint.stream } } as any) : undefined,



            subjects: {
              create: [
                { subjectName: 'Mathematics', maxMarks: 100, obtainedMarks: 82 + blueprint.admissionIndex, percentage: 82 + blueprint.admissionIndex },
                { subjectName: 'Science', maxMarks: 100, obtainedMarks: 78 + blueprint.admissionIndex, percentage: 78 + blueprint.admissionIndex },
                { subjectName: 'English', maxMarks: 100, obtainedMarks: 80 + blueprint.admissionIndex, percentage: 80 + blueprint.admissionIndex },
              ],
            },
          }],
        },

        admission: {
          create: {
            admissionNo: admissionNo(schoolCode, blueprint.academicYear, blueprint.admissionIndex),
            admissionDate: dateInAcademicYear(blueprint.academicYear, 6, 10 + blueprint.admissionIndex),
            standard: blueprint.standard,
            isApproved: true,
            approvedAt: dateInAcademicYear(blueprint.academicYear, 6, 15 + blueprint.admissionIndex),
            approvedByRole: Role.PRINCIPAL,
            approvedByEmail: principal.email,
            approvalNote: 'Approved during seed setup',
          },
        },
      },
      select: {
        id: true,
        name: true,
        standard: true,
        transportMode: true,
      },
    });

    students.push({
      id: student.id,
      name: student.name,
      standard: student.standard,
      academicYear: blueprint.academicYear,
      staffParentId: blueprint.name === 'Divya Raj' ? staffRecords[0].id : null,
      transportMode: student.transportMode,
    });
  }

  const feeStructures = new Map<string, { id: string; totalTemplate: number }>();
  const structureStandards = [Standard.STD_8, Standard.STD_9, Standard.STD_10, Standard.STD_11, Standard.STD_12];

  for (const year of ACADEMIC_YEARS) {
    for (const standard of structureStandards) {
      const tuitionFee = standard === Standard.STD_11 || standard === Standard.STD_12 ? 62000 : 52000;
      const transportFee = 11000;
      const bookFee = 5000;
      const hostelFee = 0;
      const otherFee = 2500;
      const totalTemplate = tuitionFee + transportFee + bookFee + hostelFee + otherFee;

      const structure = await prisma.feeStructure.create({
        data: {
          standard,
          academicYear: year,
          tuitionFee,
          transportFee,
          bookFee,
          hostelFee,
          otherFee,
          numberOfTerms: 3,
          customItems: {
            create: [
              { name: 'Lab Fee', amount: 2000 },
              { name: 'Sports Fee', amount: 1500 },
            ],
          },
          terms: {
            create: [
              { termNumber: 1, termName: 'Term 1', dueDate: dateInAcademicYear(year, 7, 10), amount: Number((totalTemplate / 3).toFixed(2)) },
              { termNumber: 2, termName: 'Term 2', dueDate: dateInAcademicYear(year, 10, 10), amount: Number((totalTemplate / 3).toFixed(2)) },
              { termNumber: 3, termName: 'Term 3', dueDate: dateInAcademicYear(year, 1, 10), amount: Number((totalTemplate / 3).toFixed(2)) },
            ],
          },
        },
      });

      feeStructures.set(`${year}-${standard}`, { id: structure.id, totalTemplate });
    }
  }

  const routeAFirstStop = routeA.stops.sort((a, b) => a.stopOrder - b.stopOrder)[0];
  const routeBFirstStop = routeB.stops.sort((a, b) => a.stopOrder - b.stopOrder)[0];

  for (const student of students) {
    const structureMeta = feeStructures.get(`${student.academicYear}-${student.standard}`);
    if (!structureMeta) continue;

    const transportAssigned = student.transportMode?.toUpperCase() === 'VAN';
    const transportFee = transportAssigned ? 11000 : 0;
    const tuitionFee = student.standard === Standard.STD_11 || student.standard === Standard.STD_12 ? 62000 : 52000;
    const bookFee = 5000;
    const otherFee = 2500;
    const totalFee = tuitionFee + transportFee + bookFee + otherFee;

    let discountAmount = 0;
    let discountType: DiscountType | null = null;
    let discountReason = '';

    if (student.staffParentId) {
      discountAmount = 5000;
      discountType = DiscountType.TEACHER_DISCOUNT;
      discountReason = 'Staff ward concession';
    } else if (student.name.includes('Kumar')) {
      discountAmount = 3000;
      discountType = DiscountType.SIBLING_DISCOUNT;
      discountReason = 'Sibling concession';
    }

    const netFee = totalFee - discountAmount;
    const termAmount = Number((netFee / 3).toFixed(2));

    const fee = await prisma.studentFee.create({
      data: {
        studentId: student.id,
        academicYear: student.academicYear,
        tuitionFee,
        transportFee,
        bookFee,
        hostelFee: 0,
        otherFee,
        totalFee,
        discount: discountAmount,
        netFee,
        numberOfTerms: 3,
        customItems: {
          create: [
            { name: 'Lab Fee', amount: 2000 },
          ],
        },
        terms: {
          create: [
            { termNumber: 1, termName: 'Term 1', amount: termAmount, dueDate: dateInAcademicYear(student.academicYear, 7, 10), status: 'PAID' },
            { termNumber: 2, termName: 'Term 2', amount: termAmount, dueDate: dateInAcademicYear(student.academicYear, 10, 10), status: 'PARTIAL' },
            { termNumber: 3, termName: 'Term 3', amount: termAmount, dueDate: dateInAcademicYear(student.academicYear, 1, 10), status: 'PENDING' },
          ],
        },
        payments: {
          create: [
            {
              amount: termAmount,
              paymentDate: dateInAcademicYear(student.academicYear, 7, 12),
              paymentMode: 'UPI',
              receiptNo: `RCP-${student.academicYear.slice(2, 4)}-${student.name.split(' ')[0].toUpperCase()}`,
              termNumber: 1,
              status: 'SUCCESS',
              remarks: 'Seed full payment term 1',
              receiptComponents: {
                tuitionFee: tuitionFee / 3,
                transportFee: transportFee / 3,
                bookFee: bookFee / 3,
                otherFee: otherFee / 3,
              },
            },
            {
              amount: Number((termAmount * 0.4).toFixed(2)),
              paymentDate: dateInAcademicYear(student.academicYear, 10, 15),
              paymentMode: 'CASH',
              receiptNo: null,
              termNumber: 2,
              status: 'SUCCESS',
              remarks: 'Seed partial payment term 2',
            },
          ],
        },
      },
    });

    if (discountType) {
      await prisma.discount.create({
        data: {
          studentFeeId: fee.id,
          type: discountType,
          value: discountAmount,
          reason: discountReason,
        },
      });
    }

    if (student.academicYear === '2026-2027') {
      await prisma.paymentLink.create({
        data: {
          studentFeeId: fee.id,
          amount: Number((termAmount * 0.6).toFixed(2)),
          phoneNumber: '919000001111',
          channel: 'WHATSAPP',
          merchantTransactionId: `MTXN-${student.name.replace(/\s+/g, '').toUpperCase()}-${student.academicYear}`,
          phonePeUrl: `https://pay.example.com/${fee.id}`,
          status: 'PENDING',
        },
      });
    }
  }

  const studentsToAssignTransport = students.filter(
    (student) => student.academicYear === '2026-2027' && String(student.transportMode || '').toUpperCase() === 'VAN',
  );

  for (let i = 0; i < studentsToAssignTransport.length; i += 1) {
    const student = studentsToAssignTransport[i];
    const useRouteA = i % 2 === 0;
    await prisma.studentTransport.create({
      data: {
        studentId: student.id,
        routeId: useRouteA ? routeA.id : routeB.id,
        stopId: useRouteA ? routeAFirstStop.id : routeBFirstStop.id,
        academicYear: '2026-2027',
        isSplClass: i === 0,
      },
    });
  }

  // ═══════════════════════════════════════════════
  // EXAM / SUBJECT / HALL / TIMETABLE / ROLL / SEAT
  // ═══════════════════════════════════════════════
  const annualExam = await prisma.exam.create({
    data: {
      name: 'Annual Examination 2026-2027',
      code: 'ANNUAL-26-27',
      academicYear: '2026-2027',
      startDate: new Date('2027-03-10T00:00:00.000Z'),
      endDate: new Date('2027-03-20T00:00:00.000Z'),
      status: 'PUBLISHED',
    },
  });

  const examStandard = Standard.STD_10;

  const [subMath10A, subSci10A] = await Promise.all([
    prisma.examSubject.create({
      data: {
        examId: annualExam.id,
        name: 'Mathematics',
        code: `MATH-${String(examStandard).replace('STD_', '')}A`,
        standard: examStandard,
        maxMarks: 100,
        passMarks: 35,
      },
    }),
    prisma.examSubject.create({
      data: {
        examId: annualExam.id,
        name: 'Science',
        code: `SCI-${String(examStandard).replace('STD_', '')}A`,
        standard: examStandard,
        maxMarks: 100,
        passMarks: 35,
      },
    }),
  ]);

  const [hallA, hallB] = await Promise.all([
    prisma.examHall.create({
      data: {
        name: 'Hall A',
        building: 'Main Block',
        floor: '1',
        capacity: 25,
      },
    }),
    prisma.examHall.create({
      data: {
        name: 'Hall B',
        building: 'Main Block',
        floor: '1',
        capacity: 25,
      },
    }),
  ]);

  const scheduleMath = await prisma.examSchedule.create({
    data: {
      examId: annualExam.id,
      subjectId: subMath10A.id,
      standard: examStandard,
      examDate: new Date('2027-03-12T00:00:00.000Z'),
      startsAt: new Date('2027-03-12T09:30:00.000Z'),
      endsAt: new Date('2027-03-12T12:30:00.000Z'),
      session: ExamSession.FN,
      halls: {
        create: [{ hallId: hallA.id }, { hallId: hallB.id }],
      },
    },
  });

  await prisma.examSchedule.create({
    data: {
      examId: annualExam.id,
      subjectId: subSci10A.id,
      standard: examStandard,
      examDate: new Date('2027-03-14T00:00:00.000Z'),
      startsAt: new Date('2027-03-14T13:30:00.000Z'),
      endsAt: new Date('2027-03-14T16:30:00.000Z'),
      session: ExamSession.AN,
      halls: {
        create: [{ hallId: hallA.id }, { hallId: hallB.id }],
      },
    },
  });

  const std10AStudents = await prisma.student.findMany({
    where: {
      standard: examStandard,
    },
    include: {
      admission: {
        select: { admissionNo: true },
      },
    },
  });

  std10AStudents.sort((a, b) => (a.admission?.admissionNo || a.name).localeCompare(b.admission?.admissionNo || b.name));

  const rollRows = [] as Array<{ id: string; studentId: string }>;
  for (let i = 0; i < std10AStudents.length; i += 1) {
    const student = std10AStudents[i];
    const created = await prisma.examRollNumber.create({
      data: {
        examId: annualExam.id,
        studentId: student.id,
        rollNumber: `ANNUAL-26-27-${String(examStandard)}-${String(i + 1).padStart(3, '0')}`,
        standard: examStandard,
        academicYear: '2026-2027',
      },
      select: { id: true, studentId: true },
    });
    rollRows.push(created);
  }

  const hallOrder = [hallA.id, hallB.id];
  const hallCapacity = 25;
  for (let i = 0; i < rollRows.length; i += 1) {
    const hallIndex = Math.floor(i / hallCapacity);
    if (hallIndex >= hallOrder.length) break;
    const seatNumber = (i % hallCapacity) + 1;

    await prisma.examSeatAllocation.create({
      data: {
        scheduleId: scheduleMath.id,
        hallId: hallOrder[hallIndex],
        studentId: rollRows[i].studentId,
        rollNumberId: rollRows[i].id,
        seatNumber,
      },
    });
  }

  console.log(`✅ Exam module seeded: 1 exam, 2 subjects, 2 halls, 2 timetable entries, ${rollRows.length} roll numbers, ${rollRows.length} seat allocations`);

  // ═══════════════════════════════════════════════
  // POS / STORE SEED DATA
  // ═══════════════════════════════════════════════
  console.log('🏪 Seeding POS module...');

  // ── STORES ──────────────────────────────────────
  const masterStore = await prisma.store.create({
    data: { name: 'Main Warehouse', description: 'Central warehouse – all stock received here first', isMaster: true },
  });
  const stationeryShop = await prisma.store.create({
    data: { name: 'Stationery Shop', description: 'Front-desk stationery counter for students' },
  });
  const uniformShop = await prisma.store.create({
    data: { name: 'Uniform Store', description: 'Uniform and accessories outlet' },
  });

  // ── STORE ITEMS ─────────────────────────────────
  const createItem = (data: any) => prisma.storeItem.create({ data });
  const items = {
    notebook:   await createItem({ name: 'Notebook 200-page', sku: 'STN-NB200', category: ItemCategory.STATIONERY, sellingPrice: 60, costPrice: 40, unit: 'pcs', reorderLevel: 50, isFreeEligible: true, freeLimit: 5 }),
    pen:        await createItem({ name: 'Ball Pen (Blue)', sku: 'STN-PEN-B', category: ItemCategory.STATIONERY, sellingPrice: 10, costPrice: 5, unit: 'pcs', reorderLevel: 100, isFreeEligible: true, freeLimit: 10 }),
    pencil:     await createItem({ name: 'HB Pencil', sku: 'STN-PEN-H', category: ItemCategory.STATIONERY, sellingPrice: 8, costPrice: 4, unit: 'pcs', reorderLevel: 100, isFreeEligible: true, freeLimit: 10 }),
    eraser:     await createItem({ name: 'Eraser (White)', sku: 'STN-ERA-W', category: ItemCategory.STATIONERY, sellingPrice: 5, costPrice: 2, unit: 'pcs', reorderLevel: 80 }),
    ruler:      await createItem({ name: 'Ruler 30cm', sku: 'STN-RUL30', category: ItemCategory.STATIONERY, sellingPrice: 15, costPrice: 8, unit: 'pcs', reorderLevel: 40, isFreeEligible: true, freeLimit: 2 }),
    whitener:   await createItem({ name: 'Whitener Pen', sku: 'STN-WHT-P', category: ItemCategory.STATIONERY, sellingPrice: 25, costPrice: 14, unit: 'pcs', reorderLevel: 30, isFreeEligible: true, freeLimit: 3 }),
    shirtS:     await createItem({ name: 'School Shirt (S)', sku: 'UNF-SHT-S', category: ItemCategory.UNIFORM, sellingPrice: 450, costPrice: 280, unit: 'pcs', reorderLevel: 20 }),
    shirtM:     await createItem({ name: 'School Shirt (M)', sku: 'UNF-SHT-M', category: ItemCategory.UNIFORM, sellingPrice: 470, costPrice: 290, unit: 'pcs', reorderLevel: 20 }),
    trouserM:   await createItem({ name: 'School Trouser (M)', sku: 'UNF-TRS-M', category: ItemCategory.UNIFORM, sellingPrice: 520, costPrice: 320, unit: 'pcs', reorderLevel: 20 }),
    belt:       await createItem({ name: 'School Belt', sku: 'UNF-BELT', category: ItemCategory.ACCESSORIES, sellingPrice: 150, costPrice: 80, unit: 'pcs', reorderLevel: 30 }),
    idCard:     await createItem({ name: 'ID Card (Blank)', sku: 'ID-BLANK', category: ItemCategory.ID_CARD, sellingPrice: 50, costPrice: 15, unit: 'pcs', reorderLevel: 100 }),
    mathBook:   await createItem({ name: 'Maths Textbook (10th)', sku: 'BK-MATH10', category: ItemCategory.BOOKS, sellingPrice: 350, costPrice: 220, unit: 'pcs', reorderLevel: 15 }),
    sciBook:    await createItem({ name: 'Science Textbook (10th)', sku: 'BK-SCI10', category: ItemCategory.BOOKS, sellingPrice: 380, costPrice: 240, unit: 'pcs', reorderLevel: 15 }),
    handWash:   await createItem({ name: 'Hand Wash 500ml', sku: 'SAN-HW500', category: ItemCategory.SANITARY, sellingPrice: 120, costPrice: 75, unit: 'bottle', reorderLevel: 20 }),
    sanitizer:  await createItem({ name: 'Sanitizer 200ml', sku: 'SAN-SZ200', category: ItemCategory.SANITARY, sellingPrice: 80, costPrice: 45, unit: 'bottle', reorderLevel: 25 }),
    bench:      await createItem({ name: 'Classroom Bench (3-seater)', sku: 'FRN-BN03', category: ItemCategory.FURNITURE, sellingPrice: 3500, costPrice: 2200, unit: 'pcs', reorderLevel: 5 }),
    desk:       await createItem({ name: 'Teacher Desk', sku: 'FRN-TDESK', category: ItemCategory.FURNITURE, sellingPrice: 4800, costPrice: 3200, unit: 'pcs', reorderLevel: 3 }),
  };

  // ── SUPPLIERS ───────────────────────────────────
  const supplierA = await prisma.supplier.create({
    data: { name: 'SRS Stationery Distributors', phone: '9876500001', email: 'srs@example.com', address: '12, Anna Nagar, Chennai', gstNo: '33AAACS1234F1ZV' },
  });
  const supplierB = await prisma.supplier.create({
    data: { name: 'KVS Uniforms Pvt Ltd', phone: '9876500002', email: 'kvs@example.com', address: '45, T Nagar, Chennai', gstNo: '33AABCK5678G2ZX' },
  });
  const supplierC = await prisma.supplier.create({
    data: { name: 'National Book Depot', phone: '9876500003', email: 'nbd@example.com', address: '78, Mylapore, Chennai' },
  });

  // ── PURCHASES (stock in) ────────────────────────
  // Purchase 1 – Stationery into master warehouse
  const purchase1 = await prisma.purchase.create({
    data: {
      supplierId: supplierA.id,
      storeId: masterStore.id,
      invoiceNo: 'SRS/2026/0412',
      invoiceDate: new Date('2026-03-15'),
      totalAmount: 6450,
      remarks: 'Monthly stationery replenishment',
      items: {
        create: [
          { itemId: items.notebook.id, quantity: 100, unitPrice: 40, totalPrice: 4000 },
          { itemId: items.pen.id, quantity: 200, unitPrice: 5, totalPrice: 1000 },
          { itemId: items.pencil.id, quantity: 200, unitPrice: 4, totalPrice: 800 },
          { itemId: items.eraser.id, quantity: 150, unitPrice: 2, totalPrice: 300 },
          { itemId: items.whitener.id, quantity: 25, unitPrice: 14, totalPrice: 350 },
        ],
      },
    },
  });

  // Purchase 2 – Uniforms into master warehouse
  const purchase2 = await prisma.purchase.create({
    data: {
      supplierId: supplierB.id,
      storeId: masterStore.id,
      invoiceNo: 'KVS/2026/0087',
      invoiceDate: new Date('2026-03-18'),
      totalAmount: 18800,
      items: {
        create: [
          { itemId: items.shirtS.id, quantity: 20, unitPrice: 280, totalPrice: 5600 },
          { itemId: items.shirtM.id, quantity: 20, unitPrice: 290, totalPrice: 5800 },
          { itemId: items.trouserM.id, quantity: 15, unitPrice: 320, totalPrice: 4800 },
          { itemId: items.belt.id, quantity: 20, unitPrice: 80, totalPrice: 1600 },
          { itemId: items.idCard.id, quantity: 100, unitPrice: 15, totalPrice: 1500 },
        ],
      },
    },
  });

  // Purchase 3 – Books
  await prisma.purchase.create({
    data: {
      supplierId: supplierC.id,
      storeId: masterStore.id,
      invoiceNo: 'NBD/2026/221',
      invoiceDate: new Date('2026-03-20'),
      totalAmount: 9200,
      items: {
        create: [
          { itemId: items.mathBook.id, quantity: 20, unitPrice: 220, totalPrice: 4400 },
          { itemId: items.sciBook.id, quantity: 20, unitPrice: 240, totalPrice: 4800 },
        ],
      },
    },
  });

  // Purchase 4 – Sanitary & Furniture
  await prisma.purchase.create({
    data: {
      supplierId: supplierA.id,
      storeId: masterStore.id,
      invoiceNo: 'SRS/2026/0413',
      invoiceDate: new Date('2026-03-22'),
      totalAmount: 15400,
      items: {
        create: [
          { itemId: items.handWash.id, quantity: 30, unitPrice: 75, totalPrice: 2250 },
          { itemId: items.sanitizer.id, quantity: 40, unitPrice: 45, totalPrice: 1800 },
          { itemId: items.bench.id, quantity: 3, unitPrice: 2200, totalPrice: 6600 },
          { itemId: items.desk.id, quantity: 1, unitPrice: 3200, totalPrice: 3200 },
          { itemId: items.ruler.id, quantity: 50, unitPrice: 8, totalPrice: 400 },
        ],
      },
    },
  });

  // ── STOCK (master warehouse receives everything) ─
  const masterStockData = [
    { itemId: items.notebook.id, quantity: 100 },
    { itemId: items.pen.id, quantity: 200 },
    { itemId: items.pencil.id, quantity: 200 },
    { itemId: items.eraser.id, quantity: 150 },
    { itemId: items.ruler.id, quantity: 50 },
    { itemId: items.whitener.id, quantity: 25 },
    { itemId: items.shirtS.id, quantity: 20 },
    { itemId: items.shirtM.id, quantity: 20 },
    { itemId: items.trouserM.id, quantity: 15 },
    { itemId: items.belt.id, quantity: 20 },
    { itemId: items.idCard.id, quantity: 100 },
    { itemId: items.mathBook.id, quantity: 20 },
    { itemId: items.sciBook.id, quantity: 20 },
    { itemId: items.handWash.id, quantity: 30 },
    { itemId: items.sanitizer.id, quantity: 40 },
    { itemId: items.bench.id, quantity: 3 },
    { itemId: items.desk.id, quantity: 1 },
  ];
  for (const s of masterStockData) {
    await prisma.storeStock.create({ data: { storeId: masterStore.id, ...s } });
  }

  // ── STOCK TRANSFERS (master → shops) ────────────
  // Transfer stationery to stationery shop
  await prisma.stockTransfer.create({
    data: {
      fromStoreId: masterStore.id,
      toStoreId: stationeryShop.id,
      remarks: 'Weekly stationery refill',
      items: {
        create: [
          { itemId: items.notebook.id, quantity: 40 },
          { itemId: items.pen.id, quantity: 80 },
          { itemId: items.pencil.id, quantity: 80 },
          { itemId: items.eraser.id, quantity: 60 },
          { itemId: items.ruler.id, quantity: 20 },
          { itemId: items.whitener.id, quantity: 10 },
          { itemId: items.mathBook.id, quantity: 10 },
          { itemId: items.sciBook.id, quantity: 10 },
          { itemId: items.handWash.id, quantity: 10 },
          { itemId: items.sanitizer.id, quantity: 15 },
        ],
      },
    },
  });
  // Update stock for stationery shop
  const stationeryStock = [
    { itemId: items.notebook.id, quantity: 40 },
    { itemId: items.pen.id, quantity: 80 },
    { itemId: items.pencil.id, quantity: 80 },
    { itemId: items.eraser.id, quantity: 60 },
    { itemId: items.ruler.id, quantity: 20 },
    { itemId: items.whitener.id, quantity: 10 },
    { itemId: items.mathBook.id, quantity: 10 },
    { itemId: items.sciBook.id, quantity: 10 },
    { itemId: items.handWash.id, quantity: 10 },
    { itemId: items.sanitizer.id, quantity: 15 },
  ];
  for (const s of stationeryStock) {
    await prisma.storeStock.create({ data: { storeId: stationeryShop.id, ...s } });
  }
  // Reduce master stock accordingly
  for (const s of stationeryStock) {
    await prisma.storeStock.update({
      where: { storeId_itemId: { storeId: masterStore.id, itemId: s.itemId } },
      data: { quantity: { decrement: s.quantity } },
    });
  }

  // Transfer uniforms to uniform store
  await prisma.stockTransfer.create({
    data: {
      fromStoreId: masterStore.id,
      toStoreId: uniformShop.id,
      remarks: 'Uniform opening stock',
      items: {
        create: [
          { itemId: items.shirtS.id, quantity: 15 },
          { itemId: items.shirtM.id, quantity: 15 },
          { itemId: items.trouserM.id, quantity: 10 },
          { itemId: items.belt.id, quantity: 15 },
          { itemId: items.idCard.id, quantity: 50 },
        ],
      },
    },
  });
  const uniformStock = [
    { itemId: items.shirtS.id, quantity: 15 },
    { itemId: items.shirtM.id, quantity: 15 },
    { itemId: items.trouserM.id, quantity: 10 },
    { itemId: items.belt.id, quantity: 15 },
    { itemId: items.idCard.id, quantity: 50 },
  ];
  for (const s of uniformStock) {
    await prisma.storeStock.create({ data: { storeId: uniformShop.id, ...s } });
  }
  for (const s of uniformStock) {
    await prisma.storeStock.update({
      where: { storeId_itemId: { storeId: masterStore.id, itemId: s.itemId } },
      data: { quantity: { decrement: s.quantity } },
    });
  }

  // ── SALES ──────────────────────────────────────
  // Sale 1 – Walk-in stationery purchase (CASH)
  await prisma.sale.create({
    data: {
      storeId: stationeryShop.id,
      invoiceNo: 'POS-2026-0001',
      customerName: 'Walk-in Customer',
      customerType: 'WALK_IN',
      paymentMode: 'CASH',
      totalAmount: 150,
      discount: 0,
      netAmount: 150,
      items: {
        create: [
          { itemId: items.notebook.id, quantity: 2, unitPrice: 60, totalPrice: 120 },
          { itemId: items.pen.id, quantity: 3, unitPrice: 10, totalPrice: 30 },
        ],
      },
    },
  });

  // Sale 2 – Student buying uniform (UPI)
  await prisma.sale.create({
    data: {
      storeId: uniformShop.id,
      invoiceNo: 'POS-2026-0002',
      customerName: students[0]?.name || 'Student A',
      customerType: 'STUDENT',
      paymentMode: 'UPI',
      totalAmount: 1140,
      discount: 50,
      netAmount: 1090,
      items: {
        create: [
          { itemId: items.shirtM.id, quantity: 1, unitPrice: 470, totalPrice: 470 },
          { itemId: items.trouserM.id, quantity: 1, unitPrice: 520, totalPrice: 520 },
          { itemId: items.belt.id, quantity: 1, unitPrice: 150, totalPrice: 150 },
        ],
      },
    },
  });

  // Sale 3 – Staff buying books (CARD)
  await prisma.sale.create({
    data: {
      storeId: stationeryShop.id,
      invoiceNo: 'POS-2026-0003',
      customerName: staffRecords[0].name,
      customerType: 'STAFF',
      paymentMode: 'CARD',
      totalAmount: 730,
      discount: 0,
      netAmount: 730,
      items: {
        create: [
          { itemId: items.mathBook.id, quantity: 1, unitPrice: 350, totalPrice: 350 },
          { itemId: items.sciBook.id, quantity: 1, unitPrice: 380, totalPrice: 380 },
        ],
      },
    },
  });

  // Sale 4 – Walk-in sanitary (CASH)
  await prisma.sale.create({
    data: {
      storeId: stationeryShop.id,
      invoiceNo: 'POS-2026-0004',
      customerName: null,
      customerType: 'WALK_IN',
      paymentMode: 'CASH',
      totalAmount: 200,
      discount: 0,
      netAmount: 200,
      items: {
        create: [
          { itemId: items.handWash.id, quantity: 1, unitPrice: 120, totalPrice: 120 },
          { itemId: items.sanitizer.id, quantity: 1, unitPrice: 80, totalPrice: 80 },
        ],
      },
    },
  });

  // Sale 5 – Large student uniform purchase (UPI)
  await prisma.sale.create({
    data: {
      storeId: uniformShop.id,
      invoiceNo: 'POS-2026-0005',
      customerName: students[1]?.name || 'Student B',
      customerType: 'STUDENT',
      paymentMode: 'UPI',
      totalAmount: 1170,
      discount: 100,
      netAmount: 1070,
      remarks: 'Bulk uniform (2 sets)',
      items: {
        create: [
          { itemId: items.shirtS.id, quantity: 2, unitPrice: 450, totalPrice: 900 },
          { itemId: items.belt.id, quantity: 1, unitPrice: 150, totalPrice: 150 },
          { itemId: items.idCard.id, quantity: 1, unitPrice: 50, totalPrice: 50 },
        ],
      },
    },
  });

  // Reduce sold stock from shops
  const stationerySold = [
    { itemId: items.notebook.id, qty: 2 }, { itemId: items.pen.id, qty: 3 },
    { itemId: items.mathBook.id, qty: 1 }, { itemId: items.sciBook.id, qty: 1 },
    { itemId: items.handWash.id, qty: 1 }, { itemId: items.sanitizer.id, qty: 1 },
  ];
  for (const s of stationerySold) {
    await prisma.storeStock.update({
      where: { storeId_itemId: { storeId: stationeryShop.id, itemId: s.itemId } },
      data: { quantity: { decrement: s.qty } },
    });
  }
  const uniformSold = [
    { itemId: items.shirtM.id, qty: 1 }, { itemId: items.trouserM.id, qty: 1 },
    { itemId: items.belt.id, qty: 2 }, { itemId: items.shirtS.id, qty: 2 },
    { itemId: items.idCard.id, qty: 1 },
  ];
  for (const s of uniformSold) {
    await prisma.storeStock.update({
      where: { storeId_itemId: { storeId: uniformShop.id, itemId: s.itemId } },
      data: { quantity: { decrement: s.qty } },
    });
  }

  // ── TEACHER FREE ITEMS ─────────────────────────
  // Staff 1 (Raghavan) gets notebooks and pens
  await prisma.teacherFreeItem.create({
    data: { staffId: staffRecords[0].id, itemId: items.notebook.id, academicYear: '2025-2026', quantityGiven: 5, quantityReturned: 0, status: 'GIVEN' },
  });
  await prisma.teacherFreeItem.create({
    data: { staffId: staffRecords[0].id, itemId: items.pen.id, academicYear: '2025-2026', quantityGiven: 10, quantityReturned: 3, status: 'PARTIAL_RETURNED' },
  });
  // Staff 2 (Meena) gets pencils, whitener, ruler
  await prisma.teacherFreeItem.create({
    data: { staffId: staffRecords[1].id, itemId: items.pencil.id, academicYear: '2025-2026', quantityGiven: 8, quantityReturned: 8, status: 'RETURNED', returnedDate: new Date('2026-03-25') },
  });
  await prisma.teacherFreeItem.create({
    data: { staffId: staffRecords[1].id, itemId: items.whitener.id, academicYear: '2025-2026', quantityGiven: 3, quantityReturned: 0, status: 'GIVEN' },
  });
  await prisma.teacherFreeItem.create({
    data: { staffId: staffRecords[1].id, itemId: items.ruler.id, academicYear: '2025-2026', quantityGiven: 2, quantityReturned: 1, status: 'PARTIAL_RETURNED' },
  });
  // Staff 3 (Karthik) – new year allocation
  await prisma.teacherFreeItem.create({
    data: { staffId: staffRecords[2].id, itemId: items.notebook.id, academicYear: '2026-2027', quantityGiven: 3, quantityReturned: 0, status: 'GIVEN' },
  });
  await prisma.teacherFreeItem.create({
    data: { staffId: staffRecords[2].id, itemId: items.pen.id, academicYear: '2026-2027', quantityGiven: 5, quantityReturned: 0, status: 'GIVEN' },
  });

  // ── POS TRANSACTIONS (Income / Expense) ────────
  await prisma.posTransaction.create({
    data: { type: 'INCOME', category: 'SALE', description: 'Stationery sales – March week 3', amount: 150, date: new Date('2026-03-25'), remarks: 'Walk-in cash sales' },
  });
  await prisma.posTransaction.create({
    data: { type: 'INCOME', category: 'SALE', description: 'Uniform sales – March week 3', amount: 2160, date: new Date('2026-03-26'), remarks: 'POS invoices 0002 + 0005' },
  });
  await prisma.posTransaction.create({
    data: { type: 'EXPENSE', category: 'PURCHASE', description: 'Stationery stock from SRS Distributors', amount: 6450, date: new Date('2026-03-15'), referenceId: purchase1.id },
  });
  await prisma.posTransaction.create({
    data: { type: 'EXPENSE', category: 'PURCHASE', description: 'Uniform stock from KVS Pvt Ltd', amount: 18800, date: new Date('2026-03-18'), referenceId: purchase2.id },
  });
  await prisma.posTransaction.create({
    data: { type: 'EXPENSE', category: 'MAINTENANCE', description: 'Stationery shop AC repair', amount: 2500, date: new Date('2026-03-20'), remarks: 'Paid to Cool Breeze Services (cash)' },
  });
  await prisma.posTransaction.create({
    data: { type: 'INCOME', category: 'OTHER', description: 'Old furniture sold as scrap', amount: 800, date: new Date('2026-03-28'), remarks: 'Broken benches sold' },
  });
  await prisma.posTransaction.create({
    data: { type: 'EXPENSE', category: 'OTHER', description: 'New display rack for uniform shop', amount: 3200, date: new Date('2026-03-22') },
  });

  console.log('✅ POS module seeded: 3 stores, 17 items, 3 suppliers, 4 purchases, 5 sales, 2 transfers, 7 teacher free-item records, 7 transactions');

  console.log('✅ Seeded users, admissions, transport, fees, staff, HR, location, and POS modules for two academic years.');
  console.log(`✅ Academic years seeded: ${ACADEMIC_YEARS.join(', ')}`);
  console.log(`✅ Staff seeded: ${staffRecords.length}`);
  console.log(`✅ Students seeded: ${students.length}`);
  console.log(`✅ Routes seeded: 2 (${toStandardLabel(Standard.STD_10)} examples available in transport assignments)`);
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
