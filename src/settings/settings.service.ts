import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAdminSettingsDto } from './update-admin-settings.dto';
import { RolePermissionsService } from '../auth/role-permissions.service';
import { UpdateUserPermissionsDto } from './update-user-permissions.dto';

const SETTINGS_KEY = 'admin.settings';
const FEE_RECEIPT_FIELDS_KEY = 'fees.receiptFields';

const DEFAULT_SETTINGS = {
  schoolName: 'PSF School',
  schoolCode: 'PSF',
  academicYear: '2026-2027',
  requireApprovalForAdmission: true,
  allowAdmissionEditAfterApproval: false,
  enableFeesModule: true,
  enableTransportModule: true,
  enableStaffModule: true,
  admissionNoAutoGenerate: true,
};

const DEFAULT_FEE_RECEIPT_FIELDS = {
  tuitionFee: { label: 'Tuition Fee', enabled: true, order: 1 },
  transportFee: { label: 'Transport Fee', enabled: true, order: 2 },
  bookFee: { label: 'Book Fee', enabled: true, order: 3 },
  hostelFee: { label: 'Hostel Fee', enabled: false, order: 4 },
  otherFee: { label: 'Other Fee', enabled: false, order: 5 },
  labFee: { label: 'Lab Fee', enabled: false, order: 6 },
  sportsFee: { label: 'Sports Fee', enabled: false, order: 7 },
  examFee: { label: 'Exam Fee', enabled: false, order: 8 },
  libraryFee: { label: 'Library Fee', enabled: false, order: 9 },
  uniformFee: { label: 'Uniform Fee', enabled: false, order: 10 },
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rolePermissionsService: RolePermissionsService,
  ) {}

  async getAdminSettings() {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: SETTINGS_KEY },
    });

    if (!row) return DEFAULT_SETTINGS;

    return {
      ...DEFAULT_SETTINGS,
      ...(row.value as Record<string, unknown>),
    };
  }

  async updateAdminSettings(data: UpdateAdminSettingsDto, updatedByEmail?: string) {
    const existing = await this.prisma.appSetting.findUnique({
      where: { key: SETTINGS_KEY },
    });

    const merged = {
      ...DEFAULT_SETTINGS,
      ...(existing?.value as Record<string, unknown> | undefined),
      ...data,
    };

    const saved = await this.prisma.appSetting.upsert({
      where: { key: SETTINGS_KEY },
      update: {
        value: merged,
        updatedByEmail: updatedByEmail ?? null,
      },
      create: {
        key: SETTINGS_KEY,
        value: merged,
        updatedByEmail: updatedByEmail ?? null,
      },
    });

    return {
      key: saved.key,
      settings: saved.value,
      updatedByEmail: saved.updatedByEmail,
      updatedAt: saved.updatedAt,
    };
  }

  async getRolePermissionsConfig() {
    return this.rolePermissionsService.getRolePermissionsConfig();
  }

  async updateRolePermissionsConfig(rolePermissions: Record<string, string[]>, updatedByEmail?: string) {
    const savedRolePermissions = await this.rolePermissionsService.updateRolePermissionsMap(
      rolePermissions,
      updatedByEmail,
    );

    return {
      rolePermissions: savedRolePermissions,
      updatedByEmail: updatedByEmail ?? null,
    };
  }

  async getUserPermissionOverridesConfig() {
    const [overrideConfig, users] = await Promise.all([
      this.rolePermissionsService.getUserPermissionOverridesConfig(),
      this.prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      permissions: overrideConfig.permissions,
      userPermissionOverrides: overrideConfig.userPermissionOverrides,
      users,
    };
  }

  async updateUserPermissionOverrideConfig(
    userId: string,
    body: UpdateUserPermissionsDto,
    updatedByEmail?: string,
  ) {
    const normalizedUserId = String(userId);
    const saved = await this.rolePermissionsService.setUserPermissionOverride(
      normalizedUserId,
      {
        grants: body.grants ?? [],
        revokes: body.revokes ?? [],
      },
      updatedByEmail,
    );

    return {
      userId: normalizedUserId,
      override: saved,
      updatedByEmail: updatedByEmail ?? null,
    };
  }

  async getFeeReceiptFields() {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: FEE_RECEIPT_FIELDS_KEY },
    });
    if (!row) return DEFAULT_FEE_RECEIPT_FIELDS;
    return {
      ...DEFAULT_FEE_RECEIPT_FIELDS,
      ...(row.value as Record<string, unknown>),
    };
  }

  async updateFeeReceiptFields(fields: Record<string, any>, updatedByEmail?: string) {
    const saved = await this.prisma.appSetting.upsert({
      where: { key: FEE_RECEIPT_FIELDS_KEY },
      update: { value: fields, updatedByEmail: updatedByEmail ?? null },
      create: { key: FEE_RECEIPT_FIELDS_KEY, value: fields, updatedByEmail: updatedByEmail ?? null },
    });
    return saved.value;
  }
}
