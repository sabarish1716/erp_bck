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
  getAllAssignments(@Query('academicYear') academicYear: string) {
    return this.transportService.getAllAssignments(academicYear);
  }

  @Get('fee/:studentId')
  @Permissions(Permission.TRANSPORT_READ)
  getTransportFee(@Param('studentId') studentId: string) {
    return this.transportService.getTransportFeeBreakdown(studentId);
  }
}
