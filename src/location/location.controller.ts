import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { LocationService } from './location.service';
import { CreateLocationDto } from './dto/create-location.dto';

@Controller('location')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  // POST /location
  @Post()
  async create(@Body() dto: CreateLocationDto) {
    console.log('Received location data:', dto);
    return this.locationService.create(dto);
  }

  // GET /location/:driverId
  @Get(':driverId')
  async getLatest(@Param('driverId') driverId: string) {
    return this.locationService.getLatestLocation(driverId);
  }
}