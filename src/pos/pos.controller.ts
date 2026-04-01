import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { PosService } from './pos.service';
import { Permissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permission.enum';
import { CreateStoreDto, UpdateStoreDto } from './dto/store.dto';
import { CreateStoreItemDto, UpdateStoreItemDto } from './dto/store-item.dto';
import { CreateSupplierDto, UpdateSupplierDto, CreatePurchaseDto } from './dto/purchase.dto';
import { CreateStockTransferDto } from './dto/stock-transfer.dto';
import { CreateSaleDto } from './dto/sale.dto';
import { GiveTeacherFreeItemDto, ReturnTeacherFreeItemDto } from './dto/teacher-free-item.dto';
import { CreatePosTransactionDto } from './dto/pos-transaction.dto';

const imageStorage = diskStorage({
  destination: './uploads/pos',
  filename: (_req, file, cb) =>
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`),
});

@Controller('pos')
export class PosController {
  constructor(private readonly posService: PosService) {}

  // ─── STORES ────────────────────────────────────

  @Post('stores')
  @Permissions(Permission.POS_MANAGE)
  createStore(@Body() dto: CreateStoreDto) {
    return this.posService.createStore(dto);
  }

  @Put('stores/:id')
  @Permissions(Permission.POS_MANAGE)
  updateStore(@Param('id') id: string, @Body() dto: UpdateStoreDto) {
    return this.posService.updateStore(id, dto);
  }

  @Get('stores')
  @Permissions(Permission.POS_READ)
  getAllStores() {
    return this.posService.getAllStores();
  }

  @Get('stores/:id')
  @Permissions(Permission.POS_READ)
  getStore(@Param('id') id: string) {
    return this.posService.getStore(id);
  }

  // ─── STORE ITEMS (CATALOG) ─────────────────────

  @Post('items')
  @Permissions(Permission.POS_MANAGE)
  createStoreItem(@Body() dto: CreateStoreItemDto) {
    return this.posService.createStoreItem(dto);
  }

  @Put('items/:id')
  @Permissions(Permission.POS_MANAGE)
  updateStoreItem(@Param('id') id: string, @Body() dto: UpdateStoreItemDto) {
    return this.posService.updateStoreItem(id, dto);
  }

  @Get('items')
  @Permissions(Permission.POS_READ)
  getAllStoreItems(@Query('category') category?: string) {
    return this.posService.getAllStoreItems(category);
  }

  @Get('items/:id')
  @Permissions(Permission.POS_READ)
  getStoreItem(@Param('id') id: string) {
    return this.posService.getStoreItem(id);
  }

  @Delete('items/:id')
  @Permissions(Permission.POS_MANAGE)
  deleteStoreItem(@Param('id') id: string) {
    return this.posService.deleteStoreItem(id);
  }

  @Post('items/:id/image')
  @Permissions(Permission.POS_MANAGE)
  @UseInterceptors(FileInterceptor('image', { storage: imageStorage }))
  async uploadItemImage(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) return { error: 'No file uploaded' };
    return this.posService.updateStoreItem(id, { image: file.path });
  }

  // ─── SUPPLIERS ─────────────────────────────────

  @Post('suppliers')
  @Permissions(Permission.POS_MANAGE)
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.posService.createSupplier(dto);
  }

  @Put('suppliers/:id')
  @Permissions(Permission.POS_MANAGE)
  updateSupplier(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.posService.updateSupplier(id, dto);
  }

  @Get('suppliers')
  @Permissions(Permission.POS_READ)
  getAllSuppliers() {
    return this.posService.getAllSuppliers();
  }

  @Get('suppliers/:id')
  @Permissions(Permission.POS_READ)
  getSupplier(@Param('id') id: string) {
    return this.posService.getSupplier(id);
  }

  // ─── PURCHASES ─────────────────────────────────

  @Post('purchases')
  @Permissions(Permission.POS_PURCHASE)
  createPurchase(@Body() dto: CreatePurchaseDto) {
    return this.posService.createPurchase(dto);
  }

  @Get('purchases')
  @Permissions(Permission.POS_READ)
  getAllPurchases() {
    return this.posService.getAllPurchases();
  }

  @Get('purchases/:id')
  @Permissions(Permission.POS_READ)
  getPurchase(@Param('id') id: string) {
    return this.posService.getPurchase(id);
  }

  @Post('purchases/:id/receipt')
  @Permissions(Permission.POS_PURCHASE)
  @UseInterceptors(FileInterceptor('receipt', { storage: imageStorage }))
  async uploadPurchaseReceipt(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) return { error: 'No file uploaded' };
    return this.posService.updatePurchaseReceipt(id, file.path);
  }

  // ─── STOCK TRANSFERS ──────────────────────────

  @Post('transfers')
  @Permissions(Permission.POS_MANAGE)
  createStockTransfer(@Body() dto: CreateStockTransferDto) {
    return this.posService.createStockTransfer(dto);
  }

  @Get('transfers')
  @Permissions(Permission.POS_READ)
  getAllStockTransfers() {
    return this.posService.getAllStockTransfers();
  }

  // ─── SALES ─────────────────────────────────────

  @Post('sales')
  @Permissions(Permission.POS_SELL)
  createSale(@Body() dto: CreateSaleDto) {
    return this.posService.createSale(dto);
  }

  @Get('sales')
  @Permissions(Permission.POS_READ)
  getAllSales(
    @Query('storeId') storeId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.posService.getAllSales(storeId, from, to);
  }

  @Get('sales/:id')
  @Permissions(Permission.POS_READ)
  getSale(@Param('id') id: string) {
    return this.posService.getSale(id);
  }

  // ─── TEACHER FREE ITEMS ───────────────────────

  @Post('teacher-free-items/give')
  @Permissions(Permission.POS_MANAGE)
  giveTeacherFreeItem(@Body() dto: GiveTeacherFreeItemDto) {
    return this.posService.giveTeacherFreeItem(dto);
  }

  @Post('teacher-free-items/return')
  @Permissions(Permission.POS_MANAGE)
  returnTeacherFreeItem(@Body() dto: ReturnTeacherFreeItemDto) {
    return this.posService.returnTeacherFreeItem(dto);
  }

  @Get('teacher-free-items')
  @Permissions(Permission.POS_READ)
  getTeacherFreeItems(
    @Query('staffId') staffId?: string,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.posService.getTeacherFreeItems(staffId, academicYear);
  }

  @Get('teacher-free-items/summary/:staffId')
  @Permissions(Permission.POS_READ)
  getTeacherFreeItemSummary(
    @Param('staffId') staffId: string,
    @Query('academicYear') academicYear: string,
  ) {
    return this.posService.getTeacherFreeItemSummary(staffId, academicYear);
  }

  // ─── POS TRANSACTIONS (INCOME / EXPENSE) ─────

  @Post('transactions')
  @Permissions(Permission.POS_MANAGE)
  createPosTransaction(@Body() dto: CreatePosTransactionDto) {
    return this.posService.createPosTransaction(dto);
  }

  @Get('transactions')
  @Permissions(Permission.POS_READ)
  getAllPosTransactions(
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.posService.getAllPosTransactions(type, from, to);
  }

  // ─── STOCK OVERVIEW ───────────────────────────

  @Get('stock')
  @Permissions(Permission.POS_READ)
  getStockOverview(@Query('storeId') storeId?: string) {
    return this.posService.getStockOverview(storeId);
  }

  // ─── DASHBOARD ────────────────────────────────

  @Get('dashboard')
  @Permissions(Permission.POS_DASHBOARD)
  getPosDashboard(@Query('from') from?: string, @Query('to') to?: string) {
    return this.posService.getPosDashboard(from, to);
  }
}
