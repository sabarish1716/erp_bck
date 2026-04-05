import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { LocationService } from './location.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { Permissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permission.enum';
import { Public } from '../auth/public.decorator';

@Controller('location')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Public()
  @Get('geofence')
  async getGeofence() {
    return this.locationService.getGeofenceConfig();
  }

  // POST /location
  @Post()
  @Public()
  /**
   * Create a location entry.
   * Note: The driverId field can be the driver's UUID, phone number, or deviceId. If a phone number is sent, it will be resolved to the correct driver.
   * If no driver is found, an error is thrown. No driver will be created automatically.
   */
  async create(@Body() dto: CreateLocationDto) {
    return this.locationService.create(dto);
  }

  // GET /location/live
  @Get('live/drivers')
  @Permissions(Permission.LOCATION_READ)
  async getLiveDrivers() {
    return this.locationService.getLiveDriverLocations();
  }

  // GET /location/:driverId
  @Get(':driverId')
  @Permissions(Permission.LOCATION_READ)
  async getLatest(@Param('driverId') driverId: string) {
    return this.locationService.getLatestLocation(driverId);
  }
}