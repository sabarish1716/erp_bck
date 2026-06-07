import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Standard } from '@prisma/client';
import { ExamService } from './exam.service';
import {
  AssignInvigilatorDto,
  AutoGenerateFullTimetableDto,
  AutoGeneratePeriodsDto,
  CreateExamDto,
  CreateExamHallDto,
  CreateExamScheduleDto,
  CreateExamSubjectDto,
  GenerateRollNumbersDto,
  ManualSeatAllocationDto,
  UpdateExamScheduleCellDto,
  UpdateScheduleTimingDto,
} from './dto/exam.dto';
import { Permissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permission.enum';

@Controller('exam')
export class ExamController {
  constructor(private readonly examService: ExamService) {}

  @Post()
  @Permissions(Permission.EXAM_CREATE)
  createExam(@Body() dto: CreateExamDto) {
    return this.examService.createExam(dto);
  }

  @Get()
  @Permissions(Permission.EXAM_READ)
  getExams(@Query('academicYear') academicYear?: string) {
    return this.examService.getExams(academicYear);
  }

  @Post('subjects')
  @Permissions(Permission.EXAM_SUBJECT_MANAGE)
  createSubject(@Body() dto: CreateExamSubjectDto) {
    return this.examService.createSubject(dto);
  }

  @Get(':examId/subjects')
  @Permissions(Permission.EXAM_READ)
  getSubjects(@Param('examId') examId: string) {
    return this.examService.getSubjects(examId);
  }

  @Post('halls')
  @Permissions(Permission.EXAM_HALL_MANAGE)
  createHall(@Body() dto: CreateExamHallDto) {
    return this.examService.createHall(dto);
  }

  @Get('halls/all')
  @Permissions(Permission.EXAM_READ)
  getHalls() {
    return this.examService.getHalls();
  }

  @Post('timetable')
  @Permissions(Permission.EXAM_TIMETABLE_MANAGE)
  createTimetable(@Body() dto: CreateExamScheduleDto) {
    return this.examService.createTimetable(dto);
  }

  @Get(':examId/timetable')
  @Permissions(Permission.EXAM_READ)
  getTimetable(@Param('examId') examId: string) {
    return this.examService.getTimetable(examId);
  }

  @Post(':examId/auto-full')
  @Permissions(Permission.EXAM_TIMETABLE_MANAGE)
  autoGenerateFullTimetable(@Param('examId') examId: string, @Body() dto: AutoGenerateFullTimetableDto) {
    return this.examService.autoGenerateFullTimetable(examId, dto);
  }

  @Get(':examId/class')
  @Permissions(Permission.EXAM_READ)
  getClassTimetableByQuery(
    @Param('examId') examId: string,
    @Query('standard') standard: Standard,
    @Query('section') section?: string,
  ) {
    return this.examService.getClassTimetable(examId, standard, section);
  }

  @Get(':examId/teacher')
  @Permissions(Permission.EXAM_READ)
  getTeacherTimetableByQuery(@Param('examId') examId: string, @Query('teacherId') teacherId: string) {
    return this.examService.getTeacherTimetable(examId, teacherId);
  }

  @Patch('schedule/:id')
  @Permissions(Permission.EXAM_TIMETABLE_MANAGE)
  updateScheduleCell(@Param('id') id: string, @Body() dto: UpdateExamScheduleCellDto) {
    return this.examService.updateScheduleCell(id, dto);
  }

  @Delete(':examId/timetable')
  @Permissions(Permission.EXAM_TIMETABLE_MANAGE)
  resetTimetable(@Param('examId') examId: string) {
    return this.examService.resetTimetable(examId);
  }

  @Post(':examId/roll-numbers/generate')
  @Permissions(Permission.EXAM_ROLL_GENERATE)
  generateRollNumbers(@Param('examId') examId: string, @Body() dto: GenerateRollNumbersDto) {
    return this.examService.generateRollNumbers(examId, dto);
  }

  @Get(':examId/roll-numbers')
  @Permissions(Permission.EXAM_READ)
  getRollNumbers(@Param('examId') examId: string) {
    return this.examService.getRollNumbers(examId);
  }

  @Post('timetable/:scheduleId/seat-allocation/auto')
  @Permissions(Permission.EXAM_SEAT_ALLOCATE)
  autoAllocateSeats(@Param('scheduleId') scheduleId: string, @Body() body: { hallIds: string[] }) {
    return this.examService.autoAllocateSeats(scheduleId, body.hallIds);
  }

  /** Manual seat allocation: mix two standards per hall with configurable counts */
  @Post('timetable/:scheduleId/seat-allocation/manual')
  @Permissions(Permission.EXAM_SEAT_ALLOCATE)
  manualAllocateSeats(@Param('scheduleId') scheduleId: string, @Body() dto: ManualSeatAllocationDto) {
    return this.examService.manualAllocateSeats(scheduleId, dto);
  }

  /** Update exam start/end timings for a schedule slot */
  @Patch('schedule/:id/timing')
  @Permissions(Permission.EXAM_TIMETABLE_MANAGE)
  updateScheduleTiming(@Param('id') id: string, @Body() dto: UpdateScheduleTimingDto) {
    return this.examService.updateScheduleTiming(id, dto);
  }

  @Get('timetable/:scheduleId/seat-allocation')
  @Permissions(Permission.EXAM_READ)
  getSeatAllocations(@Param('scheduleId') scheduleId: string) {
    return this.examService.getSeatAllocations(scheduleId);
  }

  @Get('invigilators/candidates')
  @Permissions(Permission.EXAM_READ)
  getInvigilatorCandidates() {
    return this.examService.getInvigilatorCandidates();
  }

  @Get('timetable/:scheduleId/invigilators')
  @Permissions(Permission.EXAM_READ)
  getInvigilatorAssignments(@Param('scheduleId') scheduleId: string) {
    return this.examService.getInvigilatorAssignments(scheduleId);
  }

  @Post('timetable/:scheduleId/invigilators')
  @Permissions(Permission.EXAM_SEAT_ALLOCATE)
  assignInvigilator(@Param('scheduleId') scheduleId: string, @Body() dto: AssignInvigilatorDto) {
    return this.examService.assignInvigilator(scheduleId, dto);
  }

  /** Get timetable for a specific class */
  @Get(':examId/timetable/class/:standard')
  @Permissions(Permission.EXAM_READ)
  getClassTimetable(
    @Param('examId') examId: string,
    @Param('standard') standard: Standard,
    @Query('section') section?: string,
  ) {
    return this.examService.getClassTimetable(examId, standard, section);
  }

  /** Get timetable for a specific teacher */
  @Get(':examId/timetable/teacher/:staffId')
  @Permissions(Permission.EXAM_READ)
  getTeacherTimetable(@Param('examId') examId: string, @Param('staffId') staffId: string) {
    return this.examService.getTeacherTimetable(examId, staffId);
  }

  /** Auto-generate period blocks for a subject based on marks pattern and class group */
  @Post(':examId/timetable/auto-generate-periods')
  @Permissions(Permission.EXAM_TIMETABLE_MANAGE)
  autoGeneratePeriods(@Param('examId') examId: string, @Body() dto: AutoGeneratePeriodsDto) {
    return this.examService.autoGeneratePeriods(examId, dto);
  }
}
