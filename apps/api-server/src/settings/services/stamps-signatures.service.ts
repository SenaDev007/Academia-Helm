import { prismaCreateDefaults, prismaCreateNoUpdatedAt, prismaUpdateDefaults } from '../../common/utils/prisma-helpers';
/**
 * ============================================================================
 * CACHETS & SIGNATURES GÉNÉRÉS — PAR TENANT, NIVEAU SCOLAIRE ET RÔLE
 * ============================================================================
 * Cachets : un set (circulaire, rectangulaire, ovale) par niveau scolaire (ou global).
 * Signatures : une par responsable (niveau + rôle : DIRECTEUR, COMPTABLE, etc.).
 * Stockage tenant_stamps (educationLevelId nullable), tenant_signatures (educationLevelId + role).
 * ============================================================================
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../../database/prisma.service';
import { PuppeteerPoolService } from '../../common/services/puppeteer-pool.service';
import { IdentityProfileService } from './identity-profile.service';

const STAMPS_DIR = 'uploads/tenant-stamps';
const SIGNATURES_DIR = 'uploads/tenant-signatures';

/** Rôles/départements administratifs pour les signatures */
export const SIGNATURE_ROLES = ['DIRECTEUR', 'DIRECTEUR_ADJOINT', 'COMPTABLE', 'SECRETAIRE', 'AUTRE'] as const;
export type SignatureRole = (typeof SIGNATURE_ROLES)[number];

/** Types de cachets générables */
export const STAMP_FORMATS = ['circular', 'rectangular', 'oval'] as const;
export type StampFormat = (typeof STAMP_FORMATS)[number];

interface IdentityProfileData {
  schoolName: string;
  schoolAcronym?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  postalCode?: string | null;
  phonePrimary?: string | null;
  phoneSecondary?: string | null;
  email?: string | null;
  website?: string | null;
  logoUrl?: string | null;
}

@Injectable()
export class StampsSignaturesService {
  private readonly logger = new Logger(StampsSignaturesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly identityProfile: IdentityProfileService,
    private readonly puppeteerPool: PuppeteerPoolService,
  ) {}

