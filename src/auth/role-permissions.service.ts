import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Permission } from './permission.enum';
import { Role } from './role.enum';
import { DEFAULT_ROLE_PERMISSIONS } from './role-permissions.map';

const ROLE_PERMISSIONS_SETTINGS_KEY = 'auth.rolePermissions';
const USER_PERMISSION_OVERRIDES_SETTINGS_KEY = 'auth.userPermissionOverrides';

type UserPermissionOverride = {
  grants: Permission[];
  revokes: Permission[];
};

type UserPermissionOverridesMap = Record<string, UserPermissionOverride>;

@Injectable()
export class RolePermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizePermissionList(list: unknown): Permission[] {
    const validPermissions = new Set(Object.values(Permission));
    if (!Array.isArray(list)) return [];

    return list.filter(
      (value): value is Permission =>
        typeof value === 'string' && validPermissions.has(value as Permission),
    );
  }

  private normalizeRolePermissions(input: unknown): Record<Role, Permission[]> {
    const result = {} as Record<Role, Permission[]>;

    for (const role of Object.values(Role)) {
      const rawList = (input as Record<string, unknown> | undefined)?.[role];
      const values = Array.isArray(rawList)
        ? this.normalizePermissionList(rawList)
        : DEFAULT_ROLE_PERMISSIONS[role];

      result[role] =
        role === Role.ADMIN ? [...Object.values(Permission)] : values;
    }

    return result;
  }

  private normalizeUserPermissionOverrides(
    input: unknown,
  ): UserPermissionOverridesMap {
    const result: UserPermissionOverridesMap = {};
    if (!input || typeof input !== 'object') return result;

    for (const [userId, override] of Object.entries(
      input as Record<string, unknown>,
    )) {
      if (!override || typeof override !== 'object') continue;

      const parsed = override as Record<string, unknown>;
      result[userId] = {
        grants: this.normalizePermissionList(parsed.grants),
        revokes: this.normalizePermissionList(parsed.revokes),
      };
    }

    return result;
  }

  async getRolePermissionsMap(): Promise<Record<Role, Permission[]>> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: ROLE_PERMISSIONS_SETTINGS_KEY },
    });

    if (!row) return DEFAULT_ROLE_PERMISSIONS;

    return this.normalizeRolePermissions(row.value);
  }

  async getPermissionsForRole(role: Role): Promise<Permission[]> {
    const rolePermissions = await this.getRolePermissionsMap();
    return rolePermissions[role] ?? [];
  }

  async getUserPermissionOverridesMap(): Promise<UserPermissionOverridesMap> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: USER_PERMISSION_OVERRIDES_SETTINGS_KEY },
    });

    if (!row) return {};

    return this.normalizeUserPermissionOverrides(row.value);
  }

  async getUserPermissionOverride(
    userId: string,
  ): Promise<UserPermissionOverride> {
    const all = await this.getUserPermissionOverridesMap();
    return all[userId] ?? { grants: [], revokes: [] };
  }

  async setUserPermissionOverride(
    userId: string,
    override: { grants?: string[]; revokes?: string[] },
    updatedByEmail?: string,
  ): Promise<UserPermissionOverride> {
    const current = await this.getUserPermissionOverridesMap();
    const normalized: UserPermissionOverride = {
      grants: this.normalizePermissionList(override.grants),
      revokes: this.normalizePermissionList(override.revokes),
    };

    current[userId] = normalized;

    await this.prisma.appSetting.upsert({
      where: { key: USER_PERMISSION_OVERRIDES_SETTINGS_KEY },
      update: {
        value: current,
        updatedByEmail: updatedByEmail ?? null,
      },
      create: {
        key: USER_PERMISSION_OVERRIDES_SETTINGS_KEY,
        value: current,
        updatedByEmail: updatedByEmail ?? null,
      },
    });

    return normalized;
  }

  async getEffectivePermissionsForUser(user: {
    id: string | number;
    role: Role;
  }): Promise<Permission[]> {
    const base = await this.getPermissionsForRole(user.role);
    if (user.role === Role.ADMIN) return base;

    const userId = String(user.id);
    const override = await this.getUserPermissionOverride(userId);

    const revoked = new Set(override.revokes);
    const combined = new Set<Permission>(base.filter((p) => !revoked.has(p)));
    override.grants.forEach((p) => combined.add(p));

    return Array.from(combined);
  }

  async updateRolePermissionsMap(
    rolePermissions: Record<string, string[]>,
    updatedByEmail?: string,
  ): Promise<Record<Role, Permission[]>> {
    const normalized = this.normalizeRolePermissions(rolePermissions);

    await this.prisma.appSetting.upsert({
      where: { key: ROLE_PERMISSIONS_SETTINGS_KEY },
      update: {
        value: normalized,
        updatedByEmail: updatedByEmail ?? null,
      },
      create: {
        key: ROLE_PERMISSIONS_SETTINGS_KEY,
        value: normalized,
        updatedByEmail: updatedByEmail ?? null,
      },
    });

    return normalized;
  }

  async getRolePermissionsConfig() {
    const rolePermissions = await this.getRolePermissionsMap();

    return {
      roles: Object.values(Role),
      permissions: Object.values(Permission),
      rolePermissions,
    };
  }

  async getUserPermissionOverridesConfig() {
    const userPermissionOverrides = await this.getUserPermissionOverridesMap();

    return {
      permissions: Object.values(Permission),
      userPermissionOverrides,
    };
  }
}
