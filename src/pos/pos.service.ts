import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateStoreDto, UpdateStoreDto } from './dto/store.dto';
import {
  CreateStoreItemDto,
  UpdateStoreItemDto,
  CreateItemCategoryDto,
} from './dto/store-item.dto';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  CreatePurchaseDto,
} from './dto/purchase.dto';
import { CreateStockTransferDto } from './dto/stock-transfer.dto';
import { CreateSaleDto } from './dto/sale.dto';
import {
  GiveTeacherFreeItemDto,
  ReturnTeacherFreeItemDto,
} from './dto/teacher-free-item.dto';
import { CreatePosTransactionDto } from './dto/pos-transaction.dto';

@Injectable()
export class PosService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════
  // STORES
  // ═══════════════════════════════════════════════

  async createStore(data: CreateStoreDto) {
    if (data.isMaster) {
      const existing = await this.prisma.store.findFirst({
        where: { isMaster: true },
      });
      if (existing)
        throw new BadRequestException('A master store already exists');
    }
    return this.prisma.store.create({ data });
  }

  async updateStore(id: string, data: UpdateStoreDto) {
    return this.prisma.store.update({ where: { id }, data });
  }

  async getAllStores() {
    return this.prisma.store.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async getStore(id: string) {
    const store = await this.prisma.store.findUnique({
      where: { id },
      include: { stockItems: { include: { item: true } } },
    });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  // ═══════════════════════════════════════════════
  // CATEGORIES
  // ═══════════════════════════════════════════════

  async createCategory(data: CreateItemCategoryDto) {
    const existing = await this.prisma.itemCategory.findUnique({
      where: { name: data.name },
    });
    if (existing) {
      throw new BadRequestException(`Category "${data.name}" already exists`);
    }
    return this.prisma.itemCategory.create({ data });
  }

  async getAllCategories() {
    return this.prisma.itemCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  // ═══════════════════════════════════════════════
  // STORE ITEMS (CATALOG)
  // ═══════════════════════════════════════════════

  async createStoreItem(data: CreateStoreItemDto) {
    return this.prisma.storeItem.create({
      data: {
        name: data.name,
        sku: data.sku,
        categoryId: data.categoryId,
        description: data.description,
        image: data.image,
        unit: data.unit || 'pcs',
        sellingPrice: data.sellingPrice || 0,
        costPrice: data.costPrice || 0,
        reorderLevel: data.reorderLevel ?? 5,
        isFreeEligible: data.isFreeEligible || false,
        freeLimit: data.freeLimit || 0,
      },
    });
  }

  async updateStoreItem(id: string, data: UpdateStoreItemDto) {
    return this.prisma.storeItem.update({
      where: { id },
      data,
    });
  }

  async getAllStoreItems(category?: string, storeId?: string) {
    if (storeId) {
      // Find all stock entries for this store, include item details
      const stockItems = await this.prisma.storeStock.findMany({
        where: {
          storeId,
          item: { isActive: true, categoryId: category ? category : undefined },
        },
        include: { item: { include: { category: true } } },
      });
      // Optionally filter by category
      return category
        ? stockItems.filter((s) => s.item.categoryId === category)
        : stockItems;
    } else {
      // Fallback: all items, optionally by category, only isActive
      const where: any = { isActive: true };
      if (category) where.categoryId = category;
      return this.prisma.storeItem.findMany({
        where,
        orderBy: { name: 'asc' },
        include: { category: true, stockItems: { include: { store: true } } },
      });
    }
  }

  async getStoreItem(id: string) {
    const item = await this.prisma.storeItem.findUnique({
      where: { id },
      include: { category: true, stockItems: { include: { store: true } } },
    });
    if (!item) throw new NotFoundException('Store item not found');
    return item;
  }

  async deleteStoreItem(id: string) {
    return this.prisma.storeItem.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ═══════════════════════════════════════════════
  // SUPPLIERS
  // ═══════════════════════════════════════════════

  async createSupplier(data: CreateSupplierDto) {
    return this.prisma.supplier.create({ data });
  }

  async updateSupplier(id: string, data: UpdateSupplierDto) {
    return this.prisma.supplier.update({ where: { id }, data });
  }

  async getAllSuppliers() {
    return this.prisma.supplier.findMany({ orderBy: { name: 'asc' } });
  }

  async getSupplier(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: { purchases: { orderBy: { invoiceDate: 'desc' }, take: 20 } },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  // ═══════════════════════════════════════════════
  // PURCHASES (BUY GOODS FROM SUPPLIER)
  // ═══════════════════════════════════════════════

  async createPurchase(data: CreatePurchaseDto) {
    if (!data.items?.length)
      throw new BadRequestException('At least one item is required');

    const store = await this.prisma.store.findUnique({
      where: { id: data.storeId },
    });
    if (!store) throw new NotFoundException('Store not found');

    const supplier = await this.prisma.supplier.findUnique({
      where: { id: data.supplierId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    return this.prisma.$transaction(async (tx) => {
      let totalAmount = 0;
      const itemsData: any[] = [];

      for (const item of data.items) {
        const storeItem = await tx.storeItem.findUnique({
          where: { id: item.itemId },
        });
        if (!storeItem)
          throw new NotFoundException(`Item ${item.itemId} not found`);

        const lineTotal = item.quantity * item.unitPrice;
        totalAmount += lineTotal;
        itemsData.push({
          itemId: item.itemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: lineTotal,
        });

        // Update stock
        await tx.storeStock.upsert({
          where: {
            storeId_itemId: { storeId: data.storeId, itemId: item.itemId },
          },
          update: { quantity: { increment: item.quantity } },
          create: {
            storeId: data.storeId,
            itemId: item.itemId,
            quantity: item.quantity,
          },
        });
      }

      let nextInvoice = data.invoiceNo;
      if (!nextInvoice) {
        const lastPurchase = await tx.purchase.findFirst({
          where: { invoiceNo: { startsWith: 'PO-' } },
          orderBy: { createdAt: 'desc' },
          select: { invoiceNo: true },
        });
        nextInvoice = 'PO-0001';
        if (lastPurchase?.invoiceNo) {
          const match = lastPurchase.invoiceNo.match(/PO-(\d+)/);
          if (match)
            nextInvoice = `PO-${String(parseInt(match[1], 10) + 1).padStart(4, '0')}`;
        }
      }

      const purchase = await tx.purchase.create({
        data: {
          supplierId: data.supplierId,
          storeId: data.storeId,
          invoiceNo: nextInvoice,
          invoiceDate: data.invoiceDate
            ? new Date(data.invoiceDate)
            : new Date(),
          receiptImage: data.receiptImage,
          totalAmount,
          remarks: data.remarks,
          items: { create: itemsData },
        },
        include: { items: { include: { item: true } }, supplier: true },
      });

      // Auto-create expense transaction
      await tx.posTransaction.create({
        data: {
          type: 'EXPENSE',
          category: 'PURCHASE',
          description: `Purchase from ${supplier.name} — Invoice: ${nextInvoice}`,
          amount: totalAmount,
          date: data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
          referenceId: purchase.id,
        },
      });

      return purchase;
    });
  }

  async getAllPurchases() {
    return this.prisma.purchase.findMany({
      include: { supplier: true, items: { include: { item: true } } },
      orderBy: { invoiceDate: 'desc' },
    });
  }

  async getPurchase(id: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: { supplier: true, items: { include: { item: true } } },
    });
    if (!purchase) throw new NotFoundException('Purchase not found');
    return purchase;
  }

  async updatePurchaseReceipt(id: string, receiptImage: string) {
    return this.prisma.purchase.update({
      where: { id },
      data: { receiptImage },
    });
  }

  // ═══════════════════════════════════════════════
  // STOCK TRANSFERS (MASTER → SHOP)
  // ═══════════════════════════════════════════════

  async createStockTransfer(data: CreateStockTransferDto) {
    if (!data.items?.length)
      throw new BadRequestException('At least one item is required');
    if (data.fromStoreId === data.toStoreId)
      throw new BadRequestException('Cannot transfer to the same store');

    return this.prisma.$transaction(async (tx) => {
      const itemsData: any[] = [];

      for (const item of data.items) {
        // Check source stock
        const sourceStock = await tx.storeStock.findUnique({
          where: {
            storeId_itemId: { storeId: data.fromStoreId, itemId: item.itemId },
          },
        });
        if (!sourceStock || sourceStock.quantity < item.quantity) {
          const storeItem = await tx.storeItem.findUnique({
            where: { id: item.itemId },
          });
          throw new BadRequestException(
            `Insufficient stock for "${storeItem?.name || item.itemId}" (available: ${sourceStock?.quantity || 0}, requested: ${item.quantity})`,
          );
        }

        // Deduct from source
        await tx.storeStock.update({
          where: {
            storeId_itemId: { storeId: data.fromStoreId, itemId: item.itemId },
          },
          data: { quantity: { decrement: item.quantity } },
        });

        // Add to destination
        await tx.storeStock.upsert({
          where: {
            storeId_itemId: { storeId: data.toStoreId, itemId: item.itemId },
          },
          update: { quantity: { increment: item.quantity } },
          create: {
            storeId: data.toStoreId,
            itemId: item.itemId,
            quantity: item.quantity,
          },
        });

        itemsData.push({ itemId: item.itemId, quantity: item.quantity });
      }

      return tx.stockTransfer.create({
        data: {
          fromStoreId: data.fromStoreId,
          toStoreId: data.toStoreId,
          remarks: data.remarks,
          items: { create: itemsData },
        },
        include: {
          fromStore: true,
          toStore: true,
          items: { include: { item: true } },
        },
      });
    });
  }

  async getAllStockTransfers() {
    return this.prisma.stockTransfer.findMany({
      include: {
        fromStore: true,
        toStore: true,
        items: { include: { item: true } },
      },
      orderBy: { transferDate: 'desc' },
    });
  }

  // ═══════════════════════════════════════════════
  // SALES (POS)
  // ═══════════════════════════════════════════════

  async createSale(data: CreateSaleDto) {
    if (!data.items?.length)
      throw new BadRequestException('At least one item is required');

    return this.prisma.$transaction(async (tx) => {
      let totalAmount = 0;
      const itemsData: any[] = [];

      for (const item of data.items) {
        const storeItem = await tx.storeItem.findUnique({
          where: { id: item.itemId },
        });
        if (!storeItem)
          throw new NotFoundException(`Item ${item.itemId} not found`);

        const unitPrice = item.unitPrice ?? storeItem.sellingPrice;
        const lineTotal = item.quantity * unitPrice;
        totalAmount += lineTotal;
        itemsData.push({
          itemId: item.itemId,
          quantity: item.quantity,
          unitPrice,
          totalPrice: lineTotal,
        });

        // Deduct from store stock
        const stock = await tx.storeStock.findUnique({
          where: {
            storeId_itemId: { storeId: data.storeId, itemId: item.itemId },
          },
        });
        if (!stock || stock.quantity < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${storeItem.name}" (available: ${stock?.quantity || 0}, requested: ${item.quantity})`,
          );
        }
        await tx.storeStock.update({
          where: {
            storeId_itemId: { storeId: data.storeId, itemId: item.itemId },
          },
          data: { quantity: { decrement: item.quantity } },
        });
      }

      const discount = data.discount || 0;
      const netAmount = totalAmount - discount;

      // Generate invoice number
      const lastSale = await tx.sale.findFirst({
        where: { invoiceNo: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { invoiceNo: true },
      });
      let nextInvoice = 'INV-0001';
      if (lastSale?.invoiceNo) {
        const match = lastSale.invoiceNo.match(/INV-(\d+)/);
        if (match)
          nextInvoice = `INV-${String(parseInt(match[1], 10) + 1).padStart(4, '0')}`;
      }

      const sale = await tx.sale.create({
        data: {
          storeId: data.storeId,
          invoiceNo: nextInvoice,
          customerName: data.customerName,
          customerType: data.customerType || 'WALK_IN',
          paymentMode: data.paymentMode || 'CASH',
          totalAmount,
          discount,
          netAmount,
          remarks: data.remarks,
          items: { create: itemsData },
        },
        include: { items: { include: { item: true } }, store: true },
      });

      // Auto-create income transaction
      await tx.posTransaction.create({
        data: {
          type: 'INCOME',
          category: 'SALE',
          description: `Sale ${nextInvoice} — ${data.customerName || 'Walk-in'}`,
          amount: netAmount,
          referenceId: sale.id,
        },
      });

      return sale;
    });
  }

  async getAllSales(storeId?: string, from?: string, to?: string) {
    const where: any = {};
    if (storeId) where.storeId = storeId;
    if (from || to) {
      where.saleDate = {};
      if (from) where.saleDate.gte = new Date(from);
      if (to) where.saleDate.lte = new Date(to + 'T23:59:59.999Z');
    }
    return this.prisma.sale.findMany({
      where,
      include: { items: { include: { item: true } }, store: true },
      orderBy: { saleDate: 'desc' },
    });
  }

  async getSale(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: { items: { include: { item: true } }, store: true },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return sale;
  }

  // ═══════════════════════════════════════════════
  // TEACHER FREE ITEMS
  // ═══════════════════════════════════════════════

  async giveTeacherFreeItem(data: GiveTeacherFreeItemDto) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: data.staffId },
    });
    if (!staff) throw new NotFoundException('Staff not found');

    const item = await this.prisma.storeItem.findUnique({
      where: { id: data.itemId },
    });
    if (!item) throw new NotFoundException('Item not found');
    if (!item.isFreeEligible)
      throw new BadRequestException(
        `"${item.name}" is not eligible for free distribution`,
      );

    // Check limit: total given this year minus returned
    const existing = await this.prisma.teacherFreeItem.findMany({
      where: {
        staffId: data.staffId,
        itemId: data.itemId,
        academicYear: data.academicYear,
      },
    });
    const totalGiven = existing.reduce((s, e) => s + e.quantityGiven, 0);
    const totalReturned = existing.reduce((s, e) => s + e.quantityReturned, 0);
    const netHeld = totalGiven - totalReturned;

    if (netHeld + data.quantity > item.freeLimit) {
      throw new BadRequestException(
        `Limit exceeded for "${item.name}". Max: ${item.freeLimit}, already held: ${netHeld}, requesting: ${data.quantity}`,
      );
    }

    // Deduct from master store stock
    const masterStore = await this.prisma.store.findFirst({
      where: { isMaster: true },
    });
    if (!masterStore)
      throw new BadRequestException('No master store configured');

    const stock = await this.prisma.storeStock.findUnique({
      where: {
        storeId_itemId: { storeId: masterStore.id, itemId: data.itemId },
      },
    });
    if (!stock || stock.quantity < data.quantity) {
      throw new BadRequestException(
        `Insufficient master store stock for "${item.name}"`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.storeStock.update({
        where: {
          storeId_itemId: { storeId: masterStore.id, itemId: data.itemId },
        },
        data: { quantity: { decrement: data.quantity } },
      });

      return tx.teacherFreeItem.create({
        data: {
          staffId: data.staffId,
          itemId: data.itemId,
          academicYear: data.academicYear,
          quantityGiven: data.quantity,
        },
        include: { staff: true, item: true },
      });
    });
  }

  async returnTeacherFreeItem(data: ReturnTeacherFreeItemDto) {
    const record = await this.prisma.teacherFreeItem.findUnique({
      where: { id: data.teacherFreeItemId },
      include: { item: true },
    });
    if (!record)
      throw new NotFoundException('Teacher free item record not found');

    const canReturn = record.quantityGiven - record.quantityReturned;
    if (data.quantity > canReturn) {
      throw new BadRequestException(
        `Can only return up to ${canReturn} of "${record.item.name}"`,
      );
    }

    const masterStore = await this.prisma.store.findFirst({
      where: { isMaster: true },
    });
    if (!masterStore)
      throw new BadRequestException('No master store configured');

    return this.prisma.$transaction(async (tx) => {
      // Return stock to master store
      await tx.storeStock.upsert({
        where: {
          storeId_itemId: { storeId: masterStore.id, itemId: record.itemId },
        },
        update: { quantity: { increment: data.quantity } },
        create: {
          storeId: masterStore.id,
          itemId: record.itemId,
          quantity: data.quantity,
        },
      });

      const newReturned = record.quantityReturned + data.quantity;
      const status =
        newReturned >= record.quantityGiven ? 'RETURNED' : 'PARTIAL_RETURNED';

      return tx.teacherFreeItem.update({
        where: { id: data.teacherFreeItemId },
        data: {
          quantityReturned: newReturned,
          returnedDate: data.returnedDate
            ? new Date(data.returnedDate)
            : new Date(),
          status,
        },
        include: { staff: true, item: true },
      });
    });
  }

  async getTeacherFreeItems(staffId?: string, academicYear?: string) {
    const where: any = {};
    if (staffId) where.staffId = staffId;
    if (academicYear) where.academicYear = academicYear;
    return this.prisma.teacherFreeItem.findMany({
      where,
      include: { staff: true, item: true },
      orderBy: { givenDate: 'desc' },
    });
  }

  async getTeacherFreeItemSummary(staffId: string, academicYear: string) {
    const records = await this.prisma.teacherFreeItem.findMany({
      where: { staffId, academicYear },
      include: { item: true },
    });

    // Group by item
    const summary: Record<
      string,
      {
        itemName: string;
        freeLimit: number;
        totalGiven: number;
        totalReturned: number;
        netHeld: number;
      }
    > = {};
    for (const r of records) {
      if (!summary[r.itemId]) {
        summary[r.itemId] = {
          itemName: r.item.name,
          freeLimit: r.item.freeLimit,
          totalGiven: 0,
          totalReturned: 0,
          netHeld: 0,
        };
      }
      summary[r.itemId].totalGiven += r.quantityGiven;
      summary[r.itemId].totalReturned += r.quantityReturned;
      summary[r.itemId].netHeld =
        summary[r.itemId].totalGiven - summary[r.itemId].totalReturned;
    }

    return { staffId, academicYear, items: Object.values(summary), records };
  }

  // ═══════════════════════════════════════════════
  // POS TRANSACTIONS (INCOME / EXPENSE)
  // ═══════════════════════════════════════════════

  async createPosTransaction(data: CreatePosTransactionDto) {
    return this.prisma.posTransaction.create({
      data: {
        type: data.type,
        category: data.category,
        description: data.description,
        amount: data.amount,
        date: data.date ? new Date(data.date) : new Date(),
        referenceId: data.referenceId,
        receiptImage: data.receiptImage,
        remarks: data.remarks,
      },
    });
  }

  async getAllPosTransactions(type?: string, from?: string, to?: string) {
    const where: any = {};
    if (type) where.type = type;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to + 'T23:59:59.999Z');
    }
    return this.prisma.posTransaction.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  // ═══════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════

  async getPosDashboard(from?: string, to?: string) {
    const dateFilter: any = {};
    if (from || to) {
      dateFilter.date = {};
      if (from) dateFilter.date.gte = new Date(from);
      if (to) dateFilter.date.lte = new Date(to + 'T23:59:59.999Z');
    }

    const [totalIncome, totalExpense, recentSales, lowStock] =
      await Promise.all([
        this.prisma.posTransaction.aggregate({
          where: { type: 'INCOME', ...dateFilter },
          _sum: { amount: true },
        }),
        this.prisma.posTransaction.aggregate({
          where: { type: 'EXPENSE', ...dateFilter },
          _sum: { amount: true },
        }),
        this.prisma.sale.findMany({
          include: { store: true, items: { include: { item: true } } },
          orderBy: { saleDate: 'desc' },
          take: 10,
        }),
        this.prisma.storeStock.findMany({
          where: { quantity: { lte: 5 } },
          include: { item: true, store: true },
        }),
      ]);

    return {
      totalSales: totalIncome._sum.amount || 0,
      totalPurchases: totalExpense._sum.amount || 0,
      profitLoss:
        (totalIncome._sum.amount || 0) - (totalExpense._sum.amount || 0),
      recentSales,
      lowStockAlerts: lowStock,
    };
  }

  // ═══════════════════════════════════════════════
  // STOCK OVERVIEW
  // ═══════════════════════════════════════════════

  async getStockOverview(storeId?: string) {
    const where: any = {};
    if (storeId) where.storeId = storeId;
    return this.prisma.storeStock.findMany({
      where,
      include: { item: true, store: true },
      orderBy: { item: { name: 'asc' } },
    });
  }
}