  /**
   * Liste des cachets du tenant (tous niveaux + global). Pour les documents : récupérer par niveau ou global.
   * Tri : global (educationLevelId null) en premier, puis par ordre du niveau scolaire (educationLevel.order).
   */
  async getStampsList(tenantId: string) {
    const delegate = this.prisma?.tenantStamp;
    if (!delegate?.findMany) {
      this.logger.warn(
        'Prisma client missing tenantStamp delegate. Run: npx prisma generate --schema=prisma/schema.prisma',
      );
      return [];
    }
    const rows = await delegate.findMany({
      where: { tenantId },
      include: { educationLevel: { select: { id: true, name: true, order: true } } },
    });
    const sorted = [...rows].sort((a, b) => {
      const aNull = a.educationLevelId == null ? 0 : 1;
      const bNull = b.educationLevelId == null ? 0 : 1;
      if (aNull !== bNull) return aNull - bNull;
      if (a.educationLevelId == null && b.educationLevelId == null) return 0;
      const aOrder = a.educationLevel?.order ?? 999;
      const bOrder = b.educationLevel?.order ?? 999;
      return aOrder - bOrder;
    });
    return sorted.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      educationLevelId: r.educationLevelId,
      educationLevelName: r.educationLevel?.name ?? null,
      circularStampUrl: r.circularStampUrl,
      rectangularStampUrl: r.rectangularStampUrl,
      ovalStampUrl: r.ovalStampUrl,
      generatedAt: r.generatedAt?.toISOString() ?? null,
    }));
  }

  /**
   * Un set de cachets pour un niveau (ou global si educationLevelId null). Pour usage dans les documents.
   */
  async getStamps(tenantId: string, educationLevelId?: string | null) {
    const levelId = educationLevelId ?? null;
    const row =
      levelId != null
        ? await this.prisma.tenantStamp.findUnique({
            where: { tenantId_educationLevelId: { tenantId, educationLevelId: levelId } },
            include: { educationLevel: { select: { id: true, name: true } } },
          })
        : await this.prisma.tenantStamp.findFirst({
            where: { tenantId, educationLevelId: null },
            include: { educationLevel: { select: { id: true, name: true } } },
          });
    if (!row) {
      return {
        educationLevelId: educationLevelId ?? null,
        educationLevelName: null,
        circularStampUrl: null,
        rectangularStampUrl: null,
        ovalStampUrl: null,
        generatedAt: null,
      };
    }
    return {
      educationLevelId: row.educationLevelId,
      educationLevelName: row.educationLevel?.name ?? null,
      circularStampUrl: row.circularStampUrl,
      rectangularStampUrl: row.rectangularStampUrl,
      ovalStampUrl: row.ovalStampUrl ?? null,
      generatedAt: row.generatedAt?.toISOString() ?? null,
    };
  }

  /**
   * Liste des signatures du tenant (optionnel filtre par niveau). Pour les documents : récupérer par niveau + rôle.
   */
  async getSignaturesList(tenantId: string, educationLevelId?: string | null) {
    const delegate = this.prisma?.tenantSignature;
    if (!delegate?.findMany) {
      this.logger.warn(
        'Prisma client missing tenantSignature delegate. Run: npx prisma generate --schema=prisma/schema.prisma',
      );
      return [];
    }
    const rows = await delegate.findMany({
      where: {
        tenantId,
        ...(educationLevelId !== undefined && educationLevelId !== null
          ? { educationLevelId }
          : {}),
      },
      include: { educationLevel: { select: { id: true, name: true } } },
      orderBy: [{ educationLevelId: 'asc' }, { role: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      educationLevelId: r.educationLevelId,
      educationLevelName: r.educationLevel?.name ?? null,
      role: r.role,
      holderFirstName: r.holderFirstName,
      holderLastName: r.holderLastName,
      holderName: `${r.holderFirstName} ${r.holderLastName}`.trim(),
      signatureUrl: r.signatureUrl,
      generatedAt: r.generatedAt?.toISOString() ?? null,
    }));
  }

  /**
   * Une signature par id (pour affichage asset).
   */
  async getSignatureById(signatureId: string, tenantId: string) {
    const row = await this.prisma.tenantSignature.findFirst({
      where: { id: signatureId, tenantId },
      include: { educationLevel: { select: { name: true } } },
    });
    if (!row) return null;
    return {
      id: row.id,
      educationLevelId: row.educationLevelId,
      educationLevelName: row.educationLevel?.name ?? null,
      role: row.role,
      holderName: `${row.holderFirstName} ${row.holderLastName}`.trim(),
      signatureUrl: row.signatureUrl,
      generatedAt: row.generatedAt?.toISOString() ?? null,
    };
  }

  /**
   * Génère les cachets pour un niveau (ou global si educationLevelId null). Enregistre en BDD et sur disque.
   */
  async generateStamps(
    tenantId: string,
    options?: { formats?: StampFormat[]; educationLevelId?: string | null },
  ): Promise<{
    educationLevelId: string | null;
    circularStampUrl: string | null;
    rectangularStampUrl: string | null;
    ovalStampUrl: string | null;
    generatedAt: string;
  }> {
    const formats: StampFormat[] =
      options?.formats?.length ? options.formats : [...STAMP_FORMATS];
    const educationLevelId = options?.educationLevelId ?? null;

    const profile = await this.identityProfile.getActiveProfile(tenantId);
    if (!profile) {
      throw new BadRequestException(
        'Profil d\'identité requis. Renseignez l\'onglet Identité avant de générer les cachets.',
      );
    }

    const data: IdentityProfileData = {
      schoolName: profile.schoolName ?? 'Établissement',
      schoolAcronym: profile.schoolAcronym,
      address: profile.address,
      city: profile.city,
      country: profile.country ?? 'Bénin',
      postalCode: profile.postalCode,
      phonePrimary: profile.phonePrimary,
      phoneSecondary: profile.phoneSecondary,
      email: profile.email,
      website: profile.website,
      logoUrl: (profile as any).logoUrl ?? null,
    };

    const cwd = process.cwd();
    const levelFolder = educationLevelId ?? 'global';
    const stampsDir = path.join(cwd, STAMPS_DIR, tenantId, levelFolder);
    await fs.mkdir(stampsDir, { recursive: true });

    // findUnique n'accepte pas null dans la clé composite → findFirst quand educationLevelId est null
    const existing =
      educationLevelId != null
        ? await this.prisma.tenantStamp.findUnique({
            where: { tenantId_educationLevelId: { tenantId, educationLevelId } },
          })
        : await this.prisma.tenantStamp.findFirst({
            where: { tenantId, educationLevelId: null },
          });
    const now = new Date();
    let circularStampUrl = existing?.circularStampUrl ?? null;
    let rectangularStampUrl = existing?.rectangularStampUrl ?? null;
    let ovalStampUrl = existing?.ovalStampUrl ?? null;

    if (formats.includes('circular')) {
      const circularSvg = this.buildCircularStampSvg(data);
      const circularPath = path.join(stampsDir, 'circular.png');
      // ⭐ TRANSPARENT background — no white fill, so the stamp overlays cleanly on documents
      await this.svgToPng(circularSvg, circularPath, 700, 700, true);
      circularStampUrl = `${STAMPS_DIR}/${tenantId}/${levelFolder}/circular.png`;
    }
    if (formats.includes('rectangular')) {
      const rectangularSvg = this.buildRectangularStampSvg(data);
      const rectangularPath = path.join(stampsDir, 'rectangular.png');
      // ⭐ TRANSPARENT background
      await this.svgToPng(rectangularSvg, rectangularPath, 840, 300, true);
      rectangularStampUrl = `${STAMPS_DIR}/${tenantId}/${levelFolder}/rectangular.png`;
    }
    if (formats.includes('oval')) {
      const ovalSvg = this.buildOvalStampSvg(data);
      const ovalPath = path.join(stampsDir, 'oval.png');
      await this.svgToPng(ovalSvg, ovalPath, 360, 240);
      ovalStampUrl = `${STAMPS_DIR}/${tenantId}/${levelFolder}/oval.png`;
    }

    // upsert n'accepte pas null dans la clé composite → update ou create quand educationLevelId est null
    if (educationLevelId != null) {
      await this.prisma.tenantStamp.upsert({
        where: { tenantId_educationLevelId: { tenantId, educationLevelId } },
        create: {
          ...prismaCreateDefaults(),
          tenantId,
          educationLevelId,
          circularStampUrl,
          rectangularStampUrl,
          ovalStampUrl,
          generatedAt: now,
        },
        update: {
         ...prismaUpdateDefaults(),
          ...(circularStampUrl !== null && { circularStampUrl }),
          ...(rectangularStampUrl !== null && { rectangularStampUrl }),
          ...(ovalStampUrl !== null && { ovalStampUrl }),
          generatedAt: now,
        },
      });
    } else {
      if (existing) {
        await this.prisma.tenantStamp.update({
          where: { id: existing.id },
          data: {
        ...prismaUpdateDefaults(),
            ...(circularStampUrl !== null && { circularStampUrl }),
            ...(rectangularStampUrl !== null && { rectangularStampUrl }),
            ...(ovalStampUrl !== null && { ovalStampUrl }),
            generatedAt: now,
          },
        });
      } else {
        await this.prisma.tenantStamp.create({
          data: {
        ...prismaCreateDefaults(),
            tenantId,
            educationLevelId: null,
            circularStampUrl,
            rectangularStampUrl,
            ovalStampUrl,
            generatedAt: now,
          },
        });
      }
    }

    this.logger.log(`Cachets générés tenant=${tenantId} level=${levelFolder}: ${formats.join(', ')}`);
    return {
      educationLevelId,
      circularStampUrl,
      rectangularStampUrl,
      ovalStampUrl,
      generatedAt: now.toISOString(),
    };
  }

  /**
   * ⭐ DISCORD PARITY — Génère un cachet NOMINATIF pour un titulaire de poste.
   *
   * Produit un cachet rectangulaire professionnel (effet encre, rotation légère,
   * double bordure) avec le nom du titulaire (grand) + le rôle (plus petit).
   * Le PNG est sauvegardé dans uploads/tenant-stamps/<tenantId>/nominative/<role>.png
   * et l'URL est retournée pour affichage immédiat.
   *
   * @param tenantId       Le tenant courant
   * @param holderName     Nom complet du titulaire (ex: "M. Jean Dupont")
   * @param holderRole     Rôle/libellé (ex: "DIRECTEUR", "SECRÉTAIRE-COMPTABLE")
   * @param educationLevelId  Optionnel — niveau scolaire (pour cachets par niveau)
   */
  async generateNominativeStamp(
    tenantId: string,
    holderName: string,
    holderRole: string,
    educationLevelId?: string | null,
  ): Promise<{ stampUrl: string; generatedAt: string }> {
    if (!holderName?.trim()) {
      throw new BadRequestException('Le nom du titulaire est requis pour générer un cachet nominatif.');
    }

    const cwd = process.cwd();
    const levelFolder = educationLevelId ?? 'global';
    const roleSlug = (holderRole || 'role').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const stampsDir = path.join(cwd, STAMPS_DIR, tenantId, levelFolder, 'nominative');
    await fs.mkdir(stampsDir, { recursive: true });

    const svg = this.buildNominativeStampSvg(holderName, holderRole);
    const stampPath = path.join(stampsDir, `${roleSlug}.png`);
    // ⭐ TRANSPARENT background for nominative stamps
    await this.svgToPng(svg, stampPath, 840, 300, true);

    const stampUrl = `${STAMPS_DIR}/${tenantId}/${levelFolder}/nominative/${roleSlug}.png`;
    this.logger.log(`Cachet nominatif généré: tenant=${tenantId} role=${roleSlug} name="${holderName}"`);
    return { stampUrl, generatedAt: new Date().toISOString() };
  }

  /**
   * ⭐ Génère les DEUX cachets pour un staff spécifique :
   *    1. Cachet CIRCULAIRE nominatif — acronyme école en haut + adresse +
   *       téléphone en bas + RÔLE du titulaire au centre (au lieu du logo)
   *    2. Cachet RECTANGULAIRE nominatif — nom du titulaire (grand) + rôle
   *       en dessous
   *
   * Cette méthode est appelée par le bouton « Cachet » dans RH >
   * Administration pour chaque staff de l'équipe administrative. Les deux
   * PNGs sont sauvegardés dans uploads/tenant-stamps/<tenantId>/<level>/
   * nominative/ et leurs URLs sont retournées pour affichage dans le modal.
   *
   * ⭐ Les cachets sont persistés sur disque (réutilisables après reload),
   *    mais il n'y a pas de table DB dédiée pour les cachets nominatifs —
   *    on les identifie par leur filename `<roleSlug>.png` (cachet
   *    rectangulaire) et `<roleSlug>-circular.png` (cachet circulaire).
   *
   * @param tenantId          Le tenant courant
   * @param holderName        Nom complet du titulaire (ex: "Erhel DEGBE")
   * @param holderRole        Rôle du titulaire (ex: "PROMOTEUR",
   *                          "DIRECTEUR", "SECRÉTAIRE-COMPTABLE")
   * @param educationLevelId  Optionnel — niveau scolaire (pour cachets par
   *                          niveau). Si null, les cachets sont stockés dans
   *                          le dossier "global".
   */
  async generateStampsForStaff(
    tenantId: string,
    holderName: string,
    holderRole: string,
    educationLevelId?: string | null,
  ): Promise<{
    circularStampUrl: string;
    rectangularStampUrl: string;
    generatedAt: string;
  }> {
    if (!holderName?.trim()) {
      throw new BadRequestException('Le nom du titulaire est requis pour générer les cachets.');
    }
    if (!holderRole?.trim()) {
      throw new BadRequestException('Le rôle du titulaire est requis pour générer les cachets.');
    }

    // Récupérer le profil d'identité pour l'acronyme + adresse + téléphone
    const profile = await this.identityProfile.getActiveProfile(tenantId);
    if (!profile) {
      throw new BadRequestException(
        'Profil d\'identité requis. Renseignez l\'onglet Identité avant de générer les cachets.',
      );
    }
    const data: IdentityProfileData = {
      schoolName: profile.schoolName ?? 'Établissement',
      schoolAcronym: profile.schoolAcronym,
      address: profile.address,
      city: profile.city,
      country: profile.country ?? 'Bénin',
      postalCode: profile.postalCode,
      phonePrimary: profile.phonePrimary,
      phoneSecondary: profile.phoneSecondary,
      email: profile.email,
      website: profile.website,
      logoUrl: (profile as any).logoUrl ?? null,
    };

    const cwd = process.cwd();
    const levelFolder = educationLevelId ?? 'global';
    // ⭐ roleSlug nettoyé (minuscules, sans accents ni caractères spéciaux)
    //    pour un filename valide sur tous les filesystems. On retire aussi
    //    les accents du rôle français (ex: "SECRÉTAIRE" → "secretaire").
    const roleSlug = (holderRole || 'role')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const stampsDir = path.join(cwd, STAMPS_DIR, tenantId, levelFolder, 'nominative');
    await fs.mkdir(stampsDir, { recursive: true });

    // 1. Cachet CIRCULAIRE nominatif (rôle au centre)
    const circularSvg = this.buildNominativeCircularStampSvg(data, holderRole);
    const circularPath = path.join(stampsDir, `${roleSlug}-circular.png`);
    // ⭐ TRANSPARENT background — no white fill
    await this.svgToPng(circularSvg, circularPath, 700, 700, true);
    const circularStampUrl = `${STAMPS_DIR}/${tenantId}/${levelFolder}/nominative/${roleSlug}-circular.png`;

    // 2. Cachet RECTANGULAIRE nominatif (nom + rôle)
    const rectangularSvg = this.buildNominativeStampSvg(holderName, holderRole);
    const rectangularPath = path.join(stampsDir, `${roleSlug}.png`);
    // ⭐ TRANSPARENT background
    await this.svgToPng(rectangularSvg, rectangularPath, 840, 300, true);
    const rectangularStampUrl = `${STAMPS_DIR}/${tenantId}/${levelFolder}/nominative/${roleSlug}.png`;

    this.logger.log(`Cachets générés pour staff: tenant=${tenantId} role=${roleSlug} name="${holderName}" → circulaire=${circularStampUrl} rectangulaire=${rectangularStampUrl}`);

    return {
      circularStampUrl,
      rectangularStampUrl,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Génère la signature d'un responsable (niveau + rôle). Crée ou met à jour la ligne et enregistre le PNG.
   */
  async generateSignature(
    tenantId: string,
    role: string,
    holderFirstName: string,
    holderLastName: string,
    educationLevelId?: string | null,
  ): Promise<{
    id: string;
    educationLevelId: string | null;
    role: string;
    holderName: string;
    signatureUrl: string;
    generatedAt: string;
  }> {
    const first = (holderFirstName ?? '').trim();
    const last = (holderLastName ?? '').trim();
    if (!first || !last) {
      throw new BadRequestException('Prénom et nom du responsable sont requis.');
    }
    const levelId = educationLevelId ?? null;

    const cwd = process.cwd();
    const sigDir = path.join(cwd, SIGNATURES_DIR, tenantId);
    await fs.mkdir(sigDir, { recursive: true });

    const signatureSvg = this.buildSignatureSvg(first, last);
    const now = new Date();

    // upsert n'accepte pas null dans la clé composite → findFirst + create/update quand educationLevelId est null
    let row: { id: string };
    if (levelId != null) {
      row = await this.prisma.tenantSignature.upsert({
        where: {
          tenantId_educationLevelId_role: { tenantId, educationLevelId: levelId, role },
        },
        create: {
          ...prismaCreateNoUpdatedAt(),
          tenantId,
          educationLevelId: levelId,
          role,
          holderFirstName: first,
          holderLastName: last,
          signatureUrl: null as any,
          generatedAt: now,
        },
        update: {
          holderFirstName: first,
          holderLastName: last,
          generatedAt: now,
        },
      });
    } else {
      const existing = await this.prisma.tenantSignature.findFirst({
        where: { tenantId, educationLevelId: null, role },
      });
      if (existing) {
        row = await this.prisma.tenantSignature.update({
          where: { id: existing.id },
          data: {
            holderFirstName: first,
            holderLastName: last,
            generatedAt: now,
          },
        });
      } else {
        row = await this.prisma.tenantSignature.create({
          data: {
        ...prismaCreateNoUpdatedAt(),
            tenantId,
            educationLevelId: null,
            role,
            holderFirstName: first,
            holderLastName: last,
            signatureUrl: null as any,
            generatedAt: now,
          },
        });
      }
    }

    const signaturePath = path.join(sigDir, `${row.id}.png`);
    await this.svgToPng(signatureSvg, signaturePath, 280, 90, true);
    const signatureUrl = `${SIGNATURES_DIR}/${tenantId}/${row.id}.png`;

    await this.prisma.tenantSignature.update({
      where: { id: row.id },
      data: { signatureUrl, generatedAt: now },
    });

    this.logger.log(`Signature générée tenant=${tenantId} level=${levelId} role=${role}: ${first} ${last}`);
    return {
      id: row.id,
      educationLevelId: levelId,
      role,
      holderName: `${first} ${last}`,
      signatureUrl,
      generatedAt: now.toISOString(),
    };
  }

  /**
   * Chemin disque pour streamer un asset.
   * - Stamps : type + tenantId + educationLevelId (null = 'global').
   * - Signature : signatureId (le fichier est tenantId/signatureId.png).
   */
  getAssetPath(
    tenantId: string,
    type: 'circular' | 'rectangular' | 'oval',
    educationLevelId?: string | null,
  ): string | null;
  getAssetPath(tenantId: string, type: 'signature', signatureId: string): string | null;
  getAssetPath(
    tenantId: string,
    type: 'circular' | 'rectangular' | 'oval' | 'signature' | 'nominative_circular' | 'nominative_rectangular',
    educationLevelIdOrSignatureId?: string | null,
  ): string | null {
    const cwd = process.cwd();
    if (type === 'signature') {
      if (!educationLevelIdOrSignatureId) return null;
      return path.join(cwd, SIGNATURES_DIR, tenantId, `${educationLevelIdOrSignatureId}.png`);
    }
    // ⭐ Cachets nominatifs (par staff) : situés dans
    //    uploads/tenant-stamps/<tenantId>/<levelFolder>/nominative/
    //    Le 2e paramètre est le "roleSlug" (ex: "promoteur",
    //    "directeur", "secretaire-comptable") qui sert de filename.
    //    Pour le circulaire, on ajoute "-circular.png" au filename.
    if (type === 'nominative_circular' || type === 'nominative_rectangular') {
      if (!educationLevelIdOrSignatureId) return null;
      // Format reçu : "nominative_<levelFolder>_<roleSlug>" (pour rester
      // compatible avec le pattern signature_id existant utilisé par le
      // frontend). On parse pour récupérer levelFolder et roleSlug.
      const raw = String(educationLevelIdOrSignatureId);
      const match = raw.match(/^nominative_([^_]+(?:_[^_]+)*)_(.+)$/);
      if (!match) return null;
      const levelFolder = match[1];
      const roleSlug = match[2];
      const fileName = type === 'nominative_circular'
        ? `${roleSlug}-circular.png`
        : `${roleSlug}.png`;
      return path.join(cwd, STAMPS_DIR, tenantId, levelFolder, 'nominative', fileName);
    }
    const levelFolder = educationLevelIdOrSignatureId ?? 'global';
    return path.join(cwd, STAMPS_DIR, tenantId, levelFolder, `${type}.png`);
  }

  // ---------- Génération SVG ----------
  /** Couleur principale des cachets (rouge cachet) */
  private static readonly STAMP_RED = '#b71c1c';
  /** Couleur secondaire (texte secondaire, légèrement plus clair) */
  private static readonly STAMP_RED_SECONDARY = '#c62828';

  /**
   * ⭐ PROFESSIONAL CIRCULAR STAMP — Ink-stamp rendering (Discord-quality).
   *
   * Reproduces the visual approach from the Claude AI reference file
   * (cachet_academia_helm.html): SVG with feTurbulence + feDisplacementMap
   * ink effect, slight rotation, 3 concentric circles, top-arc ACRONYM +
   * bottom-arc address/phone, star decorations, center LOGO + subtitle.
   *
   * ⭐ TRANSPARENT background (no white fill) — the stamp overlays cleanly
   *    on any document background.
   * ⭐ Uses schoolAcronym (not full schoolName) for the top arc.
   * ⭐ Uses the school logoUrl in the center circle (if available).
   */
  private buildCircularStampSvg(data: IdentityProfileData): string {
    const acronym = this.escapeXml(data.schoolAcronym || data.schoolName || 'Établissement');
    // Bottom arc: phone + city + country (increased font size for readability)
    const phone = this.escapeXml([data.phonePrimary, data.phoneSecondary].filter(Boolean).join(' • ') || '');
    const addressParts = [phone, data.city, data.country].filter(Boolean);
    const addressLine = this.escapeXml(addressParts.join(' — '));
    const red = StampsSignaturesService.STAMP_RED;
    // Logo in center (if available)
    const logoUrl = data.logoUrl ? this.escapeXml(data.logoUrl) : null;

    // ⭐ Adaptive font size for acronym: if long, reduce to fit the arc
    const acronymLen = (data.schoolAcronym || data.schoolName || '').length;
    const arcFontSize = acronymLen > 20 ? 36 : acronymLen > 15 ? 44 : acronymLen > 10 ? 52 : 60;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 700" style="--ink-color:${red};">
  <defs>
    <path id="topArcPath" d="M 117.98 300.68 A 237.20 237.20 0 0 1 582.02 300.68" fill="none"/>
    <path id="bottomArcPath" d="M 86.63 387.01 A 265.95 265.95 0 0 0 613.37 387.01" fill="none"/>
    <filter id="inkStampEffect" x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.2" xChannelSelector="R" yChannelSelector="G" result="displaced"/>
      <feComponentTransfer in="displaced" result="grainy">
        <feFuncA type="discrete" tableValues="0 0.55 0.7 0.8 0.88 0.93 0.97 1 1 1"/>
      </feComponentTransfer>
      <feGaussianBlur in="grainy" stdDeviation="0.6" result="softened"/>
      <feColorMatrix in="softened" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.92 0"/>
    </filter>
  </defs>
  <g transform="rotate(-1.3 350 350)" filter="url(#inkStampEffect)">
    <circle cx="350" cy="350" r="320" fill="none" stroke="currentColor" stroke-width="12" color="${red}"/>
    <circle cx="350" cy="350" r="304" fill="none" stroke="currentColor" stroke-width="5" color="${red}"/>
    <circle cx="350" cy="350" r="213" fill="none" stroke="currentColor" stroke-width="5" color="${red}"/>
    <!-- Top arc: ACRONYM only (adaptive font size) -->
    <text font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="${arcFontSize}" letter-spacing="2" fill="${red}">
      <textPath href="#topArcPath" startOffset="50%" text-anchor="middle">${acronym}</textPath>
    </text>
    <!-- Bottom arc: address + phone (increased font size from 21 to 26) -->
    ${addressLine ? `<text font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="26" letter-spacing="1" fill="${red}">
      <textPath href="#bottomArcPath" startOffset="50%" text-anchor="middle">${addressLine}</textPath>
    </text>` : ''}
    <!-- Star decorations at 3 o'clock and 9 o'clock -->
    <path d="M 608.50 333.00 L 613.07 345.43 L 625.50 350.00 L 613.07 354.57 L 608.50 367.00 L 603.93 354.57 L 591.50 350.00 L 603.93 345.43 Z" fill="${red}"/>
    <path d="M 91.50 333.00 L 96.07 345.43 L 108.50 350.00 L 96.07 354.57 L 91.50 367.00 L 86.93 354.57 L 74.50 350.00 L 86.93 345.43 Z" fill="${red}"/>
    <!-- Center: LOGO ONLY (no school name, no "SCOLAIRE") -->
    ${logoUrl ? `<image href="${logoUrl}" x="290" y="310" width="120" height="120" preserveAspectRatio="xMidYMid meet" opacity="0.85"/>` : `<circle cx="350" cy="370" r="60" fill="none" stroke="${red}" stroke-width="3"/>`}
  </g>
</svg>`;
  }

  /**
   * ⭐ PROFESSIONAL CIRCULAR STAMP — Nominative variant (per staff member).
   *
   * Même rendu que buildCircularStampSvg (effet encre, rotation, 3 cercles
   * concentriques, étoiles), MAIS :
   *   - Au centre, on affiche le RÔLE du titulaire (PROMOTEUR, DIRECTEUR,
   *     COMPTABLE, SECRÉTAIRE-COMPTABLE) au lieu du logo de l'école.
   *   - L'acronyme de l'école reste dans l'arc supérieur (identité de
   *     l'établissement).
   *   - L'adresse + téléphone reste dans l'arc inférieur (contact).
   *
   * Utilisé par le bouton « Cachet » dans RH > Administration : pour chaque
   * staff, on génère un cachet circulaire nominatif (rôle au centre) + un
   * cachet rectangulaire nominatif (nom + rôle).
   *
   * @param data        Données d'identité de l'établissement (acronyme,
   *                    adresse, téléphone pour les arcs).
   * @param holderRole  Rôle du titulaire affiché au centre (ex: "PROMOTEUR").
   */
  private buildNominativeCircularStampSvg(data: IdentityProfileData, holderRole: string): string {
    const acronym = this.escapeXml(data.schoolAcronym || data.schoolName || 'Établissement');
    const phone = this.escapeXml([data.phonePrimary, data.phoneSecondary].filter(Boolean).join(' • ') || '');
    const addressParts = [phone, data.city, data.country].filter(Boolean);
    const addressLine = this.escapeXml(addressParts.join(' — '));
    const red = StampsSignaturesService.STAMP_RED;
    const roleText = this.escapeXml((holderRole || 'FONCTION').toUpperCase());

    // ⭐ Adaptive font size for acronym: if long, reduce to fit the arc
    const acronymLen = (data.schoolAcronym || data.schoolName || '').length;
    const arcFontSize = acronymLen > 20 ? 36 : acronymLen > 15 ? 44 : acronymLen > 10 ? 52 : 60;

    // ⭐ Taille de police adaptative pour le rôle au centre (selon longueur)
    //    "PROMOTEUR" = 9 chars → 56px
    //    "SECRÉTAIRE-COMPTABLE" = 20 chars → 32px
    const roleLen = roleText.length;
    const roleFontSize = roleLen > 18 ? 32 : roleLen > 12 ? 40 : roleLen > 8 ? 48 : 56;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 700" style="--ink-color:${red};">
  <defs>
    <path id="topArcPathNominative" d="M 117.98 300.68 A 237.20 237.20 0 0 1 582.02 300.68" fill="none"/>
    <path id="bottomArcPathNominative" d="M 86.63 387.01 A 265.95 265.95 0 0 0 613.37 387.01" fill="none"/>
    <filter id="inkStampEffectNominative" x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.2" xChannelSelector="R" yChannelSelector="G" result="displaced"/>
      <feComponentTransfer in="displaced" result="grainy">
        <feFuncA type="discrete" tableValues="0 0.55 0.7 0.8 0.88 0.93 0.97 1 1 1"/>
      </feComponentTransfer>
      <feGaussianBlur in="grainy" stdDeviation="0.6" result="softened"/>
      <feColorMatrix in="softened" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.92 0"/>
    </filter>
  </defs>
  <g transform="rotate(-1.3 350 350)" filter="url(#inkStampEffectNominative)">
    <circle cx="350" cy="350" r="320" fill="none" stroke="currentColor" stroke-width="12" color="${red}"/>
    <circle cx="350" cy="350" r="304" fill="none" stroke="currentColor" stroke-width="5" color="${red}"/>
    <circle cx="350" cy="350" r="213" fill="none" stroke="currentColor" stroke-width="5" color="${red}"/>
    <!-- Top arc: ACRONYM of the school (institutional identity) -->
    <text font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="${arcFontSize}" letter-spacing="2" fill="${red}">
      <textPath href="#topArcPathNominative" startOffset="50%" text-anchor="middle">${acronym}</textPath>
    </text>
    <!-- Bottom arc: address + phone (contact info) -->
    ${addressLine ? `<text font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="26" letter-spacing="1" fill="${red}">
      <textPath href="#bottomArcPathNominative" startOffset="50%" text-anchor="middle">${addressLine}</textPath>
    </text>` : ''}
    <!-- Star decorations at 3 o'clock and 9 o'clock -->
    <path d="M 608.50 333.00 L 613.07 345.43 L 625.50 350.00 L 613.07 354.57 L 608.50 367.00 L 603.93 354.57 L 591.50 350.00 L 603.93 345.43 Z" fill="${red}"/>
    <path d="M 91.50 333.00 L 96.07 345.43 L 108.50 350.00 L 96.07 354.57 L 91.50 367.00 L 86.93 354.57 L 74.50 350.00 L 86.93 345.43 Z" fill="${red}"/>
    <!-- ⭐ Center: ROLE of the holder (PROMOTEUR / DIRECTEUR / etc.) —
         replaces the logo of the institutional stamp. -->
    <text x="350" y="370" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="${roleFontSize}" text-anchor="middle" dominant-baseline="middle" fill="${red}" letter-spacing="2">${roleText}</text>
  </g>
</svg>`;
  }

  /**
   * ⭐ PROFESSIONAL RECTANGULAR (INSTITUTIONAL) STAMP — Ink-stamp rendering.
   *
   * ⭐ TRANSPARENT background (no white fill).
   * ⭐ Uses school ACRONYM (not full name).
   * ⭐ Only the acronym — no address, no phone, no email.
   */
  private buildRectangularStampSvg(data: IdentityProfileData): string {
    const acronym = this.escapeXml(data.schoolAcronym || data.schoolName || 'Établissement');
    const red = StampsSignaturesService.STAMP_RED;

    // ⭐ Adaptive font size for acronym
    const acronymLen = (data.schoolAcronym || data.schoolName || '').length;
    const fontSize = acronymLen > 20 ? 48 : acronymLen > 15 ? 56 : acronymLen > 10 ? 64 : 72;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 300" style="--ink-color:${red};">
  <defs>
    <filter id="inkStampEffect" x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="9" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.4" xChannelSelector="R" yChannelSelector="G" result="displaced"/>
      <feComponentTransfer in="displaced" result="grainy">
        <feFuncA type="discrete" tableValues="0 0.5 0.68 0.8 0.88 0.93 0.97 1 1 1"/>
      </feComponentTransfer>
      <feGaussianBlur in="grainy" stdDeviation="0.6" result="softened"/>
      <feColorMatrix in="softened" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.92 0"/>
    </filter>
  </defs>
  <g transform="rotate(-1 420 150)" filter="url(#inkStampEffect)">
    <rect x="16" y="16" width="808" height="268" rx="36" fill="none" stroke="${red}" stroke-width="12"/>
    <rect x="34" y="34" width="772" height="232" rx="26" fill="none" stroke="${red}" stroke-width="5"/>
    <text x="420" y="150" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle" fill="${red}" letter-spacing="2">${acronym}</text>
  </g>
</svg>`;
  }

  /**
   * ⭐ PROFESSIONAL NOMINATIVE STAMP — Per-holder rectangular stamp.
   *
   * Generates a stamp with the holder's NAME (large) + ROLE/TITLE (smaller)
   * for a specific person (Director, Comptable, Secrétaire, etc.).
   * Uses the same ink-stamp effect as the institutional stamps.
   *
   * @param holderName  e.g. "M. Jean Dupont"
   * @param holderRole  e.g. "DIRECTEUR" or "SECRÉTAIRE-COMPTABLE"
   */
  private buildNominativeStampSvg(holderName: string, holderRole: string): string {
    const name = this.escapeXml(holderName || 'Nom');
    const role = this.escapeXml(holderRole || 'FONCTION');
    const red = StampsSignaturesService.STAMP_RED;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 300" style="--ink-color:${red};">
  <defs>
    <filter id="inkStampEffect" x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="9" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.4" xChannelSelector="R" yChannelSelector="G" result="displaced"/>
      <feComponentTransfer in="displaced" result="grainy">
        <feFuncA type="discrete" tableValues="0 0.5 0.68 0.8 0.88 0.93 0.97 1 1 1"/>
      </feComponentTransfer>
      <feGaussianBlur in="grainy" stdDeviation="0.6" result="softened"/>
      <feColorMatrix in="softened" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.92 0"/>
    </filter>
  </defs>
  <g transform="rotate(-1 420 150)" filter="url(#inkStampEffect)">
    <rect x="16" y="16" width="808" height="268" rx="36" fill="none" stroke="${red}" stroke-width="12"/>
    <rect x="34" y="34" width="772" height="232" rx="26" fill="none" stroke="${red}" stroke-width="5"/>
    <text x="420" y="138" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="82" text-anchor="middle" dominant-baseline="middle" fill="${red}" letter-spacing="1">${name}</text>
    <text x="420" y="208" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="32" text-anchor="middle" dominant-baseline="middle" fill="${red}" letter-spacing="4">${role}</text>
  </g>
</svg>`;
  }

  private buildOvalStampSvg(data: IdentityProfileData): string {
    const name = this.escapeXml(data.schoolName);
    const city = this.escapeXml(data.city || '');
    const country = this.escapeXml(data.country || '');
    const line2 = 'ÉTABLISSEMENT SCOLAIRE';
    const w = 360;
    const h = 240;
    const cx = w / 2;
    const cy = h / 2;
    const rx = w / 2 - 24;
    const ry = h / 2 - 24;
    const fontFamily = 'Georgia, "Times New Roman", serif';

    const red = StampsSignaturesService.STAMP_RED;
    const redSec = StampsSignaturesService.STAMP_RED_SECONDARY;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
    svg += `<rect width="100%" height="100%" fill="none"/>`;
    svg += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${red}" stroke-width="3"/>`;
    svg += `<ellipse cx="${cx}" cy="${cy}" rx="${rx - 8}" ry="${ry - 8}" fill="none" stroke="${red}" stroke-width="1"/>`;
    svg += `<text x="${cx}" y="${cy - 24}" text-anchor="middle" font-family="${fontFamily}" font-size="14" font-weight="bold" fill="${red}">${name}</text>`;
    if (city || country) {
      svg += `<text x="${cx}" y="${cy}" text-anchor="middle" font-family="${fontFamily}" font-size="11" fill="${redSec}">${[city, country].filter(Boolean).join(' — ')}</text>`;
    }
    svg += `<text x="${cx}" y="${cy + 28}" text-anchor="middle" font-family="${fontFamily}" font-size="11" font-weight="bold" fill="${red}" letter-spacing="1">${this.escapeXml(line2)}</text>`;
    svg += '</svg>';
    return svg;
  }

  // ⭐ NOTE : la 2e version de buildRectangularStampSvg (legacy, avec schoolName
  //    + adresse + téléphone + email) a été SUPPRIMÉE. Elle écrasait la 1ère
  //    version (ligne ~559) qui utilise l'acronyme seul, ce qui faisait que le
  //    cachet rectangulaire affichait TOUJOURS le nom complet de l'école
  //    (ex: « e Privé Entrepreneuriat et Bilingue - EVEL d'A… ») au lieu de
  //    l'acronyme court. Avec cette suppression, c'est la version moderne
  //    (acronyme seul) qui est utilisée — conforme à la demande utilisateur.

  private buildSignatureSvg(firstName: string, lastName: string): string {
    const fullName = `${firstName} ${lastName}`.trim();
    const escaped = this.escapeXml(fullName);
    const w = 280;
    const h = 90;
    const fontFamily = '"Dancing Script", "Brush Script MT", "Segoe Script", cursive';
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
    svg += `<rect width="100%" height="100%" fill="none"/>`;
    svg += `<text x="${w / 2}" y="${h / 2 + 8}" text-anchor="middle" dominant-baseline="middle" font-family="${fontFamily}" font-size="28" font-weight="normal" fill="#1a1a1a">${escaped}</text>`;
    svg += '</svg>';
    return svg;
  }

  private arcText(
    cx: number,
    cy: number,
    r: number,
    text: string,
    fontFamily: string,
    fontSize: number,
    top: boolean,
    fill = StampsSignaturesService.STAMP_RED,
  ): string {
    const chars = text.split('');
    const angleStep = (Math.PI * 0.85) / Math.max(chars.length - 1, 1);
    const startAngle = top ? -Math.PI * 0.575 : Math.PI * 0.125;
    let out = '';
    chars.forEach((char, i) => {
      const angle = startAngle + i * angleStep;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      const rot = (angle * 180) / Math.PI + (top ? 0 : 180);
      out += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-family="${fontFamily}" font-size="${fontSize}" fill="${fill}" transform="rotate(${rot} ${x} ${y})">${this.escapeXml(char)}</text>`;
    });
    return out;
  }

  private escapeXml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private async svgToPng(
    svgContent: string,
    outputPath: string,
    width: number,
    height: number,
    transparent = false,
  ): Promise<void> {
    const bg = transparent ? 'transparent' : '#ffffff';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>html,body{margin:0;padding:0;width:100%;height:100%;background:${bg};}</style></head><body>${svgContent}</body></html>`;
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
      await page.setViewport({ width, height, deviceScaleFactor: 2 });
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.screenshot({
        path: outputPath,
        type: 'png',
        omitBackground: transparent,
      });
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }
}
