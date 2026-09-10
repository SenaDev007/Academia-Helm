/**
 * ============================================================================
 * ACADEMIC YEAR ENFORCEMENT INTERCEPTOR
 * ============================================================================
 *
 * Interceptor qui FORCE l'injection de academic_year_id dans toutes les
 * requêtes métier et empêche toute tentative de mélange.
 *
 * COMPORTEMENT (depuis fix régression) :
 * - Routes @Public() → laissées passer
 * - Routes @SkipAcademicYear() → laissées passer
 * - Routes @AllowCrossLevel() → laissées passer
 * - Routes d'auth/portail explicitement exclues → laissées passer
 * - TOUTES LES AUTRES → MODE NON-BLOQUANT :
 *   Si academicYearId absent, on laisse passer (warning loggé).
 *   Si academicYearId présent, on l'injecte dans body/query.
 *
 * ⭐ FIX 2026-09-10 — injection DTO-AWARE (body ET query) :
 *   Le ValidationPipe global (whitelist + forbidNonWhitelisted — CDC §16.3.3)
 *   s'exécute APRÈS les interceptors (lifecycle Nest : guards → interceptors
 *   → pipes). Injecter academicYearId dans le body d'un DTO qui ne déclare pas
 *   cette propriété déclenchait un 400 « property academicYearId should not
 *   exist » sur tous les POST/PUT stricts (ex : POST /hr/contracts/:id/sign —
 *   SignContractDto — étape Signature de l'onboarding d'embauche RH ;
 *   POST /hr/contracts/onboarding/complete). Régression apparue avec l'envoi
 *   du header x-academic-year-id par tous les clients fetch (fix 2026-09-09).
 *
 *   L'injection body/query n'a désormais lieu QUE si elle est SÛRE pour la
 *   validation (voir academicYearInjectionIsSafe) ; l'année reste toujours
 *   accessible aux services via request['academicYearId'] et le décorateur
 *   @AcademicYearId() (Règle 4, sans impact validation).
 * ============================================================================
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { getMetadataStorage } from 'class-validator';
import { ALLOW_CROSS_LEVEL_KEY } from '../decorators/allow-cross-level.decorator';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { SKIP_ACADEMIC_YEAR_KEY } from '../decorators/skip-academic-year.decorator';

/** Types JS/TS et types express exclus de la détection « classe DTO ». */
const NON_DTO_CLASS_NAMES = [
  'Object',
  'String',
  'Number',
  'Boolean',
  'Array',
  'Function',
  'Promise',
  'Date',
  'Request',
  'Response',
];

@Injectable()
export class AcademicYearEnforcementInterceptor implements NestInterceptor {
  /**
   * Cache statique des design:paramtypes par handler (métadonnées figées au
   * bootstrap — évite une relecture reflect-metadata à chaque requête).
   */
  private static readonly PARAMTYPES_CACHE = new WeakMap<Function, unknown[]>();

  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.url || request.route?.path || '';

