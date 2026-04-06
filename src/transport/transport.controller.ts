import { VehicleDriverMappingDto, MileageSnapshotDto } from './dto/mileage.dto';

import {
  Controller,
  Post,
  Put,
  Patch,
  Get,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { TransportService } from './transport.service';
import {
  CreateTransportRouteDto,
  AssignStudentTransportDto,
  CreateDriverDto,
  UpdateDriverDto,
  CreateBusDto,
  UpdateBusDto,
} from './dto/transport.dto';
import { UpdateSplClassDatesDto } from './dto/spl-class.dto';
import { Permissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permission.enum';

@Controller('transport')
export class TransportController {
  constructor(private readonly transportService: TransportService) {}

  // ─── ROUTES ───────────────────────────────────
  // ─── VEHICLE-DRIVER MAPPING ─────────────────────────────

  @Get('vehicle-drivers')
  @Permissions(Permission.TRANSPORT_READ)
  getVehicleDriverMappings() {
    return this.transportService.getVehicleDriverMappings();
  }

  @Post('vehicle-drivers')
  @Permissions(Permission.TRANSPORT_ASSIGN)
  assignVehicleDriver(@Body() dto: any) {
    return this.transportService.assignVehicleDriver(dto);
  }

  @Delete('vehicle-drivers/:plateNo')
  @Permissions(Permission.TRANSPORT_ASSIGN)
  removeVehicleDriver(@Param('plateNo') plateNo: string) {
    return this.transportService.removeVehicleDriver(plateNo);
  }

  // ─── MILEAGE APIs ───────────────────────────────────────

  @Post('mileage/snapshot')
  @Permissions(Permission.TRANSPORT_ASSIGN)
  createMileageSnapshot(@Body() dto: any) {
    return this.transportService.createMileageSnapshot(dto);
  }

  @Post('trip-events')
  @Permissions(Permission.TRANSPORT_ASSIGN)
  pushTripEvents(@Body() dto: any) {
    // Schema for trip events isn't yet created; simply acknowledge receipt
    return { success: true, count: dto.events?.length || 0 };
  }

  @Get('mileage/daily')
  @Permissions(Permission.TRANSPORT_READ)
  getDailyMileage(@Query('busId') busId: string, @Query('date') date?: string) {
    return this.transportService.getDailyMileage(busId, date);
  }


  @Post('routes')
  @Permissions(Permission.TRANSPORT_ROUTE_CREATE)
  createRoute(@Body() dto: CreateTransportRouteDto) {
    return this.transportService.createRoute(dto);
  }

  @Put('routes/:id')
  @Permissions(Permission.TRANSPORT_ROUTE_UPDATE)
  updateRoute(@Param('id') id: string, @Body() dto: CreateTransportRouteDto) {
    return this.transportService.updateRoute(id, dto);
  }

  @Get('routes')
  @Permissions(Permission.TRANSPORT_ROUTE_READ)
  getAllRoutes() {
    return this.transportService.getAllRoutes();
  }

  @Get('academic-years')
  @Permissions(Permission.TRANSPORT_READ)
  getAcademicYears() {
    return this.transportService.getAcademicYears();
  }

  @Get('routes/:id')
  @Permissions(Permission.TRANSPORT_ROUTE_READ)
  getRoute(@Param('id') id: string) {
    return this.transportService.getRoute(id);
  }

  @Delete('routes/:id')
  @Permissions(Permission.TRANSPORT_ROUTE_DELETE)
  deleteRoute(@Param('id') id: string) {
    return this.transportService.deleteRoute(id);
  }

  // ─── STUDENT TRANSPORT ASSIGNMENT ─────────────

  @Post('assign')
  @Permissions(Permission.TRANSPORT_ASSIGN)
  assignStudent(@Body() dto: AssignStudentTransportDto) {
    return this.transportService.assignStudent(dto);
  }

  @Get('students/pending')
  @Permissions(Permission.TRANSPORT_READ)
  getPendingTransportStudents(@Query('academicYear') academicYear?: string) {
    return this.transportService.getPendingTransportStudents(academicYear);
  }

  @Get('student/:studentId')
  @Permissions(Permission.TRANSPORT_READ)
  getStudentTransport(@Param('studentId') studentId: string) {
    return this.transportService.getStudentTransport(studentId);
  }

  @Delete('student/:studentId')
  @Permissions(Permission.TRANSPORT_ASSIGN)
  removeStudentTransport(@Param('studentId') studentId: string) {
    return this.transportService.removeStudentTransport(studentId);
  }

  @Get('assignments')
  @Permissions(Permission.TRANSPORT_READ)
  getAllAssignments(@Query('academicYear') academicYear?: string) {
    return this.transportService.getAllAssignments(academicYear);
  }

  @Get('fee/:studentId')
  @Permissions(Permission.TRANSPORT_READ)
  getTransportFee(@Param('studentId') studentId: string) {
    return this.transportService.getTransportFeeBreakdown(studentId);
  }

  // ─── SPECIAL CLASS PRO-RATA ───────────────────

  @Put('spl-class/dates')
  @Permissions(Permission.TRANSPORT_ASSIGN)
  updateSplClassDates(@Body() dto: UpdateSplClassDatesDto) {
    return this.transportService.updateSplClassDates(dto);
  }

  @Post('spl-class/stop/:studentId')
  @Permissions(Permission.TRANSPORT_ASSIGN)
  stopSplClass(
    @Param('studentId') studentId: string,
    @Body() body: { daysUsed: number; totalWorkingDays: number },
  ) {
    return this.transportService.stopSplClass(studentId, body.daysUsed, body.totalWorkingDays);
  }

  // ─── DRIVER CRUD ──────────────────────────────

  @Post('drivers')
  @Permissions(Permission.TRANSPORT_ROUTE_CREATE)
  createDriver(@Body() dto: CreateDriverDto) {
    return this.transportService.createDriver(dto);
  }

  @Put('drivers/:id')
  @Permissions(Permission.TRANSPORT_ROUTE_UPDATE)
  updateDriver(@Param('id') id: string, @Body() dto: UpdateDriverDto) {
    return this.transportService.updateDriver(id, dto);
  }

  @Get('drivers')
  @Permissions(Permission.TRANSPORT_READ)
  getAllDrivers() {
    return this.transportService.getAllDrivers();
  }

  @Get('drivers/:id')
  @Permissions(Permission.TRANSPORT_READ)
  getDriver(@Param('id') id: string) {
    return this.transportService.getDriver(id);
  }

  @Get('drivers/:id/live-status')
  @Permissions(Permission.LOCATION_READ)
  getDriverLiveStatus(@Param('id') id: string) {
    return this.transportService.getDriverLiveStatus(id);
  }

  @Delete('drivers/:id')
  @Permissions(Permission.TRANSPORT_ROUTE_DELETE)
  deleteDriver(@Param('id') id: string) {
    return this.transportService.deleteDriver(id);
  }

  // ─── BUS CRUD ─────────────────────────────────

  @Post('buses')
  @Permissions(Permission.TRANSPORT_ROUTE_CREATE)
  createBus(@Body() dto: CreateBusDto) {
    return this.transportService.createBus(dto);
  }

  @Put('buses/:id')
  @Permissions(Permission.TRANSPORT_ROUTE_UPDATE)
  updateBus(@Param('id') id: string, @Body() dto: UpdateBusDto) {
    return this.transportService.updateBus(id, dto);
  }

  @Get('buses')
  @Permissions(Permission.TRANSPORT_READ)
  getAllBuses() {
    return this.transportService.getAllBuses();
  }

  @Get('buses/:id')
  @Permissions(Permission.TRANSPORT_READ)
  getBus(@Param('id') id: string) {
    return this.transportService.getBus(id);
  }

  @Delete('buses/:id')
  @Permissions(Permission.TRANSPORT_ROUTE_DELETE)
  deleteBus(@Param('id') id: string) {
    return this.transportService.deleteBus(id);
  }

  // ─── DRIVER-BUS ASSIGNMENT ────────────────────

  @Patch('drivers/:driverId/assign-bus/:busId')
  @Permissions(Permission.TRANSPORT_ASSIGN)
  assignDriverToBus(
    @Param('driverId') driverId: string,
    @Param('busId') busId: string,
  ) {
    return this.transportService.assignDriverToBus(driverId, busId);
  }

  @Patch('drivers/:driverId/unassign-bus')
  @Permissions(Permission.TRANSPORT_ASSIGN)
  unassignDriverFromBus(@Param('driverId') driverId: string) {
    return this.transportService.unassignDriverFromBus(driverId);
  }
}
