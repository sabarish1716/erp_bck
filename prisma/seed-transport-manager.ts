import { PrismaClient, Role, StaffCategory } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const TRANSPORT_MANAGER = {
  name: 'Transport Manager',
  email: 'transport.manager@school.com',
  password: 'transport123',
  phone: '9000000011',
  designation: 'Transport Manager',
  department: 'Transport',
  qualification: 'B.Com',
  joiningDate: new Date('2026-04-10T00:00:00.000Z'),
  salary: 35000,
  category: StaffCategory.NON_TEACHING_REGULAR,
  paymentMode: 'BANK_TRANSFER',
  bankName: 'Indian Bank',
  bankAccountNo: '6543210011',
  bankIfsc: 'IDIB000C011',
} as const;

async function getNextEmployeeId() {
  const staffMembers = await prisma.staff.findMany({
    select: { employeeId: true },
    orderBy: { employeeId: 'asc' },
  });

  const maxSequence = staffMembers.reduce((currentMax, staff) => {
    const match = staff.employeeId.match(/(\d+)$/);
    const value = match ? Number(match[1]) : 0;
    return Math.max(currentMax, value);
  }, 0);

  return `EMP${String(maxSequence + 1).padStart(4, '0')}`;
}

async function main() {
  const hashedPassword = await bcrypt.hash(TRANSPORT_MANAGER.password, 10);
  const existingStaff = await prisma.staff.findUnique({
    where: { email: TRANSPORT_MANAGER.email },
    select: { id: true, employeeId: true },
  });

  const staff = existingStaff
    ? await prisma.staff.update({
        where: { email: TRANSPORT_MANAGER.email },
        data: {
          name: TRANSPORT_MANAGER.name,
          phone: TRANSPORT_MANAGER.phone,
          designation: TRANSPORT_MANAGER.designation,
          department: TRANSPORT_MANAGER.department,
          qualification: TRANSPORT_MANAGER.qualification,
          joiningDate: TRANSPORT_MANAGER.joiningDate,
          salary: TRANSPORT_MANAGER.salary,
          category: TRANSPORT_MANAGER.category,
          paymentMode: TRANSPORT_MANAGER.paymentMode,
          bankName: TRANSPORT_MANAGER.bankName,
          bankAccountNo: TRANSPORT_MANAGER.bankAccountNo,
          bankIfsc: TRANSPORT_MANAGER.bankIfsc,
          isActive: true,
        },
      })
    : await prisma.staff.create({
        data: {
          employeeId: await getNextEmployeeId(),
          name: TRANSPORT_MANAGER.name,
          email: TRANSPORT_MANAGER.email,
          phone: TRANSPORT_MANAGER.phone,
          designation: TRANSPORT_MANAGER.designation,
          department: TRANSPORT_MANAGER.department,
          qualification: TRANSPORT_MANAGER.qualification,
          joiningDate: TRANSPORT_MANAGER.joiningDate,
          salary: TRANSPORT_MANAGER.salary,
          category: TRANSPORT_MANAGER.category,
          paymentMode: TRANSPORT_MANAGER.paymentMode,
          bankName: TRANSPORT_MANAGER.bankName,
          bankAccountNo: TRANSPORT_MANAGER.bankAccountNo,
          bankIfsc: TRANSPORT_MANAGER.bankIfsc,
          isActive: true,
        },
      });

  const user = await prisma.user.upsert({
    where: { email: TRANSPORT_MANAGER.email },
    update: {
      name: TRANSPORT_MANAGER.name,
      password: hashedPassword,
      role: Role.TRANSPORT_MANAGER,
      isActive: true,
      staffId: staff.id,
    },
    create: {
      name: TRANSPORT_MANAGER.name,
      email: TRANSPORT_MANAGER.email,
      password: hashedPassword,
      role: Role.TRANSPORT_MANAGER,
      isActive: true,
      staffId: staff.id,
    },
  });

  console.log('Transport manager seeded successfully');
  console.log(`staffId: ${staff.id}`);
  console.log(`employeeId: ${staff.employeeId}`);
  console.log(`userId: ${user.id}`);
  console.log(`email: ${TRANSPORT_MANAGER.email}`);
  console.log(`password: ${TRANSPORT_MANAGER.password}`);
}

main()
  .catch((error) => {
    console.error('Failed to seed transport manager');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });