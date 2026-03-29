import { Body, Controller, Get, Param, Put, Req } from '@nestjs/common';
import { Permissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permission.enum';
import { SettingsService } from './settings.service';
import { UpdateAdminSettingsDto } from './update-admin-settings.dto';
import { UpdateRolePermissionsDto } from './update-role-permissions.dto';
import { UpdateUserPermissionsDto } from './update-user-permissions.dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('admin')
  @Permissions(Permission.SETTINGS_READ)
  getAdminSettings() {
    return this.settingsService.getAdminSettings();
  }

  @Put('admin')
  @Permissions(Permission.SETTINGS_UPDATE)
  updateAdminSettings(@Body() body: UpdateAdminSettingsDto, @Req() req: any) {
    return this.settingsService.updateAdminSettings(body, req?.user?.email);
  }

  @Get('permissions')
  @Permissions(Permission.SETTINGS_READ)
  getRolePermissions() {
    return this.settingsService.getRolePermissionsConfig();
  }

  @Put('permissions')
  @Permissions(Permission.SETTINGS_UPDATE)
  updateRolePermissions(@Body() body: UpdateRolePermissionsDto, @Req() req: any) {
    return this.settingsService.updateRolePermissionsConfig(body.rolePermissions, req?.user?.email);
  }

  @Get('user-permissions')
  @Permissions(Permission.SETTINGS_READ)
  getUserPermissions() {
    return this.settingsService.getUserPermissionOverridesConfig();
  }

  @Put('user-permissions/:userId')
  @Permissions(Permission.SETTINGS_UPDATE)
  updateUserPermissions(
    @Param('userId') userId: string,
    @Body() body: UpdateUserPermissionsDto,
    @Req() req: any,
  ) {
    return this.settingsService.updateUserPermissionOverrideConfig(userId, body, req?.user?.email);
  }

  @Get('fee-receipt-fields')
  @Permissions(Permission.SETTINGS_READ)
  getFeeReceiptFields() {
    return this.settingsService.getFeeReceiptFields();
  }

  @Put('fee-receipt-fields')
  @Permissions(Permission.SETTINGS_UPDATE)
  updateFeeReceiptFields(@Body() body: Record<string, any>, @Req() req: any) {
    return this.settingsService.updateFeeReceiptFields(body, req?.user?.email);
  }
}
