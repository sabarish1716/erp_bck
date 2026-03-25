// location.controller.ts
import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { LocationService } from './location.service';
import { UpdateLocationDto } from './dto/update-location.dto';

@Controller('location')
export class LocationController {
  constructor(private readonly service: LocationService) {}

  @Post('update')
  update(@Body() body: UpdateLocationDto) {
    return this.service.updateLocation(body);
  }

  @Get(':vanId')
  getLatest(@Param('vanId') vanId: string) {
    return this.service.getLatestLocation(vanId);
  }
}