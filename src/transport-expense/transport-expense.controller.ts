import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Res,
  StreamableFile,
  Put,
  Param,
} from '@nestjs/common';
import { TransportExpenseService } from './transport-expense.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import type { Response } from 'express';
import { UpdateActingDriverRateDto } from './dto/update-acting-driver-rate.dto';
import { UpdateActingDriverDaysDto } from './dto/update-acting-driver-days.dto';

const EXPENSE_CATEGORIES = ['FUEL', 'MAINTENANCE', 'PARTS', 'TAX'] as const;
type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

@Controller('transport-expense')
export class TransportExpenseController {
  constructor(private service: TransportExpenseService) {}

  private parseBusIds(busIds?: string | string[]) {
    if (!busIds) {
      return undefined;
    }

    if (Array.isArray(busIds)) {
      return busIds.filter(Boolean);
    }

    return busIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  private parseCategory(category?: string): ExpenseCategory | undefined {
    if (!category) {
      return undefined;
    }

    const normalized = category.toUpperCase();
    if (EXPENSE_CATEGORIES.includes(normalized as ExpenseCategory)) {
      return normalized as ExpenseCategory;
    }

    return undefined;
  }

  @Post()
  create(@Body() dto: CreateExpenseDto) {
    return this.service.create(dto);
  }

  @Get()
  getAll(
    @Query('category') category?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('busIds') busIds?: string | string[],
  ) {
    return this.service.findAll({
      category: this.parseCategory(category),
      from,
      to,
      busIds: this.parseBusIds(busIds),
    });
  }

  @Get('export/excel')
  async exportExcel(
    @Query('category') category: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('busIds') busIds: string | string[] | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.service.exportExcel({
      category: this.parseCategory(category),
      from,
      to,
      busIds: this.parseBusIds(busIds),
    });

    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    return new StreamableFile(file.content);
  }

  @Get('acting-drivers/daily-rate')
  getActingDriverDailyRates() {
    return this.service.getActingDriverDailyRates();
  }

  @Put('acting-drivers/:staffId/daily-rate')
  updateActingDriverDailyRate(
    @Param('staffId') staffId: string,
    @Body() dto: UpdateActingDriverRateDto,
  ) {
    return this.service.updateActingDriverDailyRate(staffId, dto.dailyRate);
  }

  @Get('acting-drivers/manual-days')
  getActingDriverManualDays(@Query('month') month?: string) {
    return this.service.getActingDriverManualDays(month);
  }

  @Put('acting-drivers/:staffId/manual-days')
  updateActingDriverManualDays(
    @Param('staffId') staffId: string,
    @Body() dto: UpdateActingDriverDaysDto,
  ) {
    return this.service.updateActingDriverManualDays(staffId, dto.month, dto.days);
  }
}