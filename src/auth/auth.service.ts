import { Injectable, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthGuard } from '@nestjs/passport';
import { Driver } from '@prisma/client';
import { RolePermissionsService } from './role-permissions.service';
import { Role } from './role.enum';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private readonly rolePermissionsService: RolePermissionsService,
  ) {}

  async register(data: any) {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role,
      },
    });

    return user;
  }

  @UseGuards(AuthGuard('jwt'))
@Post('bulk')
async loginDriver(driver: Driver) {
  const payload = { sub: driver.id };
  return {
    access_token: this.jwtService.sign(payload),
  };
}
  async login(data: any) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
     
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (!user.isActive) {
      throw new UnauthorizedException('User is inactive');
    }

    const isMatch = await bcrypt.compare(data.password, user.password);

    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const permissions = await this.rolePermissionsService.getEffectivePermissionsForUser({
      id: user.id,
      role: user.role as Role,
    });

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        staffId:user.staffId,
        permissions,
      },
    };
  }
}