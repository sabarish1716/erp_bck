import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';
import { Public } from './public.decorator';

import { Get, Put, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt.guard';
import { RolePermissionsService } from './role-permissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from './role.enum';
import * as bcrypt from 'bcrypt';

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
      select: { id: true, name: true, email: true, role: true, staffId: true },
    });

    if (!dbUser) return { error: 'User not found' };

    const permissions =
      await this.rolePermissionsService.getEffectivePermissionsForUser({
        id: dbUser.id,
        role: dbUser.role,
      });

    return {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      staffId: dbUser.staffId,
      permissions,
      // Pass these so the frontend form populates correctly
      firstName: dbUser.name?.split(' ')[0] || '',
      lastName: dbUser.name?.split(' ').slice(1).join(' ') || '',
    };
  }

  @Put('profile')
  async updateProfile(@Req() req: any, @Body() body: any) {
    const jwtPayload = req.user;
    if (!jwtPayload) throw new UnauthorizedException('Not authenticated');

    const dbUser = await this.prisma.user.findUnique({
      where: { id: jwtPayload.sub },
    });

    if (!dbUser) throw new UnauthorizedException('User not found');

    const updateData: any = {};
    
    // Combine firstName and lastName
    if (body.firstName || body.lastName) {
      updateData.name = `${body.firstName || ''} ${body.lastName || ''}`.trim();
    }

    // Only allow ADMIN to update email and password
    if (dbUser.role === Role.ADMIN) {
      if (body.email) {
        updateData.email = body.email;
      }
      if (body.password) {
        updateData.password = await bcrypt.hash(body.password, 10);
      }
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.user.update({
        where: { id: dbUser.id },
        data: updateData,
      });
    }

    return { success: true, message: 'Profile updated' };
  }
}
