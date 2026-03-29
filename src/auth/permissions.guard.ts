import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { Permission } from './permission.enum';
import { Role } from './role.enum';
import { RolePermissionsService } from './role-permissions.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly rolePermissionsService: RolePermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Allow public endpoints through
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permissions decorator — require at least authentication (any logged-in role)
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Not authenticated');

    const userRole: Role = user.role;
    const grantedPermissions = await this.rolePermissionsService.getEffectivePermissionsForUser({
      id: user.id,
      role: userRole,
    });

    const hasAll = requiredPermissions.every((p) =>
      grantedPermissions.includes(p),
    );

    if (!hasAll) {
      throw new ForbiddenException(
        `Your role (${userRole}) does not have the required permission(s): ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
