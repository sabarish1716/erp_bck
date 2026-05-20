import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAdminSettingsDto } from './update-admin-settings.dto';
import { RolePermissionsService } from '../auth/role-permissions.service';
import { UpdateUserPermissionsDto } from './update-user-permissions.dto';

const SETTINGS_KEY = 'admin.settings';
const FEE_RECEIPT_FIELDS_KEY = 'fees.receiptFields';
const LEGACY_SCHOOL_NAME = 'PSF Public School';
const CURRENT_SCHOOL_NAME = 'PSF Matriculation Higher Secondary School';

const DOCUMENT_ASSET_KEYS = [
  'principalSignature',
  'hrSignature',
  'chairmanSignature',
  'accountantSignature',
  'managerSignature',
  'rubberStamp',
] as const;

type DocumentAssetKey = (typeof DOCUMENT_ASSET_KEYS)[number];

const DEFAULT_DOCUMENT_ASSETS: Record<DocumentAssetKey, string> = {
  principalSignature: '',
  hrSignature: '',
  chairmanSignature: '',
  accountantSignature: '',
  managerSignature: '',
  rubberStamp: '',
};

const DEFAULT_SETTINGS = {
  schoolName: CURRENT_SCHOOL_NAME,
  schoolCode: 'PSF',
  academicYear: '2026-2027',
  requireApprovalForAdmission: false,
  allowAdmissionEditAfterApproval: false,
  enableFeesModule: true,
  enableTransportModule: true,
  enableStaffModule: true,
  admissionNoAutoGenerate: true,
  enableIndividualDemotion: false,
  documentAssets: DEFAULT_DOCUMENT_ASSETS,
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

    const merged = {
      ...DEFAULT_SETTINGS,
      ...(row.value as Record<string, unknown>),
    };

    // Keep legacy data backward compatible by rewriting the old school label.
    if ((merged.schoolName as string | undefined) === LEGACY_SCHOOL_NAME) {
      merged.schoolName = CURRENT_SCHOOL_NAME;
    }

    return {
      ...merged,
      documentAssets: this.normalizeDocumentAssets((merged as Record<string, unknown>).documentAssets),
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

    const safeDocumentAssets = this.normalizeDocumentAssets((merged as Record<string, unknown>).documentAssets);

    const finalValue = {
      ...merged,
      documentAssets: safeDocumentAssets,
    };

    const saved = await this.prisma.appSetting.upsert({
      where: { key: SETTINGS_KEY },
      update: {
        value: finalValue,
        updatedByEmail: updatedByEmail ?? null,
      },
      create: {
        key: SETTINGS_KEY,
        value: finalValue,
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

  private normalizeDocumentAssets(value: unknown): Record<DocumentAssetKey, string> {
    const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    const normalized: Record<DocumentAssetKey, string> = { ...DEFAULT_DOCUMENT_ASSETS };

    for (const key of DOCUMENT_ASSET_KEYS) {
      const raw = input[key];
      if (typeof raw === 'string') normalized[key] = raw;
    }

    return normalized;
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
