import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';
import { Public } from './public.decorator';

import { Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt.guard';
import { RolePermissionsService } from './role-permissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from './role.enum';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly rolePermissionsService: RolePermissionsService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Public()
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  /**
   * GET /auth/me - Get current user profile and permissions
   */
  @Get('me')
  async getMe(@Req() req: any) {
    const jwtPayload = req.user;
    if (!jwtPayload) return { error: 'Not authenticated' };

    // JWT payload has { sub, email, role } — look up full user from DB
    const dbUser = await this.prisma.user.findUnique({
      where: { id: jwtPayload.sub },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!dbUser) return { error: 'User not found' };

    const permissions = await this.rolePermissionsService.getEffectivePermissionsForUser({
      id: dbUser.id,
      role: dbUser.role as Role,
    });

    return {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      permissions,
    };
  }
}