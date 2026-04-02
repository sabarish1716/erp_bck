import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { HrService } from './hr.service';
import { MarkAttendanceDto, BulkMarkAttendanceDto, UpdateAttendanceDto } from './dto/attendance.dto';
import { CreateLeaveTypeDto, ApplyLeaveDto, ApproveLeaveDto, RejectLeaveDto } from './dto/leave.dto';
import { ApplyPermissionDto, ApprovePermissionDto, RejectPermissionDto } from './dto/permission.dto';
import { UpdateStatutorySettingsDto, UpdateStaffStatutoryDto } from './dto/statutory.dto';
import { CreateDeviceDto, UpdateDeviceDto, MapStaffDeviceDto } from './dto/essl.dto';
import { GeneratePayrollDto, ApprovePayrollDto } from './dto/payroll.dto';
import { CreateAdvanceRequestDto, ApproveAdvanceDto, RejectAdvanceDto } from './dto/advance.dto';
import { Permissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permission.enum';

@Controller('hr')
export class HrController {
  constructor(private readonly hrService: HrService) {}

  // ─── DASHBOARD ─────────────────────────────
  @Get('dashboard')
  @Permissions(Permission.HR_DASHBOARD)
  getDashboard() {
    return this.hrService.getDashboard();
  }

  // ─── ATTENDANCE ────────────────────────────
  @Get('attendance')
  @Permissions(Permission.HR_ATTENDANCE_READ)
  getAttendance(
    @Query('date') date?: string,
    @Query('month') month?: string,
    @Query('staffId') staffId?: string,
  ) {
    return this.hrService.getAttendance({ date, month, staffId });
  }

  @Get('attendance/monthly-report/:month')
  @Permissions(Permission.HR_ATTENDANCE_READ)
  getMonthlyReport(@Param('month') month: string) {
    return this.hrService.getMonthlyReport(month);
  }

  @Post('attendance/mark')
  @Permissions(Permission.HR_ATTENDANCE_MANAGE)
  markAttendance(@Body() dto: MarkAttendanceDto) {
    return this.hrService.markAttendance(dto);
  }

  @Post('attendance/bulk-mark')
  @Permissions(Permission.HR_ATTENDANCE_MANAGE)
  bulkMarkAttendance(@Body() dto: BulkMarkAttendanceDto) {
    return this.hrService.bulkMarkAttendance(dto);
  }

  @Put('attendance/:id')
  @Permissions(Permission.HR_ATTENDANCE_MANAGE)
  updateAttendance(@Param('id') id: string, @Body() dto: UpdateAttendanceDto) {
    return this.hrService.updateAttendance(id, dto);
  }

  // ─── LEAVE MANAGEMENT ─────────────────────
  @Get('leave/types')
  @Permissions(Permission.HR_LEAVE_READ)
  getLeaveTypes() {
    return this.hrService.getLeaveTypes();
  }

  @Post('leave/types')
  @Permissions(Permission.HR_LEAVE_MANAGE)
  createLeaveType(@Body() dto: CreateLeaveTypeDto) {
    return this.hrService.createLeaveType(dto);
  }

  @Get('leave/applications')
  @Permissions(Permission.HR_LEAVE_READ)
  getLeaveApplications(
    @Query('status') status?: string,
    @Query('staffId') staffId?: string,
  ) {
    return this.hrService.getLeaveApplications({ status, staffId });
  }

  @Post('leave/apply')
  @Permissions(Permission.HR_LEAVE_MANAGE)
  applyLeave(@Body() dto: ApplyLeaveDto) {
    return this.hrService.applyLeave(dto);
  }

  @Put('leave/:id/approve')
  @Permissions(Permission.HR_LEAVE_APPROVE)
  approveLeave(@Param('id') id: string, @Body() dto: ApproveLeaveDto) {
    return this.hrService.approveLeave(id, dto);
  }

  @Put('leave/:id/reject')
  @Permissions(Permission.HR_LEAVE_APPROVE)
  rejectLeave(@Param('id') id: string, @Body() dto: RejectLeaveDto) {
    return this.hrService.rejectLeave(id, dto);
  }

  @Put('leave/:id/cancel')
  @Permissions(Permission.HR_LEAVE_MANAGE)
  cancelLeave(@Param('id') id: string) {
    return this.hrService.cancelLeave(id);
  }

  @Get('leave/balances')
  @Permissions(Permission.HR_LEAVE_READ)
  getLeaveBalances(
    @Query('staffId') staffId?: string,
    @Query('year') year?: string,
  ) {
    return this.hrService.getLeaveBalances({ staffId, year });
  }

  @Post('leave/balances/init')
  @Permissions(Permission.HR_LEAVE_MANAGE)
  initLeaveBalances(@Body() body: { staffId: string; year: string }) {
    return this.hrService.initLeaveBalances(body.staffId, body.year);
  }

  // ─── PERMISSION (SHORT LEAVE) ─────────────
  @Get('permission')
  @Permissions(Permission.HR_PERMISSION_READ)
  getPermissions(
    @Query('staffId') staffId?: string,
    @Query('month') month?: string,
    @Query('status') status?: string,
  ) {
    return this.hrService.getPermissions({ staffId, month, status });
  }

  @Get('permission/summary/:month')
  @Permissions(Permission.HR_PERMISSION_READ)
  getPermissionSummary(@Param('month') month: string) {
    return this.hrService.getPermissionSummary(month);
  }

  @Post('permission/apply')
  @Permissions(Permission.HR_PERMISSION_MANAGE)
  applyPermission(@Body() dto: ApplyPermissionDto) {
    return this.hrService.applyPermission(dto);
  }

  @Put('permission/:id/approve')
  @Permissions(Permission.HR_PERMISSION_APPROVE)
  approvePermission(@Param('id') id: string, @Body() dto: ApprovePermissionDto) {
    return this.hrService.approvePermission(id, dto);
  }

  @Put('permission/:id/reject')
  @Permissions(Permission.HR_PERMISSION_APPROVE)
  rejectPermission(@Param('id') id: string, @Body() dto: RejectPermissionDto) {
    return this.hrService.rejectPermission(id, dto);
  }

  // ─── STATUTORY (PF / ESI) ─────────────────
  @Get('statutory/settings')
  @Permissions(Permission.HR_STATUTORY_READ)
  getStatutorySettings() {
    return this.hrService.getStatutorySettings();
  }

  @Put('statutory/settings')
  @Permissions(Permission.HR_STATUTORY_MANAGE)
  updateStatutorySettings(@Body() dto: UpdateStatutorySettingsDto) {
    return this.hrService.updateStatutorySettings(dto);
  }

  @Get('statutory/staff')
  @Permissions(Permission.HR_STATUTORY_READ)
  getStaffStatutoryList() {
    return this.hrService.getStaffStatutoryList();
  }

  @Put('statutory/staff/:staffId')
  @Permissions(Permission.HR_STATUTORY_MANAGE)
  updateStaffStatutory(@Param('staffId') staffId: string, @Body() dto: UpdateStaffStatutoryDto) {
    return this.hrService.updateStaffStatutory(staffId, dto);
  }

  @Get('statutory/report/:month')
  @Permissions(Permission.HR_STATUTORY_READ)
  getMonthlyStatutoryReport(@Param('month') month: string) {
    return this.hrService.getMonthlyStatutoryReport(month);
  }

  @Get('statutory/all')
  @Permissions(Permission.HR_STATUTORY_READ)
  getAllStatutoryData() {
    return this.hrService.getAllStatutoryData();
  }
  // ─── ESSL BIOMETRIC ───────────────────────
  @Get('essl/devices')
  @Permissions(Permission.HR_ESSL_READ)
  getDevices() {
    return this.hrService.getDevices();
  }

  @Post('essl/devices')
  @Permissions(Permission.HR_ESSL_MANAGE)
  createDevice(@Body() dto: CreateDeviceDto) {
    return this.hrService.createDevice(dto);
  }

  @Put('essl/devices/:id')
  @Permissions(Permission.HR_ESSL_MANAGE)
  updateDevice(@Param('id') id: string, @Body() dto: UpdateDeviceDto) {
    return this.hrService.updateDevice(id, dto);
  }

  @Delete('essl/devices/:id')
  @Permissions(Permission.HR_ESSL_MANAGE)
  deleteDevice(@Param('id') id: string) {
    return this.hrService.deleteDevice(id);
  }

  @Get('essl/punch-logs')
  @Permissions(Permission.HR_ESSL_READ)
  getPunchLogs(
    @Query('deviceId') deviceId?: string,
    @Query('date') date?: string,
    @Query('staffId') staffId?: string,
  ) {
    return this.hrService.getPunchLogs({ deviceId, date, staffId });
  }

  @Get('essl/staff-mappings')
  @Permissions(Permission.HR_ESSL_READ)
  getStaffMappings() {
    return this.hrService.getStaffMappings();
  }

  @Post('essl/staff-mappings')
  @Permissions(Permission.HR_ESSL_MANAGE)
  mapStaffDevice(@Body() dto: MapStaffDeviceDto) {
    return this.hrService.mapStaffDevice(dto);
  }

  @Delete('essl/staff-mappings/:staffId')
  @Permissions(Permission.HR_ESSL_MANAGE)
  removeStaffMapping(@Param('staffId') staffId: string) {
    return this.hrService.removeStaffMapping(staffId);
  }

  @Post('essl/sync/:deviceId')
  @Permissions(Permission.HR_ESSL_MANAGE)
  syncDevice(@Param('deviceId') deviceId: string) {
    return this.hrService.syncDevice(deviceId);
  }

  @Post('essl/sync-all')
  @Permissions(Permission.HR_ESSL_MANAGE)
  syncAllDevices() {
    return this.hrService.syncAllDevices();
  }

  @Get('essl/sync-history')
  @Permissions(Permission.HR_ESSL_READ)
  getSyncHistory(@Query('deviceId') deviceId?: string) {
    return this.hrService.getSyncHistory({ deviceId });
  }

  // ─── PAYROLL ──────────────────────────────
  @Post('payroll/generate')
  @Permissions(Permission.HR_PAYROLL_MANAGE)
  generatePayroll(@Body() dto: GeneratePayrollDto) {
    return this.hrService.generatePayroll(dto);
  }

  @Get('payroll')
  @Permissions(Permission.HR_PAYROLL_READ)
  getPayrolls(
    @Query('month') month?: string,
    @Query('staffId') staffId?: string,
    @Query('status') status?: string,
  ) {
    return this.hrService.getPayrolls({ month, staffId, status });
  }

  @Get('payroll/:id')
  @Permissions(Permission.HR_PAYROLL_READ)
  getPayroll(@Param('id') id: string) {
    return this.hrService.getPayroll(id);
  }


  @Put('payroll/approve')
  @Permissions(Permission.HR_PAYROLL_APPROVE)
  approvePayrolls(@Body() dto: ApprovePayrollDto) {
    return this.hrService.approvePayrolls(dto);
  }

  @Put('payroll/:id/approve')
  @Permissions(Permission.HR_PAYROLL_APPROVE)
  approvePayroll(@Param('id') id: string) {
    return this.hrService.approvePayroll(id);
  }

  @Get('payroll/lop-report/:month')
  @Permissions(Permission.HR_PAYROLL_READ)
  getLOPReport(@Param('month') month: string) {
    return this.hrService.getLOPReport(month);
  }

  // ─── SALARY ABSTRACT ──────────────────────
  @Get('salary-abstract/:month')
  @Permissions(Permission.HR_PAYROLL_READ)
  getSalaryAbstract(@Param('month') month: string) {
    return this.hrService.getSalaryAbstract(month);
  }

  // ─── ADVANCE / LOAN TICKETS ───────────────
  @Post('advance')
  @Permissions(Permission.HR_PAYROLL_MANAGE)
  createAdvanceRequest(@Body() dto: CreateAdvanceRequestDto) {
    return this.hrService.createAdvanceRequest(dto);
  }

  @Get('advance')
  @Permissions(Permission.HR_PAYROLL_READ)
  getAdvanceRequests(
    @Query('staffId') staffId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.hrService.getAdvanceRequests({ staffId, status, type });
  }

  @Get('advance/:id')
  @Permissions(Permission.HR_PAYROLL_READ)
  getAdvanceRequest(@Param('id') id: string) {
    return this.hrService.getAdvanceRequest(id);
  }

  @Put('advance/:id/approve')
  @Permissions(Permission.HR_PAYROLL_APPROVE)
  approveAdvance(@Param('id') id: string, @Body() dto: ApproveAdvanceDto) {
    return this.hrService.approveAdvance(id, dto.email);
  }

  @Put('advance/:id/reject')
  @Permissions(Permission.HR_PAYROLL_APPROVE)
  rejectAdvance(@Param('id') id: string, @Body() dto: RejectAdvanceDto) {
    return this.hrService.rejectAdvance(id, dto.email, dto.reason);
  }

  @Put('advance/:id/disburse')
  @Permissions(Permission.HR_PAYROLL_MANAGE)
  disburseAdvance(@Param('id') id: string) {
    return this.hrService.disburseAdvance(id);
  }
}
