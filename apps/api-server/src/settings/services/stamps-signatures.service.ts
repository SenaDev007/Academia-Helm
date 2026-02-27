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
import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as puppeteer from 'puppeteer';
import { PrismaService } from '../../database/prisma.service';
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
      await this.svgToPng(circularSvg, circularPath, 400, 400);
      circularStampUrl = `${STAMPS_DIR}/${tenantId}/${levelFolder}/circular.png`;
    }
    if (formats.includes('rectangular')) {
      const rectangularSvg = this.buildRectangularStampSvg(data);
      const rectangularPath = path.join(stampsDir, 'rectangular.png');
      await this.svgToPng(rectangularSvg, rectangularPath, 320, 140);
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
          tenantId,
          educationLevelId,
          circularStampUrl,
          rectangularStampUrl,
          ovalStampUrl,
          generatedAt: now,
        },
        update: {
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
            ...(circularStampUrl !== null && { circularStampUrl }),
            ...(rectangularStampUrl !== null && { rectangularStampUrl }),
            ...(ovalStampUrl !== null && { ovalStampUrl }),
            generatedAt: now,
          },
        });
      } else {
        await this.prisma.tenantStamp.create({
          data: {
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

  private buildCircularStampSvg(data: IdentityProfileData): string {
    const name = this.escapeXml(data.schoolName);
    const city = this.escapeXml(data.city || '');
    const country = this.escapeXml(data.country || '');
    const line1 = [city, country].filter(Boolean).join(' — ');
    const line2 = 'ÉTABLISSEMENT SCOLAIRE';

    const size = 400;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 20;
    const fontFamily = 'Georgia, "Times New Roman", serif';

    const red = StampsSignaturesService.STAMP_RED;
    const redSec = StampsSignaturesService.STAMP_RED_SECONDARY;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
    svg += `<rect width="100%" height="100%" fill="none"/>`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${red}" stroke-width="3"/>`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${r - 8}" fill="none" stroke="${red}" stroke-width="1"/>`;
    svg += this.arcText(cx, cy, r - 18, name, fontFamily, 14, true, red);
    if (line1) {
      svg += this.arcText(cx, cy, r - 18, line1, fontFamily, 11, false, redSec);
    }
    svg += `<text x="${cx}" y="${cy + 6}" text-anchor="middle" dominant-baseline="middle" font-family="${fontFamily}" font-size="12" font-weight="bold" fill="${red}" letter-spacing="1">${this.escapeXml(line2)}</text>`;
    svg += '</svg>';
    return svg;
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

  /** Chemins Windows courants pour Chrome/Edge si PUPPETEER_EXECUTABLE_PATH non défini ou invalide */
  private static readonly FALLBACK_CHROME_PATHS = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];

  private async svgToPng(
    svgContent: string,
    outputPath: string,
    width: number,
    height: number,
    transparent = false,
  ): Promise<void> {
    const bg = transparent ? 'transparent' : '#ffffff';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>html,body{margin:0;padding:0;width:100%;height:100%;background:${bg};}</style></head><body>${svgContent}</body></html>`;
    const executablePath =
      process.env.PUPPETEER_EXECUTABLE_PATH?.trim() ||
      StampsSignaturesService.FALLBACK_CHROME_PATHS.find((p) => existsSync(p));
    const userDataDir = path.join(os.tmpdir(), 'academia-puppeteer-stamps');
    const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
      headless: true,
      timeout: 60000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-sync',
        '--metrics-recording-only',
        '--mute-audio',
        `--user-data-dir=${userDataDir}`,
      ],
    };
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }
    const browser = await puppeteer.launch(launchOptions);
    try {
      const page = await browser.newPage();
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
      await page.setViewport({ width, height, deviceScaleFactor: 2 });
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.screenshot({
        path: outputPath,
        type: 'png',
        omitBackground: transparent,
      });
    } finally {
      await browser.close();
    }
  }
}
