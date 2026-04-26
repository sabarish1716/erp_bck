import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding admin user only...');

  const hashedPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@school.com' },
    update: {
      name: 'Super Admin',
      password: hashedPassword,
      role: Role.ADMIN,
      isActive: true,
    },
    create: {
      name: 'Super Admin',
      email: 'admin@school.com',
      password: hashedPassword,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  console.log('Admin seed completed');
  console.log(`email: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error('Admin seed failed');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
