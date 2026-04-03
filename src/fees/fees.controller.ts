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
import { FeesService } from './fees.service';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { AssignFeeDto } from './dto/assign-fee.dto';
import { CollectPaymentDto } from './dto/collect-payment.dto';
import { CancelPaymentDto, RefundPaymentDto } from './dto/payment-status.dto';
import { IssueKitItemDto } from './dto/kit-issue.dto';
import { Permissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permission.enum';

@Controller('fees')
export class FeesController {
  constructor(private readonly feesService: FeesService) {}

  // ─── FEE STRUCTURE ────────────────────────────

  @Post('structures')
  @Permissions(Permission.FEES_STRUCTURE_CREATE)
  createStructure(@Body() dto: CreateFeeStructureDto) {
    return this.feesService.createFeeStructure(dto);
  }

  @Put('structures/:id')
  @Permissions(Permission.FEES_STRUCTURE_UPDATE)
  updateStructure(@Param('id') id: string, @Body() dto: CreateFeeStructureDto) {
    return this.feesService.updateFeeStructure(id, dto);
  }

  @Get('structures')
  @Permissions(Permission.FEES_STRUCTURE_READ)
  getAllStructures() {
    return this.feesService.getAllFeeStructures();
  }

  @Get('structures/:id')
  @Permissions(Permission.FEES_STRUCTURE_READ)
  getStructure(@Param('id') id: string) {
    return this.feesService.getFeeStructure(id);
  }

  @Get('structures/by-standard/:standard')
  @Permissions(Permission.FEES_STRUCTURE_READ)
  getStructureByStandard(
    @Param('standard') standard: string,
    @Query('academicYear') academicYear: string,
  ) {
    return this.feesService.getFeeStructureByStandard(standard, academicYear);
  }

  @Delete('structures/:id')
  @Permissions(Permission.FEES_STRUCTURE_DELETE)
  deleteStructure(@Param('id') id: string) {
    return this.feesService.deleteFeeStructure(id);
  }

  // ─── STUDENT FEE ASSIGNMENT ───────────────────

  @Post('assign')
  @Permissions(Permission.FEES_ASSIGN)
  assignFee(@Body() dto: AssignFeeDto) {
    return this.feesService.assignFeeToStudent(dto);
  }

  @Post('assign-class')
  @Permissions(Permission.FEES_ASSIGN)
  assignFeeToClass(
    @Body() dto: { standard: string; section?: string; academicYear: string; autoTeacherDiscount?: boolean; autoSiblingDiscount?: boolean; autoRteDiscount?: boolean },
  ) {
    return this.feesService.assignFeeToClass(dto);
  }

  @Get('pending-total/:studentId')
  @Permissions(Permission.FEES_READ)
  getStudentPendingTotal(@Param('studentId') studentId: string) {
    return this.feesService.getStudentPendingTotal(studentId).then((pending) => ({ studentId, pending }));
  }

  @Get('discount-eligibility/:studentId')
  @Permissions(Permission.FEES_READ)
  checkDiscountEligibility(@Param('studentId') studentId: string) {
    return this.feesService.checkDiscountEligibility(studentId);
  }

  @Put('student-fees/:id')
  @Permissions(Permission.FEES_ASSIGN)
  updateStudentFee(@Param('id') id: string, @Body() dto: AssignFeeDto) {
    return this.feesService.updateStudentFee(id, dto);
  }

  @Get('student/:studentId')
  @Permissions(Permission.FEES_READ)
  getStudentFee(
    @Param('studentId') studentId: string,
    @Query('academicYear') academicYear: string,
  ) {
    return this.feesService.getStudentFee(studentId, academicYear);
  }

  @Get('student-fees/:id')
  @Permissions(Permission.FEES_READ)
  getStudentFeeById(@Param('id') id: string) {
    return this.feesService.getStudentFeeById(id);
  }

  @Get('all')
  @Permissions(Permission.FEES_READ)
  getAllStudentFees(@Query('academicYear') academicYear: string) {
    return this.feesService.getAllStudentFees(academicYear);
  }

  // ─── PAYMENT COLLECTION ───────────────────────

  @Post('collect')
  @Permissions(Permission.FEES_COLLECT)
  collectPayment(@Body() dto: CollectPaymentDto) {
    return this.feesService.collectPayment(dto);
  }

  @Get('payments/:studentFeeId')
  @Permissions(Permission.FEES_READ)
  getPayments(@Param('studentFeeId') studentFeeId: string) {
    return this.feesService.getPaymentsByStudentFee(studentFeeId);
  }

  @Patch('payments/:paymentId/cancel')
  @Permissions(Permission.FEES_COLLECT)
  cancelPayment(
    @Param('paymentId') paymentId: string,
    @Body() dto: CancelPaymentDto,
  ) {
    return this.feesService.cancelPayment(paymentId, dto);
  }

  @Patch('payments/:paymentId/refund')
  @Permissions(Permission.FEES_COLLECT)
  refundPayment(
    @Param('paymentId') paymentId: string,
    @Body() dto: RefundPaymentDto,
  ) {
    return this.feesService.refundPayment(paymentId, dto);
  }

  @Get('next-receipt-no')
  @Permissions(Permission.FEES_READ)
  getNextReceiptNo() {
    return this.feesService.getNextReceiptNo();
  }

  @Get('academic-years')
  @Permissions(Permission.FEES_STRUCTURE_READ)
  getAcademicYears() {
    return this.feesService.getAcademicYears();
  }

  @Post('recalc-transport/:studentId')
  @Permissions(Permission.FEES_STRUCTURE_READ)
  recalcTransportFee(
    @Param('studentId') studentId: string,
    @Query('academicYear') academicYear: string,
  ) {
    return this.feesService.recalcTransportFee(studentId, academicYear);
  }

  // ─── KIT / BOOK FEE MANAGEMENT ─────────────────

  @Post('kit/issue')
  @Permissions(Permission.FEES_COLLECT)
  issueKitItem(@Body() dto: IssueKitItemDto) {
    return this.feesService.issueKitItem(dto);
  }

  @Get('kit/:studentFeeId')
  @Permissions(Permission.FEES_READ)
  getStudentKitIssues(@Param('studentFeeId') studentFeeId: string) {
    return this.feesService.getStudentKitIssues(studentFeeId);
  }

  @Delete('kit/:kitIssueId')
  @Permissions(Permission.FEES_COLLECT)
  removeKitIssue(@Param('kitIssueId') kitIssueId: string) {
    return this.feesService.removeKitIssue(kitIssueId);
  }

  // ─── REPORTS / DASHBOARD ──────────────────────

  @Get('pending')
  @Permissions(Permission.FEES_DASHBOARD)
  getPendingFees(@Query('academicYear') academicYear: string) {
    return this.feesService.getPendingFees(academicYear);
  }

  @Get('daily-collection')
  @Permissions(Permission.FEES_DASHBOARD)
  getDailyCollection(@Query('date') date?: string) {
    return this.feesService.getDailyCollection(date);
  }

  @Get('dashboard')
  @Permissions(Permission.FEES_DASHBOARD)
  getDashboard(@Query('academicYear') academicYear: string) {
    return this.feesService.getFeesDashboard(academicYear);
  }

  @Get('multi-year-ledger')
  @Permissions(Permission.FEES_DASHBOARD)
  getMultiYearLedger() {
    return this.feesService.getMultiYearLedger();
  }

  @Get('class-summary')
  @Permissions(Permission.FEES_DASHBOARD)
  getClassWiseSummary(@Query('academicYear') academicYear: string) {
    return this.feesService.getClassWiseSummary(academicYear);
  }
}
