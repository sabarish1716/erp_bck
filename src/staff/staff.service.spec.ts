import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
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
        findMany: jest.fn(),
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
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: Role.STAFF,
          staffId: 'staff-1',
        }),
      }),
    );
  });

  it('creates a transport manager user when requested', async () => {
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-password' as never);

    const tx = {
      staff: {
        findMany: jest.fn().mockResolvedValue([{ employeeId: 'EMP0009' }]),
        create: jest.fn().mockResolvedValue({ id: 'staff-transport', employeeId: 'EMP0010', name: 'Transport Lead' }),
      },
      user: {
        create: jest.fn().mockResolvedValue({ id: 2 }),
      },
    };

    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

    await service.create({
      name: 'Transport Lead',
      email: 'transport.manager@example.com',
      designation: 'Transport Manager',
      password: 'secret123',
      role: Role.TRANSPORT_MANAGER,
    });

    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: Role.TRANSPORT_MANAGER,
          staffId: 'staff-transport',
        }),
      }),
    );
  });

  it('lists only transport managers from the staff module', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 2,
        staffId: 'staff-transport',
        role: Role.TRANSPORT_MANAGER,
        isActive: true,
        email: 'transport.manager@example.com',
      },
    ]);
    prisma.staff.findMany.mockResolvedValue([
      {
        id: 'staff-transport',
        employeeId: 'EMP0010',
        name: 'Transport Lead',
        email: 'transport.manager@example.com',
        designation: 'Transport Manager',
        children: [],
      },
    ]);

    await expect(service.findTransportManagers()).resolves.toEqual([
      expect.objectContaining({
        id: 'staff-transport',
        employeeId: 'EMP0010',
        user: expect.objectContaining({
          id: 2,
          role: Role.TRANSPORT_MANAGER,
        }),
      }),
    ]);
  });
});