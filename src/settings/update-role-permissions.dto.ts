import { IsObject } from 'class-validator';

export class UpdateRolePermissionsDto {
  @IsObject()
  rolePermissions!: Record<string, string[]>;
}
