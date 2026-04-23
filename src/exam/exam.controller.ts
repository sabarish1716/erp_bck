import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ExamService } from './exam.service';
import {
  AssignInvigilatorDto,
  CreateExamDto,
  CreateExamHallDto,
  CreateExamScheduleDto,
  CreateExamSubjectDto,
  GenerateRollNumbersDto,
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
  autoAllocateSeats(@Param('scheduleId') scheduleId: string) {
    return this.examService.autoAllocateSeats(scheduleId);
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
}
