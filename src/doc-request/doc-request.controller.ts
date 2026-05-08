import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { DocRequestService } from './doc-request.service';
import { CreateDocRequestDto, ReviewDocRequestDto, IssueDocRequestDto } from './create-doc-request.dto';
import { Permissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permission.enum';

@Controller('doc-requests')
export class DocRequestController {
  constructor(private readonly service: DocRequestService) {}

  /** POST /doc-requests — Create a new document request */
  @Post()
  @Permissions(Permission.DOC_REQUEST_CREATE)
  async create(@Body() dto: CreateDocRequestDto, @Req() req: any) {
    return this.service.create(dto, req.user.sub ?? req.user.id);
  }

  /** GET /doc-requests — List all document requests (with optional filters) */
  @Get()
  @Permissions(Permission.DOC_REQUEST_READ)
  async findAll(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.service.findAll({ status, type, studentId });
  }

  /** GET /doc-requests/stats — Dashboard counters */
  @Get('stats')
  @Permissions(Permission.DOC_REQUEST_READ)
  async stats() {
    return this.service.getStats();
  }

  /** GET /doc-requests/bonafide/templates — Template catalog for the four bonafide scenarios */
  @Get('bonafide/templates')
  @Permissions(Permission.DOC_REQUEST_READ)
  async getBonafideTemplates() {
    return this.service.getBonafideTemplates();
  }

  /** GET /doc-requests/:id — Get single request */
  @Get(':id')
  @Permissions(Permission.DOC_REQUEST_READ)
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /** GET /doc-requests/:id/issue-data — Get request + school settings for PDF generation */
  @Get(':id/issue-data')
  @Permissions(Permission.DOC_REQUEST_READ)
  async getIssueData(@Param('id') id: string) {
    return this.service.getIssueData(id);
  }

  /** PATCH /doc-requests/:id/review — Approve / Reject / Mark In-Review */
  @Patch(':id/review')
  @Permissions(Permission.DOC_REQUEST_REVIEW)
  async review(
    @Param('id') id: string,
    @Body() dto: ReviewDocRequestDto,
    @Req() req: any,
  ) {
    return this.service.review(id, dto, req.user.sub ?? req.user.id);
  }

  /** PATCH /doc-requests/:id/issue — Issue the document (mark ISSUED, save TC fields) */
  @Patch(':id/issue')
  @Permissions(Permission.DOC_REQUEST_ISSUE)
  async issue(
    @Param('id') id: string,
    @Body() dto: IssueDocRequestDto,
    @Req() req: any,
  ) {
    return this.service.issue(id, dto, req.user.sub ?? req.user.id);
  }

  /** DELETE /doc-requests/:id — Delete a non-issued request */
  @Delete(':id')
  @Permissions(Permission.DOC_REQUEST_DELETE)
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
