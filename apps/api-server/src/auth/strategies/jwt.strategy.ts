import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UsersService } from '../../users/users.service';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/services/cache.service';

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
    private cacheService: CacheService,
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
      // Check revoked token with short-lived cache (1 min) to avoid DB hit on every request
      const cacheKey = `revoked:${token.slice(-16)}`;
      const cachedRevoked = this.cacheService.get<boolean>(cacheKey);
      if (cachedRevoked === true) {
        throw new UnauthorizedException('Token has been revoked');
      }
      if (cachedRevoked === null) {
        // Not in cache — check DB
        const isRevoked = await this.prisma.revokedToken.findUnique({ where: { token } });
        if (isRevoked) {
          this.cacheService.set(cacheKey, true, 60 * 1000); // cache revoked for 1 min
          throw new UnauthorizedException('Token has been revoked');
        }
        // Cache non-revoked status briefly to reduce DB load
        this.cacheService.set(cacheKey, false, 60 * 1000);
      }
    }

    // Cache user+roles+permissions for 2 minutes to eliminate repeated heavy queries
    const userCacheKey = `user:roles:${payload.sub}`;
    let user = this.cacheService.get<any>(userCacheKey);
    if (!user) {
      user = await this.usersService.findOneWithRoles(payload.sub);
      if (user) {
        this.cacheService.set(userCacheKey, user, 2 * 60 * 1000); // 2 min TTL
      }
    }

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
      // Support des deux formats :
      // 1. role.rolePermissions[].permission.name (via UserRole → Role → RolePermission → Permission)
      // 2. role.permissions[].name (format direct, si utilisé ailleurs)
      if (role.rolePermissions) {
        for (const rp of role.rolePermissions) {
          if (rp.permission?.name) {
            permissions.add(rp.permission.name);
          }
        }
      }
      if (role.permissions) {
        for (const permission of role.permissions) {
          if (typeof permission === 'string') {
            permissions.add(permission);
          } else if (permission?.name) {
            permissions.add(permission.name);
          }
        }
      }
    }
    return Array.from(permissions);
  }
}
