/**
 * ============================================================================
 * FederisSchoolDirectoryService — RÉPERTOIRE OFFICIEL DES ÉTABLISSEMENTS
 * ============================================================================
 *
 * ⭐ 2026-09-30 (demande utilisateur) : le Bénin dispose de répertoires
 * officiels d'établissements privés par département (source initiale :
 * « Les établissements privés d'enseignement secondaire général du Bénin —
 * année scolaire 2022-2023 », Direction de l'Enseignement Secondaire
 * Général, 1 406 établissements, 12 départements). Ce répertoire sert de
 * base de suggestions au patronat pour :
 *
 *   1. CRÉATION D'ÉCOLES PROVISOIRES (module Écoles rattachées) — les écoles
 *      du département qui ne sont PAS encore sur Academia Helm sont
 *      suggérées au promoteur : il recherche, sélectionne, et la fiche est
 *      pré-remplie (nom, commune, arrondissement, directeur, téléphone).
 *      Une fois l'école créée à titre provisoire, un MESSAGE DU PATRONAT est
 *      automatiquement adressé au responsable de l'école pour l'inviter à
 *      créer son compte / son école sur la plateforme Academia Helm
 *      (email automatique si l'adresse est connue, message transmissible
 *      sinon — les répertoires officiels ne portent que des téléphones).
 *
 *   2. DÉSIGNATION DES CENTRES D'EXAMEN (module Centres) — le patronat
 *      sélectionne un établissement du répertoire comme centre d'accueil
 *      (pré-remplissage nom / adresse / contact). PLUSIEURS centres par
 *      examen sont possibles (ex. CEP → plusieurs centres sollicités selon
 *      les besoins du terrain) — déjà supporté par le schéma ExamCenter.
 *
 * Règles transverses :
 *   - Auto-guérison du schéma (ensureSchemaAndSeed, pattern FederisExams) :
 *     miroir EXACT de la migration 20260930130000_federis_school_directory +
 *     seed idempotent des 1 406 établissements (upsert par externalRef).
 *   - Isolation territoriale : la recherche est filtrée par le DÉPARTEMENT
 *     du patronat (territoryName → clés normalisées — le patronat
 *     « Département de l'Atlantique » voit les écoles de l'Atlantique).
 *     Un patronat NATIONAL voit tout le pays.
 *   - Écritures réservées au coordonnateur / organisateur (garde finale
 *     côté API, pattern resolvePatronat + WRITE_EXAM_ORG du contrôleur).
 */

import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../communication/services/email.service';
import {
  BENIN_SECONDARY_PRIVATE_SCHOOLS,
  DirectorySchoolRaw,
} from './data/benin-secondary-private-schools.data';
import {
  BENIN_DEPARTMENTS,
  departmentKeys,
  normalizeTerritoryKey,
} from '../common/constants/benin-territories';

/** DTO — recherche dans le répertoire (autocomplétion). */
export class SearchDirectoryDto {
  q?: string;
  /** Filtre optionnel : PRIMAIRE | SECONDAIRE (défaut : tous). */
  level?: string;
  /** Filtre optionnel : PUBLIC | PRIVE (défaut : tous). */
  sector?: string;
  /** Outre-passer le filtre départemental (patronat national uniquement). */
  allDepartments?: boolean;
  /** Nombre maximal de résultats (1..2000 — défaut 25 ; le MODAL de
   *  sélection demande la liste intégrale du département). */
  limit?: number;
}

/**
 * ⭐ Normalisation des numéros de téléphone béninois (2026-09-30) : depuis
 * le nouveau plan de numérotation national, TOUS les numéros sont précédés
 * de « 01 » (ex. « 95 34 71 54 » → « 01 95 34 71 54 »). Les répertoires
 * ministériels source (2022-2023) portent l'ancien format à 8 chiffres.
 *
 * Robustesse (données source parfois imparfaites — OCR, numéros doubles) :
 *   - déjà préfixé « 01 » → inchangé ;
 *   - indicatif international (« +… » / « (+…) ») → inchangé ;
 *   - moins de 4 chiffres (champ corrompu) → inchangé ;
 *   - sinon → préfixe « 01 » ajouté au début.
 */