    // ✅ Ignorer les routes publiques
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return next.handle();
    }

    // ✅ Ignorer les routes explicitement exemptées d'année scolaire
    const skipAcademicYear = this.reflector.getAllAndOverride<boolean>(SKIP_ACADEMIC_YEAR_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipAcademicYear) {
      return next.handle();
    }

    // ✅ Exclure explicitement les routes d'authentification et de portail
    if (this.isPathExempted(path)) {
      return next.handle();
    }

    // ✅ Ignorer si cross-level autorisé (Module Général uniquement)
    const allowCrossLevel = this.reflector.getAllAndOverride<boolean>(ALLOW_CROSS_LEVEL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowCrossLevel) {
      return next.handle();
    }

    // RÈGLE 1 : Extraire le academic_year_id du contexte
    const academicYearId = this.extractAcademicYearId(request);

    if (!academicYearId) {
      // MODE NON-BLOQUANT : laisser passer sans academicYearId
      // (pour éviter les régressions sur l'auth et les routes pré-login)
      console.warn('ACADEMIC_YEAR_INTERCEPTOR_WARNING (non-blocking)', {
        endpoint: path,
        method: request.method,
        reason: 'Missing academic_year_id — request allowed without injection',
      });
      return next.handle();
    }

    // ⭐ FIX 2026-09-10 : l'injection body/query n'est SÛRE que si les DTO
    //    validés par le pipe l'acceptent (sinon 400 forbidNonWhitelisted).
    //    Calcul UNE fois par requête, partagé par les règles 2 et 3.
    const injectionSafe = this.academicYearInjectionIsSafe(context);

    // RÈGLE 2 : Forcer academic_year_id dans le body pour CREATE/UPDATE
    if (request.body && typeof request.body === 'object') {
      if (request.body.academicYearId && request.body.academicYearId !== academicYearId) {
        // Empêcher la modification du academic_year_id
        throw new Error(
          'ACADEMIC YEAR ENFORCEMENT RULE: ' +
          `Cannot change academic_year_id. Expected ${academicYearId}, got ${request.body.academicYearId}.`
        );
      }

      // Forcer l'injection si absent — uniquement si DTO-compatible (fix 2026-09-10)
      if (!request.body.academicYearId && injectionSafe) {
        request.body.academicYearId = academicYearId;
      }
    }

    // RÈGLE 3 : Forcer academic_year_id dans les query params
    if (request.query && typeof request.query === 'object') {
      if (request.query.academicYearId && request.query.academicYearId !== academicYearId) {
        throw new Error(
          'ACADEMIC YEAR ENFORCEMENT RULE: ' +
          `Cannot specify different academic_year_id in query. Expected ${academicYearId}.`
        );
      }

      // Forcer l'injection si absent — uniquement si DTO-compatible (fix 2026-09-10)
      if (!request.query.academicYearId && injectionSafe) {
        request.query.academicYearId = academicYearId;
      }
    }

    // RÈGLE 4 : Stocker dans request pour accès facile
    request['academicYearId'] = academicYearId;

    return next.handle();
  }

  private extractAcademicYearId(request: Request): string | null {
    if (request['context']?.academicYearId) {
      return request['context'].academicYearId;
    }
    if (request['academicYearId']) {
      return request['academicYearId'];
    }
    if (request.headers['x-academic-year-id']) {
      return request.headers['x-academic-year-id'] as string;
    }
    if (request.query?.academicYearId) {
      return request.query.academicYearId as string;
    }
    if (request.body?.academicYearId) {
      return request.body.academicYearId;
    }
    return null;
  }

  // ─── ⭐ FIX 2026-09-10 : helpers d'injection DTO-aware ────────────────────

  /**
   * Détermine si l'injection de academicYearId dans body/query est SÛRE pour
   * le ValidationPipe global (whitelist + forbidNonWhitelisted), qui tourne
   * APRÈS les interceptors (lifecycle Nest : guards → interceptors → pipes).
   *
   * Politique :
   *  - aucun paramètre typé « classe DTO » sur le handler (@Body() any, type
   *    inline…) → pas de validation stricte → injection sans risque ;
   *  - au moins un DTO déclare academicYearId (metadata class-validator) →
   *    injection (comportement historique préservé, ex : CreateContractDto) ;
   *  - des DTO existent mais aucun ne le déclare (ex : SignContractDto) →
   *    PAS d'injection — sinon 400 « property academicYearId should not exist ».
   *    L'année reste disponible via request['academicYearId'] (Règle 4) et le
   *    décorateur @AcademicYearId().
   */
  private academicYearInjectionIsSafe(context: ExecutionContext): boolean {
    try {
      const paramtypes = this.getHandlerParamtypes(context);
      const dtoClasses = paramtypes.filter(
        (t) =>
          typeof t === 'function' &&
          !!(t as { name?: string }).name &&
          !NON_DTO_CLASS_NAMES.includes((t as { name: string }).name),
      ) as { new (...args: any[]): any }[];

      if (dtoClasses.length === 0) {
        return true; // Pas de DTO typé → le pipe ne validera rien
      }

      const storage: any = getMetadataStorage();
      if (dtoClasses.some((dto) => this.dtoDeclaresAcademicYear(storage, dto))) {
        return true;
      }
      // Aucun DTO ne déclare academicYearId : si l'un d'eux possède des règles
      // class-validator, l'injection serait rejetée → on n'injecte pas.
      return !dtoClasses.some((dto) => this.dtoHasValidationRules(storage, dto));
    } catch {
      // En cas d'erreur de réflexion : ne jamais provoquer un 400 → pas d'injection
      return false;
    }
  }

  /**
   * design:paramtypes du handler — via (Controller.prototype, methodName),
   * emplacement réel des métadonnées émises par TypeScript (reflect-metadata
   * ne les expose PAS sur la référence de fonction seule).
   * Résultat mis en cache (statique après bootstrap).
   */
  private getHandlerParamtypes(context: ExecutionContext): unknown[] {
    const handler = context.getHandler();
    const cached = AcademicYearEnforcementInterceptor.PARAMTYPES_CACHE.get(handler);
    if (cached) {
      return cached;
    }

    let paramtypes: unknown[] = [];
    try {
      const proto = context.getClass()?.prototype;
      if (proto && handler) {
        const methodName =
          Object.getOwnPropertyNames(proto).find((k) => {
            try {
              return (proto as Record<string, unknown>)[k] === handler;
            } catch {
              return false;
            }
          }) ?? handler.name;
        if (methodName) {
          paramtypes =
            (Reflect.getMetadata('design:paramtypes', proto, methodName) as unknown[]) ?? [];
        }
      }
    } catch {
      paramtypes = [];
    }

    AcademicYearEnforcementInterceptor.PARAMTYPES_CACHE.set(handler, paramtypes);
    return paramtypes;
  }

  /** Le DTO (ou un parent) déclare-t-il une validation sur academicYearId ? */
  private dtoDeclaresAcademicYear(storage: any, dto: Function): boolean {
    return this.validationMetadataFor(storage, dto).some(
      (m: { propertyName?: string }) => m?.propertyName === 'academicYearId',
    );
  }

  /** Le DTO (ou un parent) possède-t-il au moins une règle class-validator ? */
  private dtoHasValidationRules(storage: any, dto: Function): boolean {
    return this.validationMetadataFor(storage, dto).length > 0;
  }

  /**
   * Metadatas class-validator d'une classe (héritage inclus).
   * API 0.13/0.14 : getTargetValidationMetadatas(targetConstructor, schema,
   * always, strictGroups, groups) ; fallback sur la Map interne (cible directe).
   */
  private validationMetadataFor(storage: any, dto: Function): any[] {
    try {
      const direct = storage?.getTargetValidationMetadatas?.(
        dto,
        undefined,
        false,
        false,
        undefined,
      );
      if (Array.isArray(direct)) {
        return direct;
      }
      const map = storage?.validationMetadatas;
      if (map && typeof map.get === 'function') {
        const list = map.get(dto);
        if (Array.isArray(list)) {
          return list;
        }
      }
    } catch {
      // API de stockage indisponible → considérer « aucune règle »
    }
    return [];
  }

  /**
   * Vérifie si un path correspond à une route légitimement sans année scolaire.
   * (Même liste que le guard — maintenu en synchronisation)
   */
  private isPathExempted(path: string): boolean {
    const cleanPath = path.split('?')[0];
    const exemptedPrefixes = [
      '/auth/',
      '/auth/login',
      '/auth/register',
      '/auth/select-tenant',
      '/auth/dev-login',
      '/auth/dev-available-tenants',
      '/auth/available-tenants',
      '/auth/google',
      '/auth/otp',
      '/auth/reset-password',
      '/auth/forgot-password',
      '/auth/verify-otp',
      '/countries',
      '/departments',
      '/school-levels',
      '/schools',
      '/tenants',
      '/users',
      '/roles',
      '/permissions',
      '/rooms',
      '/academic-years',
      '/academic-tracks',
      '/quarters',
      '/platform',
      '/billing',
      '/onboarding',
      '/access-requests',
      '/portal',
      '/reviews',
      '/health',
      '/media',
      '/sync',
      '/tenant-features',
      '/audit-logs',
      '/sara',
      '/atlas',
      '/federis',
      '/security',
      '/compliance',
      '/educmaster',
      '/salary-policies',
      '/fee-configurations',
      // /grading-policies removed (Phase 6 — module legacy supprimé)
      '/context',
      '/settings/school-calendar-config',
      '/settings/general',
      '/settings/features',
      '/settings/security',
      '/settings/communication',
      '/settings/bilingual',
      '/settings/orion',
      '/settings/atlas',
      '/settings/offline',
      '/settings/identity',
      '/settings/seals',
      '/settings/roles',
      '/settings/structure',
      '/settings/billing',
      '/settings/history',
      '/settings/stamps',
    ];
    return exemptedPrefixes.some((prefix) => cleanPath.startsWith(prefix));
  }
}
