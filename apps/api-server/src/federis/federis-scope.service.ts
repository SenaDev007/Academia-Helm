/**
 * FederisScopeService — Périmètre de visibilité du patronat connecté
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ AGRÉGATION NATIONALE (2026-10-01 — demande promoteur) :
 *
 * « Lorsque le patronat national est connecté, il a une AGRÉGATION de tout
 *  ce qui se fait au niveau de chaque département, dans tous les modules.
 *  Quand il ouvre le département du Borgou, il voit tout ce qui a du
 *  département du Borgou. À la base il ne doit rien modifier : c'est en
 *  lecture seule. Il peut modifier seulement si le coordinateur du
 *  département lui donne la main. »
 *
 * Règles :
 *   - Patronat TERRITORIAL : périmètre = lui-même (comportement inchangé).
 *   - Patronat NATIONAL    : périmètre = lui-même + ses patronats enfants
 *     (départements) → vues AGRÉGÉES dans tous les modules ; un filtre
 *     `departmentId` restreint à UN département.
 *   - ÉCRITURE : le national est en LECTURE SEULE partout. Une délégation
 *     active (accordée par le coordonnateur du département) débloque les
 *     écritures sur les données de CE département uniquement.
 *
 * Stockage des délégations : `patronats.metadata.nationalDelegations`
 * (aucune migration requise) :
 *   [{ userId, email, name, grantedBy, grantedByName, grantedAt }]
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FederisPatronatService } from './federis-patronat.service';

export interface FederisScopeDepartment {
  id: string;
  name: string;
  territoryName: string | null;
  tenantId: string;
}

export interface FederisScope {
  /** Patronat connecté (résolu depuis le tenant du JWT). */
  patronat: {
    id: string;
    tenantId: string;
    name: string;
    orgLevel: string;
    territoryName?: string | null;
    countryId?: string | null;
  };
  /** true si patronat national (agrégation active). */
  isNational: boolean;
  /** Patronats enfants (départements) — national uniquement. */
  departments: FederisScopeDepartment[];
  /** Filtre département sélectionné (national uniquement) ou null. */
  departmentId: string | null;
  /** Ids des patronats du périmètre : [self] territorial ; national selon filtre. */
  scopePatronatIds: string[];
  /** Tenants du périmètre (pour les entités scopées par tenantId). */
  scopeTenantIds: string[];
}

interface DelegationEntry {
  userId: string;
  email?: string | null;
  name?: string | null;
  grantedBy: string;
  grantedByName?: string | null;
  grantedAt: string;
}

const DELEGATIONS_KEY = 'nationalDelegations';

function readDelegations(metadata: unknown): DelegationEntry[] {
  if (!metadata || typeof metadata !== 'object') return [];
  const raw = (metadata as Record<string, unknown>)[DELEGATIONS_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (d): d is DelegationEntry =>
      !!d && typeof d === 'object' && typeof (d as DelegationEntry).userId === 'string',
  );
}

/**
 * Années scolaires ACTIVES d'un périmètre (fonction autonome — utilisée par
 * FederisScopeService ET FederisPatronatService sans cycle d'injection).
 * Chaque patronat a son propre tenant et ses propres lignes d'année : on
 * retient, par tenant du périmètre, l'année portant le MÊME libellé que
 * l'année active de référence (repli : année active du tenant).
 */
export async function resolveScopeYearsFor(
  // PrismaService typé `any` : le client local du sandbox n'est pas régénéré
  // (les delegates patronat/academicYear manquent) — en production le
  // postinstall (prisma generate) fournit le client complet.
  prisma: any,
  referenceTenantId: string,
  scopeTenantIds: string[],
): Promise<{ yearIds: string[]; label: string | null }> {
  const reference = await prisma.academicYear.findFirst({
    where: { tenantId: referenceTenantId, isActive: true },
    orderBy: { startDate: 'desc' },
  });

  const yearIds: string[] = [];
  if (reference) yearIds.push(reference.id);

  for (const tenantId of scopeTenantIds) {
    const match = await prisma.academicYear.findFirst({
      where: { tenantId, isActive: true, ...(reference ? { label: reference.label } : {}) },
    });
    const fallback = match
      ? match
      : await prisma.academicYear.findFirst({
          where: { tenantId, isActive: true },
          orderBy: { startDate: 'desc' },
        });
    if (fallback && !yearIds.includes(fallback.id)) yearIds.push(fallback.id);
  }

  return { yearIds, label: reference?.label ?? null };
}

