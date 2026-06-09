import { Test, TestingModule } from '@nestjs/testing';
import { LocationService } from './location.service';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('LocationService', () => {
  let service: LocationService;

  const prisma = {
    location: {
      findMany: jest.fn(),
    },
  } as any;

  const supabase = {
    importRecentDriverLocationsToLocal: jest.fn().mockResolvedValue(0),
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.location.findMany.mockResolvedValue([]);
    delete process.env.LOCATION_LIVE_WINDOW_MINUTES;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationService,
        { provide: PrismaService, useValue: prisma },
        { provide: SupabaseService, useValue: supabase },
      ],
    }).compile();

    service = module.get<LocationService>(LocationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('imports recent Supabase locations before reading live drivers', async () => {
    await service.getLiveDriverLocations();

    expect(supabase.importRecentDriverLocationsToLocal).toHaveBeenCalledTimes(
      1,
    );
    expect(supabase.importRecentDriverLocationsToLocal).toHaveBeenCalledWith(
      expect.any(Date),
    );
  });

  it('uses a 15 minute default live window', async () => {
    await service.getLiveDriverLocations();

    const query = prisma.location.findMany.mock.calls[0][0];
    const lowerBound = query.where.createdAt.gt as Date;
    const minutesAgo = (Date.now() - lowerBound.getTime()) / (60 * 1000);

    expect(minutesAgo).toBeGreaterThanOrEqual(14);
    expect(minutesAgo).toBeLessThanOrEqual(16);
  });
});