export function normalizeBeninPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  if (/^01/i.test(trimmed)) return trimmed;
  if (/^\(?\+/i.test(trimmed)) return trimmed; // indicatif étranger (+225…)
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 4) return trimmed; // champ corrompu — ne pas dégrader
  return `01 ${trimmed}`;
}

/** DTO — création d'une école provisoire depuis une entrée du répertoire. */
export class CreateProvisionalSchoolDto {
  directoryEntryId!: string;
  /** Email du responsable (optionnel — déclenche l'invitation par email). */
  email?: string;
  /** Téléphone du responsable (défaut : celui du répertoire). */
  phone?: string;
}

/** Libellé du cycle du répertoire (« I » → « 1er cycle », « I ET II » → …). */
function cycleLabel(cycle: string | null): string | null {
  if (!cycle) return null;
  const c = cycle.trim().toUpperCase();
  if (c === 'I') return '1er cycle';
  if (c === 'II') return '2nd cycle';
  if (c === 'I ET II' || c === 'I & II' || c === 'I, II') return '1er et 2nd cycles';
  return cycle;
}

@Injectable()
export class FederisSchoolDirectoryService {
  private readonly logger = new Logger(FederisSchoolDirectoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  // ════════════════════════════════════════════════════════════════════
  // AUTO-GUÉRISON DU SCHÉMA + SEED IDEMPOTENT (pattern ensureSchema)
  // ════════════════════════════════════════════════════════════════════

  private schemaReady = false;

  /**
   * Miroir EXACT de la migration 20260930130000_federis_school_directory :
   * Railway n'exécute pas `prisma migrate deploy` au démarrage — la table
   * est créée idempotemment ici, puis le seed insère les établissements
   * manquants (par lots, clé unique externalRef).
   */
  private async ensureSchemaAndSeed(): Promise<void> {
    if (this.schemaReady) return;

    // 1. Table + index (CREATE ... IF NOT EXISTS — jamais d'erreur si existant)
    const ddl = [
      `CREATE TABLE IF NOT EXISTS "school_directory_entries" (
        "id" TEXT NOT NULL,
        "countryCode" TEXT NOT NULL DEFAULT 'BJ',
        "externalRef" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "level" TEXT NOT NULL,
        "sector" TEXT NOT NULL,
        "department" TEXT NOT NULL,
        "departmentLabel" TEXT,
        "commune" TEXT,
        "arrondissement" TEXT,
        "cycle" TEXT,
        "founderName" TEXT,
        "founderPhone" TEXT,
        "directorName" TEXT,
        "directorPhone" TEXT,
        "classesSummary" TEXT,
        "metadata" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "school_directory_entries_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "school_directory_entries_externalRef_key"
        ON "school_directory_entries"("externalRef")`,
      `CREATE INDEX IF NOT EXISTS "school_directory_entries_countryCode_department_idx"
        ON "school_directory_entries"("countryCode", "department")`,
      `CREATE INDEX IF NOT EXISTS "school_directory_entries_department_sector_level_idx"
        ON "school_directory_entries"("department", "sector", "level")`,
      `CREATE INDEX IF NOT EXISTS "school_directory_entries_name_idx"
        ON "school_directory_entries"("name")`,
    ];
    for (const sql of ddl) {
      await this.prisma.$executeRawUnsafe(sql);
    }

    // 1bis. ⭐ Migration idempotente du plan de numérotation : préfixe « 01 »
    //       sur les téléphones déjà en base (ancien format 8 chiffres). Les
    //       gardes (NOT LIKE '01%', pas d'indicatif « + », ≥ 4 chiffres)
    //       rendent l'UPDATE inoffensif aux exécutions suivantes.
    const phoneMigration = [
      `UPDATE "school_directory_entries"
         SET "founderPhone" = '01 ' || "founderPhone",
             "updatedAt" = CURRENT_TIMESTAMP
       WHERE "founderPhone" IS NOT NULL AND "founderPhone" <> ''
         AND "founderPhone" NOT LIKE '01%'
         AND "founderPhone" NOT LIKE '%+%'
         AND LENGTH(REGEXP_REPLACE("founderPhone", '[^0-9]', '', 'g')) >= 4`,
      `UPDATE "school_directory_entries"
         SET "directorPhone" = '01 ' || "directorPhone",
             "updatedAt" = CURRENT_TIMESTAMP
       WHERE "directorPhone" IS NOT NULL AND "directorPhone" <> ''
         AND "directorPhone" NOT LIKE '01%'
         AND "directorPhone" NOT LIKE '%+%'
         AND LENGTH(REGEXP_REPLACE("directorPhone", '[^0-9]', '', 'g')) >= 4`,
    ];
    for (const sql of phoneMigration) {
      await this.prisma.$executeRawUnsafe(sql);
    }

    // 2. Seed idempotent — insère uniquement les entrées manquantes
    const known = await this.prisma.schoolDirectoryEntry.count();
    if (known < BENIN_SECONDARY_PRIVATE_SCHOOLS.length) {
      const existing = new Set(
        (
          await this.prisma.schoolDirectoryEntry.findMany({
            select: { externalRef: true },
          })
        ).map((e) => e.externalRef),
      );
      const missing = BENIN_SECONDARY_PRIVATE_SCHOOLS.filter(
        (s) => !existing.has(s.ref),
      ).map((s) => this.toEntryData(s));
      for (let i = 0; i < missing.length; i += 200) {
        await this.prisma.schoolDirectoryEntry.createMany({
          data: missing.slice(i, i + 200),
          skipDuplicates: true,
        });
      }
      if (missing.length > 0) {
        this.logger.log(
          `Répertoire officiel : ${missing.length} établissement(s) importé(s) ` +
            `(total ${BENIN_SECONDARY_PRIVATE_SCHOOLS.length}).`,
        );
      }
    }

    this.schemaReady = true;
  }

  /** Traduit une ligne du dataset vers les colonnes de la table
   *  (téléphones normalisés au nouveau plan « 01 … »). */
  private toEntryData(s: DirectorySchoolRaw) {
    return {
      countryCode: 'BJ',
      externalRef: s.ref,
      name: s.name,
      level: 'SECONDAIRE',
      sector: 'PRIVE',
      department: s.department,
      departmentLabel: s.departmentLabel,
      commune: s.commune,
      arrondissement: s.arrondissement,
      cycle: s.cycle,
      founderName: s.founderName,
      founderPhone: normalizeBeninPhone(s.founderPhone),
      directorName: s.directorName,
      directorPhone: normalizeBeninPhone(s.directorPhone),
      classesSummary: s.classesAuthorized,
      metadata: { source: 'DES-2022-2023', country: 'Bénin' },
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // DÉPARTEMENT DU PATRONAT — clés normalisées du territoire
  // ════════════════════════════════════════════════════════════════════

  /**
   * Départements couverts par le patronat :
   *   - TERRITORIAL : son territoryName (« Département de l'Atlantique »)
   *     → départements canoniques inclus (alias 2016 acceptés) ;
   *   - NATIONAL : les 12 départements (aucun filtre).
   * Retourne null si le territoire ne correspond à AUCUN département connu
   * (le répertoire est alors inaccessible avec un message explicite).
   */
  private departmentsOfPatronat(patronat: {
    orgLevel: string;
    territoryName: string | null;
    countryId: string | null;
  }): string[] | null {
    if (patronat.orgLevel === 'NATIONAL') return [...BENIN_DEPARTMENTS];
    const territory = patronat.territoryName ?? '';
    const covered = BENIN_DEPARTMENTS.filter((d) => {
      const keys = departmentKeys(d);
      return (
        keys.has(normalizeTerritoryKey(territory)) ||
        [...keys].some((k) => k.length >= 4 && normalizeTerritoryKey(territory).includes(k))
      );
    });
    return covered.length > 0 ? covered : null;
  }

  // ════════════════════════════════════════════════════════════════════
  // RECHERCHE (autocomplétion — écoles rattachées & centres d'examen)
  // ════════════════════════════════════════════════════════════════════

  /**
   * Recherche des établissements du répertoire pour le département du
   * patronat. Réponse : entrées + départements couverts + compteurs.
   */
  async searchDirectory(
    patronat: {
      id: string;
      name: string;
      tenantId: string;
      orgLevel: string;
      territoryName: string | null;
      countryId: string | null;
    },
    dto: SearchDirectoryDto,
  ) {
    await this.ensureSchemaAndSeed();

    const departments = this.departmentsOfPatronat(patronat);
    if (departments === null) {
      return {
        entries: [],
        departments: [],
        nationalScope: false,
        totals: { establishments: 0, communes: 0 },
        warning:
          "Le territoire de votre patronat ne correspond à aucun département du répertoire officiel béninois. Vérifiez le territoire renseigné dans vos paramètres.",
      };
    }

    const q = (dto.q ?? '').trim();
    const where = {
      countryCode: 'BJ',
      department: { in: departments },
      ...(dto.level ? { level: dto.level.toUpperCase() } : {}),
      ...(dto.sector ? { sector: dto.sector.toUpperCase() } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { commune: { contains: q, mode: 'insensitive' as const } },
              { arrondissement: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    // ⭐ Limite ajustable : 25 par défaut (autocomplétion inline) ; le modal
    //    de sélection demande la liste intégrale (limit 2000 — plafonné).
    const take = Math.min(Math.max(Number(dto.limit ?? 25) || 25, 1), 2000);

    const [entries, total, communes] = await Promise.all([
      this.prisma.schoolDirectoryEntry.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        take,
        select: this.ENTRY_SELECT,
      }),
      this.prisma.schoolDirectoryEntry.count({
        where: { countryCode: 'BJ', department: { in: departments } },
      }),
      this.prisma.schoolDirectoryEntry.groupBy({
        by: ['commune'],
        where: { countryCode: 'BJ', department: { in: departments } },
        _count: { _all: true },
      }),
    ]);

    return {
      entries: entries.map((e) => ({
        ...e,
        founderPhone: normalizeBeninPhone(e.founderPhone),
        directorPhone: normalizeBeninPhone(e.directorPhone),
        cycleLabel: cycleLabel(e.cycle),
      })),
      departments,
      nationalScope: patronat.orgLevel === 'NATIONAL',
      totals: {
        establishments: total,
        communes: communes.filter((c) => c.commune).length,
      },
      warning: null,
    };
  }

  private readonly ENTRY_SELECT = {
    id: true,
    externalRef: true,
    name: true,
    level: true,
    sector: true,
    department: true,
    commune: true,
    arrondissement: true,
    cycle: true,
    founderName: true,
    founderPhone: true,
    directorName: true,
    directorPhone: true,
    classesSummary: true,
  } as const;

  // ════════════════════════════════════════════════════════════════════
  // CRÉATION D'ÉCOLE PROVISOIRE + INVITATION AUTOMATIQUE DU RESPONSABLE
  // ════════════════════════════════════════════════════════════════════

  /**
   * Crée une école PROVISOIRE (hors Academia Helm) depuis une entrée du
   * répertoire officiel, puis adresse automatiquement au responsable de
   * l'école un message du patronat l'invitant à créer son compte / son
   * école sur Academia Helm :
   *   - par EMAIL si l'adresse est connue (saisie par le promoteur) ;
   *   - sinon un message prêt à transmettre est retourné (les répertoires
   *     officiels ne portent que des numéros de téléphone).
   */
  async createProvisionalSchool(
    patronat: {
      id: string;
      name: string;
      tenantId: string;
      orgLevel: string;
      territoryName: string | null;
      countryId: string | null;
    },
    userId: string,
    dto: CreateProvisionalSchoolDto,
  ) {
    await this.ensureSchemaAndSeed();

    if (!dto.directoryEntryId?.trim()) {
      throw new BadRequestException("L'entrée du répertoire est requise.");
    }

    const entry = await this.prisma.schoolDirectoryEntry.findUnique({
      where: { id: dto.directoryEntryId },
      select: this.ENTRY_SELECT,
    });
    if (!entry) {
      throw new NotFoundException('Établissement introuvable dans le répertoire officiel.');
    }

    // Cohérence territoriale : l'établissement doit être du département du patronat
    const departments = this.departmentsOfPatronat(patronat);
    if (departments && !departments.includes(entry.department)) {
      throw new BadRequestException(
        `Cet établissement relève du département ${entry.department}, hors du territoire de votre patronat.`,
      );
    }

    // Doublon : cette école du répertoire est-elle déjà créée (provisoire ou manuelle) ?
    const existingSchools = await this.prisma.patronatManualSchool.findMany({
      where: { patronatId: patronat.id },
      select: { id: true, name: true, metadata: true },
    });
    const already = existingSchools.find(
      (s) =>
        (s.metadata as any)?.directoryExternalRef === entry.externalRef ||
        String(s.name).trim().toLowerCase() === entry.name.trim().toLowerCase(),
    );
    if (already) {
      throw new BadRequestException(
        `« ${entry.name} » figure déjà parmi vos écoles rattachées (création hors Academia Helm).`,
      );
    }

    // Adresse lisible : « Commune, Arrondissement »
    const addressParts = [entry.commune, entry.arrondissement].filter(Boolean);
    const email = dto.email?.trim().toLowerCase() || null;
    const phone = dto.phone?.trim() || entry.directorPhone || entry.founderPhone || null;
    const invitationToken = randomBytes(16).toString('hex');

    const school = await this.prisma.patronatManualSchool.create({
      data: {
        patronatId: patronat.id,
        tenantId: patronat.tenantId,
        name: entry.name,
        address: addressParts.join(', '),
        contactPerson: entry.directorName ?? entry.founderName,
        phone,
        email,
        status: 'PROVISIONAL',
        metadata: {
          source: 'OFFICIAL_DIRECTORY',
          directoryEntryId: entry.id,
          directoryExternalRef: entry.externalRef,
          department: entry.department,
          commune: entry.commune,
          cycle: entry.cycle,
          sector: entry.sector,
          level: entry.level,
          createdBy: userId,
          createdAt: new Date().toISOString(),
          invitationToken,
          invitedAt: new Date().toISOString(),
        },
      },
    });

    // ── Message automatique du patronat au responsable de l'école ─────────
    const onboardingUrl = this.onboardingUrl(entry.name);
    const invitation = await this.sendInvitation(patronat, school, entry, email, onboardingUrl);

    // Traçabilité : audit log + notification in-app de l'équipe du patronat
    await this.prisma.auditLog
      .create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_PROVISIONAL_SCHOOL_CREATED',
          resource: 'PatronatManualSchool',
          resourceId: school.id,
          tableName: 'patronat_manual_schools',
          recordId: school.id,
          newData: {
            name: school.name,
            source: 'OFFICIAL_DIRECTORY',
            department: entry.department,
            invitationSent: invitation.sent,
            invitationChannel: invitation.channel,
          },
        },
      })
      .catch(() => undefined);

    this.logger.log(
      `École provisoire « ${school.name} » créée (${entry.department}) — invitation ${invitation.channel}.`,
    );

    return {
      success: true,
      school: {
        id: school.id,
        name: school.name,
        address: school.address,
        contactPerson: school.contactPerson,
        phone: school.phone,
        status: school.status,
        department: entry.department,
        commune: entry.commune,
        cycleLabel: cycleLabel(entry.cycle),
      },
      invitation,
    };
  }

  /** URL publique d'inscription / création d'école sur Academia Helm. */
  private onboardingUrl(schoolName: string): string {
    const frontend = (
      this.configService.get<string>('FRONTEND_URL') || 'https://academiahelm.com'
    )
      .trim()
      .replace(/\/+$/, '');
    const encoded = encodeURIComponent(schoolName);
    return `${frontend}/onboarding?school=${encoded}&invitation=patronat`;
  }

  /**
   * Message automatique adressé au responsable de l'école : l'invitant à
   * créer son compte et son école sur Academia Helm. Email si l'adresse est
   * connue ; sinon le message est retourné au promoteur pour transmission
   * (téléphone / WhatsApp — les répertoires officiels n'ont pas d'emails).
   */
  private async sendInvitation(
    patronat: { name: string; territoryName: string | null },
    school: { name: string; phone: string | null },
    entry: { department: string; commune: string | null; directorName: string | null },
    email: string | null,
    onboardingUrl: string,
  ): Promise<{
    sent: boolean;
    channel: 'EMAIL' | 'MANUAL';
    message: string;
    link: string;
  }> {
    const territory = patronat.territoryName ?? patronat.name;
    const message =
      `Madame, Monsieur,\n\n` +
      `Le ${patronat.name}${territory && territory !== patronat.name ? ` (${territory})` : ''} ` +
      `a inscrit votre établissement « ${school.name} »` +
      `${entry.commune ? `, commune de ${entry.commune} (${entry.department})` : ` (${entry.department})`}` +
      `, à titre provisoire dans son répertoire des écoles rattachées, en vue de l'organisation des examens nationaux.\n\n` +
      `Afin de finaliser ce rattachement et de permettre à votre établissement de présenter ses candidats ` +
      `et ses enseignants aux examens, nous vous invitons à créer le compte de votre école sur la plateforme ` +
      `Academia Helm :\n${onboardingUrl}\n\n` +
      `La création est gratuite et guidée ; votre école apparaîtra ensuite officiellement dans notre répertoire. ` +
      `Pour toute assistance, contactez l'équipe technique d'Academia Helm.\n\n` +
      `Veuillez agréer, Madame, Monsieur, l'expression de notre considération distinguée.\n\n` +
      `Le Coordinateur du Patronat`;

    if (email) {
      const subject = `Invitation — créez l'école « ${school.name} » sur Academia Helm`;
      const html =
        `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:auto">` +
        `<p>Madame, Monsieur,</p>` +
        `<p>Le <b>${patronat.name}</b>${territory && territory !== patronat.name ? ` (${territory})` : ''} ` +
        `a inscrit votre établissement <b>« ${school.name} »</b>` +
        `${entry.commune ? `, commune de ${entry.commune} (${entry.department})` : ` (${entry.department})`}` +
        `, à titre <b>provisoire</b> dans son répertoire des écoles rattachées, en vue de l'organisation des examens nationaux.</p>` +
        `<p>Afin de finaliser ce rattachement et de permettre à votre établissement de présenter ses candidats ` +
        `et ses enseignants aux examens, nous vous invitons à créer le compte de votre école sur la plateforme ` +
        `<b>Academia Helm</b> :</p>` +
        `<p style="text-align:center;margin:28px 0">` +
        `<a href="${onboardingUrl}" style="background:#1e3a8a;color:#fff;padding:14px 28px;border-radius:10px;` +
        `text-decoration:none;font-weight:700">Créer l'école « ${school.name} »</a></p>` +
        `<p style="color:#64748b">${onboardingUrl}</p>` +
        `<p>La création est gratuite et guidée ; votre école apparaîtra ensuite officiellement dans notre répertoire. ` +
        `Pour toute assistance, contactez l'équipe technique d'Academia Helm.</p>` +
        `<p>Veuillez agréer, Madame, Monsieur, l'expression de notre considération distinguée.</p>` +
        `<p style="margin-top:24px"><b>Le Coordinateur du Patronat</b></p>` +
        `</div>`;
      try {
        await this.emailService.sendEmail({
          to: email,
          subject,
          text: message,
          html,
        });
        return { sent: true, channel: 'EMAIL', message, link: onboardingUrl };
      } catch (e: any) {
        this.logger.warn(`Email d'invitation échoué (${email}) : ${e?.message}`);
        // Bascule en transmission manuelle plutôt qu'un échec bloquant
      }
    }

    return {
      sent: false,
      channel: 'MANUAL',
      message,
      link: onboardingUrl,
    };
  }
}
