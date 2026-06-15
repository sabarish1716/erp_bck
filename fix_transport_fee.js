const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  const student = await prisma.student.findFirst({
    where: { name: 'New Student' },
    include: { studentFees: { include: { terms: true } } }
  });
  if (!student) return console.log('Not found');

  for (const fee of student.studentFees) {
    const term = fee.terms.find(t => t.termName === 'Special Class Transport');
    if (term && term.amount !== fee.specialClassTransportFee) {
      console.log('Fixing term amount from', term.amount, 'to', fee.specialClassTransportFee);
      await prisma.studentFeeTerm.update({
        where: { id: term.id },
        data: { amount: fee.specialClassTransportFee }
      });
      // also fix total fee
      const delta = fee.specialClassTransportFee - term.amount;
      await prisma.studentFee.update({
        where: { id: fee.id },
        data: {
           totalFee: fee.totalFee + delta,
           netFee: fee.netFee + delta
        }
      });
      console.log('Fixed for', student.name);
    }
  }
}

fix().finally(() => prisma.$disconnect());
