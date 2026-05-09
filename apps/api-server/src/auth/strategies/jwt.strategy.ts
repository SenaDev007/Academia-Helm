import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UsersService } from '../../users/users.service';
import { PrismaService } from '../../database/prisma.service';

const TOKEN_COOKIE = 'academia_token';

function tokenFromCookie(req: Request): string | null {
  const cookieHeader = req?.headers?.cookie;
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${TOKEN_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1].trim()) : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => tokenFromCookie(req),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'your-secret-key-change-in-production'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req) || tokenFromCookie(req);
    if (token) {
      const isRevoked = await this.prisma.revokedToken.findUnique({ where: { token } });
      if (isRevoked) {
        throw new UnauthorizedException('Token has been revoked');
      }
    }

    const user = await this.usersService.findOneWithRoles(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }

    // Tenant du JWT enrichi (après select-tenant) prime sur la colonne User (souvent null pour multi-contexte)
    const tenantIdFromToken =
      typeof payload.tenantId === 'string' && payload.tenantId.length > 0
        ? payload.tenantId
        : user.tenantId;

    return {
      id: user.id,
      email: user.email,
      tenantId: tenantIdFromToken ?? null,
      role: payload.role ?? (user as { role?: string }).role,
      isSuperAdmin: user.isSuperAdmin,
      roles: user.roles || [],
      permissions: this.extractPermissions(user.roles || []),
      portalType: payload.portalType || null,
    };
  }

  private extractPermissions(roles: any[]): string[] {
    const permissions = new Set<string>();
    for (const role of roles) {
      if (role.permissions) {
        for (const permission of role.permissions) {
          permissions.add(permission.name);
        }
      }
    }
    return Array.from(permissions);
  }
}