@Injectable()
export class FederisScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patronatService: FederisPatronatService,
  ) {}

  // ── Résolution du périmètre ───────────────────────────────────────────────

  /**
   * Résout le périmètre du demandeur.
   * @param departmentId filtre (national uniquement) : restreint le périmètre
   *                     à CE patronat enfant — doit appartenir au réseau.
   */
  async resolveScope(
    tenantId: string,
    userId?: string,
    departmentId?: string | null,
  ): Promise<FederisScope> {
    const patronat = await this.patronatService.resolvePatronat(tenantId, userId);
    return this.buildScopeFromPatronat(patronat, departmentId);
  }

  /**
   * Construit le périmètre depuis un patronat DÉJÀ résolu (évite une double
   * résolution quand le service appelant a déjà fait resolvePatronat).
   */
  async buildScopeFromPatronat(
    patronat: {
      id: string;
      tenantId: string;
      name: string;
      orgLevel: string;
      territoryName?: string | null;
      countryId?: string | null;
    },
    departmentId?: string | null,
  ): Promise<FederisScope> {
    const isNational = patronat.orgLevel === 'NATIONAL';

    let departments: FederisScopeDepartment[] = [];
    if (isNational) {
      const children = await this.prisma.patronat.findMany({
        where: { parentPatronatId: patronat.id, status: 'ACTIVE' },
        select: { id: true, name: true, territoryName: true, tenantId: true },
        orderBy: { territoryName: 'asc' },
      });
      departments = children.map((c) => ({
        id: c.id,
        name: c.name,
        territoryName: c.territoryName,
        tenantId: c.tenantId,
      }));
    }

    let scopePatronatIds: string[];
    if (isNational && departmentId) {
      const child = departments.find((d) => d.id === departmentId);
      if (!child) {
        throw new BadRequestException(
          'Département introuvable dans votre réseau de patronats.',
        );
      }
      scopePatronatIds = [child.id];
    } else if (isNational) {
      scopePatronatIds = [patronat.id, ...departments.map((d) => d.id)];
    } else {
      scopePatronatIds = [patronat.id];
    }

    const tenants = await this.prisma.patronat.findMany({
      where: { id: { in: scopePatronatIds } },
      select: { tenantId: true },
    });

    return {
      patronat: {
        id: patronat.id,
        tenantId: patronat.tenantId,
        name: patronat.name,
        orgLevel: patronat.orgLevel,
        territoryName: patronat.territoryName,
        countryId: patronat.countryId,
      },
      isNational,
      departments,
      departmentId: isNational ? (departmentId ?? null) : null,
      scopePatronatIds,
      scopeTenantIds: tenants.map((t) => t.tenantId),
    };
  }

  /**
   * Années scolaires ACTIVES du périmètre (délègue à resolveScopeYearsFor).
   * Garantit « données de l'année courante uniquement, sans mélange ».
   */
  async resolveScopeYears(
    scope: FederisScope,
  ): Promise<{ yearIds: string[]; label: string | null }> {
    return resolveScopeYearsFor(this.prisma, scope.patronat.tenantId, scope.scopeTenantIds);
  }

  // ── Propriété dans le périmètre (remplace les checks par tenant seul) ─────

  /**
   * Examen appartenant au périmètre du demandeur (national = ses examens +
   * ceux de tous les départements). Remplace `getOwnedExam` basé sur le seul
   * tenantId, qui excluait les examens des départements.
   */
  async getScopedExam(scope: FederisScope, examId: string) {
    const exam = await this.prisma.nationalExam.findFirst({
      where: { id: examId, patronatId: { in: scope.scopePatronatIds } },
    });
    if (!exam) {
      throw new NotFoundException('Examen introuvable dans votre périmètre.');
    }
    return exam;
  }

  // ── Garde d'écriture : national = lecture seule sauf délégation ──────────

  /**
   * Délégation active du coordonnateur d'un département pour un compte national.
   * @returns l'entrée de délégation ou null.
   */
  async findDelegation(
    territorialPatronatId: string,
    nationalUserId: string,
  ): Promise<DelegationEntry | null> {
    const child = await this.prisma.patronat.findUnique({
      where: { id: territorialPatronatId },
      select: { metadata: true },
    });
    if (!child) return null;
    return (
      readDelegations(child.metadata).find((d) => d.userId === nationalUserId) ?? null
    );
  }

  /**
   * Garde d'ÉCRITURE — à appeler dans toute méthode de modification :
   *   - territorial : neutre (les gardes de fonction existantes s'appliquent) ;
   *   - national    : refuse SAUF délégation active accordée par le
   *                   coordonnateur du patronat CIBLE (le département propriétaire).
   */
  async assertNationalWritable(
    scope: FederisScope,
    userId: string,
    targetPatronatId?: string | null,
  ): Promise<void> {
    if (!scope.isNational) return;
    const target = targetPatronatId || scope.patronat.id;
    if (target === scope.patronat.id) {
      // Le national n'écrit pas ses propres campagnes : l'organisation des
      // examens est du ressort des patronats départementaux.
      throw new ForbiddenException(
        "Accès en lecture seule — le patronat national consulte l'agrégation de tous les départements. " +
          "L'organisation des examens est menée par les patronats départementaux ; " +
          'un coordonnateur départemental peut vous déléguer un accès en modification.',
      );
    }
    const delegation = await this.findDelegation(target, userId);
    if (!delegation) {
      throw new ForbiddenException(
        'Accès en lecture seule — ce département ne vous a pas délégué de droits de modification. ' +
          "Demandez au coordonnateur du patronat départemental de vous donner la main « Délégation nationale ».",
      );
    }
  }

  /**
   * Variante pratique : résout le périmètre DEPUIS le tenant puis applique la
   * garde (utilisable quand le service appelant n'a pas déjà le scope).
   */
  async assertWritable(
    tenantId: string,
    userId: string,
    targetPatronatId?: string | null,
  ): Promise<void> {
    const scope = await this.resolveScope(tenantId, userId);
    await this.assertNationalWritable(scope, userId, targetPatronatId);
  }

  // ── API délégations (coordonnateur départemental) ─────────────────────────

  /** Délégations accordées par un patronat départemental (lecture). */
  async listDelegationsForPatronat(patronatId: string) {
    const patronat = await this.prisma.patronat.findUnique({
      where: { id: patronatId },
      select: { metadata: true },
    });
    if (!patronat) return [];
    return readDelegations(patronat.metadata).map((d) => ({
      userId: d.userId,
      email: d.email ?? null,
      name: d.name ?? null,
      grantedBy: d.grantedBy,
      grantedByName: d.grantedByName ?? null,
      grantedAt: d.grantedAt,
    }));
  }

  /**
   * Accorde une délégation d'écriture à un compte du patronat NATIONAL.
   * Appelée par le COORDONNATEUR du patronat départemental (le donneur de main).
   */
  async grantDelegation(
    scope: FederisScope,
    coordinatorUserId: string,
    dto: { email: string },
  ) {
    if (scope.isNational) {
      throw new ForbiddenException(
        'La délégation se donne depuis le patronat départemental, pas depuis le national.',
      );
    }
    const email = dto.email?.trim().toLowerCase();
    if (!email) throw new BadRequestException("L'email du compte national est requis.");

    // Le compte national doit exister : membre du patronat NATIONAL parent.
    const parent = await this.prisma.patronat.findFirst({
      where: { id: scope.patronat.id },
      select: { parentPatronatId: true },
    });
    if (!parent?.parentPatronatId) {
      throw new BadRequestException(
        "Ce patronat n'est rattaché à aucun patronat national — aucune délégation possible.",
      );
    }
    const nationalPatronat = await this.prisma.patronat.findUnique({
      where: { id: parent.parentPatronatId },
      select: { id: true, tenantId: true, name: true },
    });
    if (!nationalPatronat) {
      throw new NotFoundException('Patronat national introuvable.');
    }

    // Le compte national doit exister : membre du patronat NATIONAL parent
    // (patronat_users du tenant national), sinon n'importe quel compte connu
    // de la plateforme portant cet email (repli).
    const emailFilter = { equals: email, mode: 'insensitive' as const };
    const link = await this.prisma.patronatUser.findFirst({
      where: {
        tenantId: nationalPatronat.tenantId,
        isActive: true,
        user: { email: emailFilter },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    const candidate =
      link?.user ??
      (await this.prisma.user.findFirst({ where: { email: emailFilter } }));
    if (!candidate || candidate.email.toLowerCase() !== email) {
      throw new NotFoundException(
        "Aucun compte du patronat national ne correspond à cet email.",
      );
    }

    const coordinator = await this.prisma.user.findUnique({
      where: { id: coordinatorUserId },
      select: { firstName: true, lastName: true },
    });

    const current = await this.prisma.patronat.findUnique({
      where: { id: scope.patronat.id },
      select: { metadata: true },
    });
    const delegations = readDelegations(current?.metadata).filter(
      (d) => d.userId !== candidate.id,
    );
    delegations.push({
      userId: candidate.id,
      email: candidate.email,
      name: `${candidate.firstName ?? ''} ${candidate.lastName ?? ''}`.trim() || null,
      grantedBy: coordinatorUserId,
      grantedByName: coordinator
        ? `${coordinator.firstName ?? ''} ${coordinator.lastName ?? ''}`.trim() || null
        : null,
      grantedAt: new Date().toISOString(),
    });

    await this.prisma.patronat.update({
      where: { id: scope.patronat.id },
      data: {
        metadata: {
          ...(typeof current?.metadata === 'object' && current?.metadata
            ? (current.metadata as Record<string, unknown>)
            : {}),
          [DELEGATIONS_KEY]: delegations,
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: scope.patronat.tenantId,
        userId: coordinatorUserId,
        action: 'FEDERIS_NATIONAL_DELEGATION_GRANTED',
        resource: 'Patronat',
        resourceId: scope.patronat.id,
        tableName: 'patronats',
        recordId: scope.patronat.id,
        newData: { nationalUser: candidate.email },
      },
    });

    return {
      granted: true,
      delegation: {
        userId: candidate.id,
        email: candidate.email,
        name: `${candidate.firstName ?? ''} ${candidate.lastName ?? ''}`.trim() || null,
      },
    };
  }

  /** Révoque une délégation (coordonnateur départemental). */
  async revokeDelegation(
    scope: FederisScope,
    coordinatorUserId: string,
    nationalUserId: string,
  ) {
    if (scope.isNational) {
      throw new ForbiddenException(
        'La révocation se fait depuis le patronat départemental.',
      );
    }
    const current = await this.prisma.patronat.findUnique({
      where: { id: scope.patronat.id },
      select: { metadata: true },
    });
    const delegations = readDelegations(current?.metadata);
    const remaining = delegations.filter((d) => d.userId !== nationalUserId);
    if (remaining.length === delegations.length) {
      throw new NotFoundException('Aucune délégation à révoquer pour ce compte.');
    }
    await this.prisma.patronat.update({
      where: { id: scope.patronat.id },
      data: {
        metadata: {
          ...(typeof current?.metadata === 'object' && current?.metadata
            ? (current.metadata as Record<string, unknown>)
            : {}),
          [DELEGATIONS_KEY]: remaining,
        },
      },
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId: scope.patronat.tenantId,
        userId: coordinatorUserId,
        action: 'FEDERIS_NATIONAL_DELEGATION_REVOKED',
        resource: 'Patronat',
        resourceId: scope.patronat.id,
        tableName: 'patronats',
        recordId: scope.patronat.id,
        newData: { nationalUserId },
      },
    });
    return { revoked: true };
  }

  /**
   * Vue NATIONALE : pour chaque département du réseau, le statut de délégation
   * du compte connecté (utilisé par la barre de périmètre côté web).
   */
  async delegationsForNationalUser(scope: FederisScope, nationalUserId: string) {
    if (!scope.isNational) return [];
    const children = await this.prisma.patronat.findMany({
      where: { parentPatronatId: scope.patronat.id },
      select: { id: true, name: true, territoryName: true, metadata: true },
      orderBy: { territoryName: 'asc' },
    });
    return children.map((c) => {
      const mine = readDelegations(c.metadata).find((d) => d.userId === nationalUserId);
      return {
        patronatId: c.id,
        name: c.name,
        territoryName: c.territoryName,
        canWrite: !!mine,
        grantedAt: mine?.grantedAt ?? null,
        grantedByName: mine?.grantedByName ?? null,
      };
    });
  }
}
