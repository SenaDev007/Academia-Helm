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
      await this.svgToPng(circularSvg, circularPath, 700, 700);
      circularStampUrl = `${STAMPS_DIR}/${tenantId}/${levelFolder}/circular.png`;
    }
    if (formats.includes('rectangular')) {
      const rectangularSvg = this.buildRectangularStampSvg(data);
      const rectangularPath = path.join(stampsDir, 'rectangular.png');
      await this.svgToPng(rectangularSvg, rectangularPath, 840, 300);
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
    await this.svgToPng(svg, stampPath, 840, 300);

    const stampUrl = `${STAMPS_DIR}/${tenantId}/${levelFolder}/nominative/${roleSlug}.png`;
    this.logger.log(`Cachet nominatif généré: tenant=${tenantId} role=${roleSlug} name="${holderName}"`);
    return { stampUrl, generatedAt: new Date().toISOString() };
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
    type: 'circular' | 'rectangular' | 'oval' | 'signature',
    educationLevelIdOrSignatureId?: string | null,
  ): string | null {
    const cwd = process.cwd();
    if (type === 'signature') {
      if (!educationLevelIdOrSignatureId) return null;
      return path.join(cwd, SIGNATURES_DIR, tenantId, `${educationLevelIdOrSignatureId}.png`);
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
   * ink effect, slight rotation for hand-stamped feel, 3 concentric circles,
   * top-arc company name + bottom-arc address via <textPath>, star
   * decorations at 3 o'clock and 9 o'clock, center logo + subtitle + title.
   *
   * The output is a transparent PNG (via Puppeteer screenshot) that looks
   * like a real red ink stamp — grainy, slightly displaced, semi-transparent.
   */
  private buildCircularStampSvg(data: IdentityProfileData): string {
    const companyName = this.escapeXml(data.schoolAcronym || data.schoolName || 'Établissement');
    const addressLine = this.escapeXml([data.city, data.country].filter(Boolean).join(' — '));
    const subtitle = this.escapeXml(data.schoolAcronym ? data.schoolName : 'ÉTABLISSEMENT');
    const title = this.escapeXml('SCOLAIRE');
    const red = StampsSignaturesService.STAMP_RED;

    // 700×700 viewBox — same as the reference file.
    // Arc paths computed for r=237.20 (top) and r=265.95 (bottom) centered on (350,350).
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
    <text font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="60" letter-spacing="2" fill="${red}">
      <textPath href="#topArcPath" startOffset="50%" text-anchor="middle">${companyName}</textPath>
    </text>
    <text font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="21" letter-spacing="1" fill="${red}">
      <textPath href="#bottomArcPath" startOffset="50%" text-anchor="middle">${addressLine}</textPath>
    </text>
    <path d="M 608.50 333.00 L 613.07 345.43 L 625.50 350.00 L 613.07 354.57 L 608.50 367.00 L 603.93 354.57 L 591.50 350.00 L 603.93 345.43 Z" fill="${red}"/>
    <path d="M 91.50 333.00 L 96.07 345.43 L 108.50 350.00 L 96.07 354.57 L 91.50 367.00 L 86.93 354.57 L 74.50 350.00 L 86.93 345.43 Z" fill="${red}"/>
    <text x="350" y="364" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="26" text-anchor="middle" dominant-baseline="middle" fill="${red}" letter-spacing="1">${subtitle}</text>
    <text x="350" y="412" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="38" text-anchor="middle" dominant-baseline="middle" fill="${red}" letter-spacing="2">${title}</text>
  </g>
</svg>`;
  }

  /**
   * ⭐ PROFESSIONAL RECTANGULAR (NOMINATIVE) STAMP — Ink-stamp rendering.
   *
   * Reproduces the visual approach from cachet_nominatif_directeur.html:
   * SVG with ink effect, slight rotation, double rounded border, large
   * holder name + smaller role/title. Used for per-role nominative stamps
   * (Director, Comptable, Secrétaire, etc.).
   *
   * @param holderName  The person's name (e.g. "M. Jean Dupont")
   * @param holderRole  The person's role label (e.g. "DIRECTEUR")
   */
  private buildRectangularStampSvg(data: IdentityProfileData): string {
    // Institutional rectangular stamp: school name + address + phone + email.
    const name = this.escapeXml(data.schoolName || 'Établissement');
    const address = this.escapeXml(data.address || '');
    const city = this.escapeXml(data.city || '');
    const country = this.escapeXml(data.country || '');
    const postalCode = this.escapeXml(data.postalCode || '');
    const loc = [address, [postalCode, city].filter(Boolean).join(' '), country].filter(Boolean).join(' — ');
    const phone = [data.phonePrimary, data.phoneSecondary].filter(Boolean).join(' • ');
    const email = this.escapeXml(data.email || '');
    const web = this.escapeXml(data.website || '');
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
    <text x="420" y="110" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="56" text-anchor="middle" dominant-baseline="middle" fill="${red}" letter-spacing="1">${name}</text>
    ${loc ? `<text x="420" y="165" font-family="Georgia, 'Times New Roman', serif" font-size="22" text-anchor="middle" dominant-baseline="middle" fill="${red}" letter-spacing="2">${loc}</text>` : ''}
    ${(phone || email) ? `<text x="420" y="210" font-family="Georgia, 'Times New Roman', serif" font-size="20" text-anchor="middle" dominant-baseline="middle" fill="${red}" letter-spacing="2">${this.escapeXml(phone)}${phone && email ? ' • ' : ''}${email}</text>` : ''}
    ${web ? `<text x="420" y="250" font-family="Georgia, 'Times New Roman', serif" font-size="18" text-anchor="middle" dominant-baseline="middle" fill="${red}" letter-spacing="2">${web}</text>` : ''}
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

  private buildRectangularStampSvg(data: IdentityProfileData): string {
    const name = this.escapeXml(data.schoolName);
    const address = this.escapeXml(data.address || '');
    const city = this.escapeXml(data.city || '');
    const country = this.escapeXml(data.country || '');
    const postalCode = this.escapeXml(data.postalCode || '');
    const loc = [address, [postalCode, city].filter(Boolean).join(' '), country].filter(Boolean).join(' — ');
    const phone = [data.phonePrimary, data.phoneSecondary].filter(Boolean).join(' • ');
    const email = this.escapeXml(data.email || '');
    const web = this.escapeXml(data.website || '');

    const w = 320;
    const h = 140;
    const fontFamily = 'Georgia, "Times New Roman", serif';

    const red = StampsSignaturesService.STAMP_RED;
    const redSec = StampsSignaturesService.STAMP_RED_SECONDARY;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
    svg += `<rect width="${w}" height="${h}" fill="none" stroke="${red}" stroke-width="2" rx="4"/>`;
    svg += `<rect x="4" y="4" width="${w - 8}" height="${h - 8}" fill="none" stroke="${red}" stroke-width="1" rx="2"/>`;
    svg += `<text x="${w / 2}" y="28" text-anchor="middle" font-family="${fontFamily}" font-size="16" font-weight="bold" fill="${red}">${name}</text>`;
    if (loc) {
      svg += `<text x="${w / 2}" y="52" text-anchor="middle" font-family="${fontFamily}" font-size="10" fill="${redSec}">${loc}</text>`;
    }
    if (phone || email) {
      svg += `<text x="${w / 2}" y="74" text-anchor="middle" font-family="${fontFamily}" font-size="10" fill="${redSec}">${this.escapeXml(phone)}${phone && email ? ' • ' : ''}${email}</text>`;
    }
    if (web) {
      svg += `<text x="${w / 2}" y="96" text-anchor="middle" font-family="${fontFamily}" font-size="9" fill="${redSec}">${web}</text>`;
    }
    svg += '</svg>';
    return svg;
  }

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
