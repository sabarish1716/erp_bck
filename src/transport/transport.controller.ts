import {
  Controller,
  Post,
  Put,
  Get,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { TransportService } from './transport.service';
import { CreateTransportRouteDto, AssignStudentTransportDto } from './dto/transport.dto';
import { UpdateSplClassDatesDto } from './dto/spl-class.dto';
import { Permissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permission.enum';

@Controller('transport')
export class TransportController {
  constructor(private readonly transportService: TransportService) {}

  // ─── ROUTES ───────────────────────────────────

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
}
