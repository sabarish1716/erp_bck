import * as bcrypt from 'bcrypt';
import { StaffService } from './staff.service';

describe('StaffService', () => {
  let service: StaffService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      staff: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      user: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    service = new StaffService(prisma);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the next auto-incremented employee ID', async () => {
    prisma.staff.findMany.mockResolvedValue([
      { employeeId: 'EMP0007' },
      { employeeId: 'EMP0003' },
    ]);

    await expect(service.getNextEmployeeId()).resolves.toEqual({ employeeId: 'EMP0008' });
  });

  it('auto-generates employee ID when creating staff without one', async () => {
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-password' as never);

    const tx = {
      staff: {
        findMany: jest.fn().mockResolvedValue([{ employeeId: 'EMP0001' }]),
        create: jest.fn().mockResolvedValue({ id: 'staff-1', employeeId: 'EMP0002', name: 'Staff Name' }),
      },
      user: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
      },
    };

    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

    await service.create({
      name: 'Staff Name',
      email: 'staff@example.com',
      designation: 'Teacher',
      password: 'secret123',
    });

    expect(tx.staff.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ employeeId: 'EMP0002' }),
      }),
    );
    expect(tx.user.create).toHaveBeenCalled();
  });
});