/**
 * ============================================================================
 * ACCESS SCOPE GUARD — enforcement du périmètre Rôles × Pistes × Niveaux
 * ============================================================================
 * ⭐ P2 du filtre intelligent. Enregistré GLOBAL (après JwtAuthGuard).
 *
 * RÔLE (complémentaire des services qui restreignent les listes via
 * scope-where.ts) :
 *   - Bloque toute tentative d'ÉLARGISSEMENT explicite du périmètre :
 *     header `x-school-level-id`, query/body `schoolLevelId`, sentinelle
 *     'ALL', query `language` / `academicTrackId` hors pistes autorisées.
 *   - Les violations sont loggées (même format que SchoolLevelIsolationGuard).
 *
 * NE FAIT RIEN (rétro-compat) :
 *   - Routes @Public, requêtes sans user, comptes sans scope résolu
 *     (profils métier introuvables), comptes transverses (promoteur…),
 *   - Routes @AllowCrossLevel() (module Général/Synthèse).
 *
 * La restriction positive (listes sans filtre → périmètre de l'utilisateur)
 * est assurée par les services via scope-where.ts (P3).
 * ============================================================================
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { ALLOW_CROSS_LEVEL_KEY } from '../decorators/allow-cross-level.decorator';

@Injectable()
export class AccessScopeGuard implements CanActivate {
  private readonly logger = new Logger(AccessScopeGuard.name);

  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // ✅ Routes publiques → rien à faire
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // ✅ Cross-level explicite (module Général/Synthèse)
    const allowCrossLevel = this.reflector.getAllAndOverride<boolean>(ALLOW_CROSS_LEVEL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowCrossLevel) return true;

    const user = (request as any).user as any;
    if (!user) return true; // JwtAuthGuard gère l'authentification

    const scope = user.scope;
    // Compte transverse, scope non résolu (rétro-compat) ou sans tenant → pass
    if (!scope || !scope.resolved || scope.transverse) return true;

    const tenantId = (request as any).tenantId || user.tenantId;
    const userId = user.id;
    const log = (reason: string, detail: Record<string, unknown>) => {
      const payload = {
        tenantId,
        userId,
        endpoint: request.url,
        method: request.method,
        reason,
        ...detail,
      };
      this.logger.warn(`ACCESS_SCOPE_VIOLATION ${JSON.stringify(payload)}`);
      console.warn('ACCESS_SCOPE_VIOLATION', payload);
    };

    // ─── 1. NIVEAU SCOLAIRE ─────────────────────────────────────────────────
    // Sources possibles du niveau demandé (le client ne peut pas élargir)
    const levelSources: Array<[string, unknown]> = [
      ['header', request.headers['x-school-level-id']],
      ['query', (request.query as any)?.schoolLevelId],
      ['body', (request.body as any)?.schoolLevelId],
    ];

    for (const [src, rawValue] of levelSources) {
      const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
      if (value == null || value === '' || value === undefined) continue;

      if (typeof value === 'string' && value.toUpperCase() === 'ALL') {
        // Sentinelle 'ALL' = tous les niveaux → réservée aux transverses
        if (!scope.allLevels) {
          log('ALL_BYPASS_ATTEMPT', { source: src, scopeLevels: scope.levelCodes });
          throw new ForbiddenException(
            'Accès refusé : le périmètre « tous les niveaux » est réservé aux profils transverses.',
          );
        }
        continue;
      }

      if (scope.allLevels) continue; // pas de restriction de niveau

      const allowed: boolean =
        (typeof value === 'string' && scope.levelIds.includes(value)) ||
        (Array.isArray(value) && (value as string[]).every((v) => scope.levelIds.includes(v)));

      if (!allowed) {
        log('LEVEL_OUT_OF_SCOPE', { source: src, requested: value, scopeLevels: scope.levelCodes });
        throw new ForbiddenException(
          `Accès refusé : votre périmètre (${scope.levelCodes.join(', ')}) n'inclut pas le niveau demandé.`,
        );
      }
    }

    // ─── 2. PISTE LINGUISTIQUE ─────────────────────────────────────────────
    if (!scope.allTracks) {
      // academicTrackId (header/query/body) doit être une piste autorisée
      const trackSources: Array<[string, unknown]> = [
        ['header', request.headers['x-academic-track-id']],
        ['query', (request.query as any)?.academicTrackId],
        ['body', (request.body as any)?.academicTrackId],
      ];
      for (const [src, rawValue] of trackSources) {
        const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
        if (value == null || value === '' || value === undefined) continue;
        if (typeof value !== 'string') continue;
        if (!scope.trackIds.includes(value)) {
          log('TRACK_OUT_OF_SCOPE', { source: src, requested: value, scopeTracks: scope.trackCodes });
          throw new ForbiddenException(
            `Accès refusé : votre piste linguistique (${scope.trackCodes.join(', ')}) n'inclut pas la piste demandée.`,
          );
        }
      }

      // language (query/body) = code piste FR/EN
      const langSources: Array<[string, unknown]> = [
        ['query', (request.query as any)?.language],
        ['body', (request.body as any)?.language],
      ];
      for (const [src, rawValue] of langSources) {
        const value = typeof rawValue === 'string' ? rawValue.trim().toUpperCase() : rawValue;
        if (value == null || value === '' || value === undefined) continue;
        if (typeof value !== 'string') continue;
        if (value !== 'FR' && value !== 'EN') continue; // pas un code piste → ignoré
        if (!scope.trackCodes.includes(value)) {
          log('LANGUAGE_OUT_OF_SCOPE', { source: src, requested: value, scopeTracks: scope.trackCodes });
          throw new ForbiddenException(
            `Accès refusé : votre piste linguistique (${scope.trackCodes.join(', ')}) n'inclut pas la piste ${value}.`,
          );
        }
      }
    }

    return true;
  }
}
