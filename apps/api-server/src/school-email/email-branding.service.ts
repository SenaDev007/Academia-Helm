/**
 * ============================================================================
 * 📧 BRANDING DES E-MAILS ÉCOLE — logo en-tête/pied + coordonnées
 * ============================================================================
 *
 * Retour promoteur 2026-11-26 :
 *   - le logo de l'école doit s'afficher dans l'EN-TÊTE et le PIED de chaque
 *     e-mail envoyé par l'école (tous modules confondus) ;
 *   - les coordonnées de l'école (adresse, téléphone, e-mail, site) remplacent
 *     la mention « merci de ne pas répondre » dans le pied de page ;
 *   - les destinataires peuvent répondre directement : le Reply-To pointe sur
 *     la boîte de l'école (voir resolveReplyToHeader dans smtp-helpers).
 *
 * Résolution du logo — même cascade que le landing page (reviews.service) :
 *   TenantIdentityProfile active → SchoolSettings.logoUrl → School.logo
 *
 * Embarquement du logo : pièce jointe INLINE avec Content-ID (CID) — la
 * méthode la plus compatible (Gmail webmail, Outlook, Thunderbird, Apple
 * Mail). Le logo est décodé de son data-URI ou téléchargé une fois puis mis
 * en cache mémoire (TTL 10 min) : coût nul pour les envois en série.
 * Si l'embarquement échoue → repli sur l'URL publique dans <img src>.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { SCHOOL_LOGO_CID, SchoolEmailBranding } from './smtp-helpers';

/** Pièce jointe inline du logo (compatible Nodemailer ET MailComposer/Gmail). */
export interface InlineLogoAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  cid: string;
  contentDisposition: 'inline';
}

/** Résultat complet de la résolution du branding pour un tenant. */
export interface ResolvedSchoolBranding {
  branding: SchoolEmailBranding;
  /** Pièce jointe inline à ajouter à l'envoi (absente si logo indisponible). */
  logoAttachment?: InlineLogoAttachment;
}

interface BrandingCacheEntry {
  expiresAt: number;
  value: ResolvedSchoolBranding;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const LOGO_FETCH_TIMEOUT_MS = 5000;
const MAX_LOGO_BYTES = 1_500_000; // 1,5 Mo — au-delà : repli URL (poids mail).

@Injectable()
export class EmailBrandingService {
  private readonly logger = new Logger(EmailBrandingService.name);
  private readonly cache = new Map<string, BrandingCacheEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Résout le branding d'un tenant (nom, logo, coordonnées) avec cache 10 min.
   * @param fallbackName nom affiché de l'onglet E-mail (fromName) — prioritaire
   *                     car c'est celui que la direction a explicitement choisi.
   * @param levelCategory ⭐ 2026-11-26 (double identité) — SECONDARY : le
   *                     branding (logo, nom, coordonnées) de l'identité du
   *                     NIVEAU (onglet Identité) prime sur l'identité globale.
   */
  async resolve(
    tenantId: string,
    fallbackName?: string | null,
    levelCategory: 'MATERNAL_PRIMARY' | 'SECONDARY' = 'MATERNAL_PRIMARY',
  ): Promise<ResolvedSchoolBranding> {
    const cacheKey = `${tenantId}:${levelCategory}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const value = await this.queryAndBuild(tenantId, fallbackName, levelCategory);
    this.cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value });
    return value;
  }

  /** Invalide le cache (après mise à jour du logo ou de la fiche école). */
  invalidate(tenantId: string): void {
    this.cache.delete(tenantId);
  }

  // ─── Résolution ───────────────────────────────────────────────────────────

  private async queryAndBuild(
    tenantId: string,
    fallbackName?: string | null,
    levelCategory: 'MATERNAL_PRIMARY' | 'SECONDARY' = 'MATERNAL_PRIMARY',
  ): Promise<ResolvedSchoolBranding> {
    try {
      // ⭐ 2026-11-26 — identité du NIVEAU secondaire (onglet Identité) :
      // logo, contacts et adresse propres au secondaire pour les envois de
      // ce niveau (repli champ à champ sur l'identité globale).
      const secondaryIdentity =
        levelCategory === 'SECONDARY'
          ? await this.prisma.tenantLevelIdentityProfile.findFirst({
              where: {
                tenantId,
                educationLevel: { name: { in: ['SECONDAIRE', 'SECONDARY'] } },
              },
              select: {
                schoolName: true, logoUrl: true, phonePrimary: true, phoneSecondary: true,
                email: true, website: true, address: true, city: true,
              },
            }).catch(() => null)
          : null;
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          schoolSettings: {
            select: {
              schoolName: true,
              logoUrl: true,
              address: true,
              city: true,
              phone: true,
              email: true,
              website: true,
            },
          },
          schools: {
            select: {
              name: true,
              logo: true,
              address: true,
              city: true,
              primaryPhone: true,
              primaryEmail: true,
              website: true,
            },
          },
          identityProfiles: {
            where: { isActive: true },
            select: { logoUrl: true },
            orderBy: { version: 'desc' },
            take: 1,
          },
        },
      });

      const settings = tenant?.schoolSettings ?? null;
      const school = tenant?.schools ?? null;

      // Cascade identique au landing page : profil d'identité actif →
      // SchoolSettings → School. ⭐ Secondaire : l'identité du niveau PRIME.
      const logoRaw =
        secondaryIdentity?.logoUrl ||
        tenant?.identityProfiles?.[0]?.logoUrl || settings?.logoUrl || school?.logo || null;

      const schoolName =
        (fallbackName || '').trim() ||
        secondaryIdentity?.schoolName?.trim() ||
        settings?.schoolName || school?.name || 'École';

      const contactLines = [
        [secondaryIdentity?.address || settings?.address || school?.address,
         secondaryIdentity?.city || settings?.city || school?.city]
          .filter(Boolean)
          .join(', '),
        secondaryIdentity?.phonePrimary || secondaryIdentity?.phoneSecondary ||
          settings?.phone || school?.primaryPhone || '',
        secondaryIdentity?.email || settings?.email || school?.primaryEmail || '',
        secondaryIdentity?.website || settings?.website || school?.website || '',
      ].filter((l): l is string => !!l && l.trim().length > 0);

      const branding: SchoolEmailBranding = { schoolName, contactLines };

      // Embarquement du logo (CID) — repli URL publique.
      const embedded = await this.embedLogo(logoRaw);
      if (embedded) {
        branding.logoCid = SCHOOL_LOGO_CID;
      } else if (logoRaw) {
        branding.logoUrl = this.toPublicLogoUrl(logoRaw);
      }

      return {
        branding,
        logoAttachment: embedded
          ? {
              filename: embedded.filename,
              content: embedded.content,
              contentType: embedded.contentType,
              cid: SCHOOL_LOGO_CID,
              contentDisposition: 'inline',
            }
          : undefined,
      };
    } catch (err: any) {
      // Le branding ne doit JAMAIS faire échouer un envoi.
      this.logger.warn(`Branding (tenant ${tenantId}) indisponible : ${err?.message}`);
      return {
        branding: {
          schoolName: (fallbackName || '').trim() || 'École',
          contactLines: [],
        },
      };
    }
  }

  /** Décode/télécharge le logo en Buffer pour l'embarquement CID. */
  private async embedLogo(
    logoRaw: string | null,
  ): Promise<{ filename: string; content: Buffer; contentType: string } | null> {
    if (!logoRaw) return null;
    try {
      const dataUri = logoRaw.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
      if (dataUri) {
        const content = Buffer.from(dataUri[2], 'base64');
        if (content.length === 0 || content.length > MAX_LOGO_BYTES) return null;
        const ext = (dataUri[1].split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '') || 'png';
        return { filename: `logo-ecole.${ext}`, content, contentType: dataUri[1].toLowerCase() };
      }

      const url = this.toPublicLogoUrl(logoRaw);
      if (!url) return null;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LOGO_FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return null;
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        if (!contentType.startsWith('image/')) return null;
        const content = Buffer.from(await res.arrayBuffer());
        if (content.length === 0 || content.length > MAX_LOGO_BYTES) return null;
        const ext = (contentType.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '') || 'png';
        return { filename: `logo-ecole.${ext}`, content, contentType };
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return null; // timeout / réseau → repli URL publique au prochain envoi
    }
  }

  /** Chemin relatif → URL publique absolue (APP_PUBLIC_URL). */
  private toPublicLogoUrl(logoRaw: string): string | null {
    if (!logoRaw) return null;
    if (/^https?:\/\//i.test(logoRaw)) return logoRaw;
    if (/^data:/i.test(logoRaw)) return null; // non embarquable → pas d'URL
    if (logoRaw.startsWith('/')) {
      const base = (
        this.config.get<string>('APP_PUBLIC_URL') ||
        this.config.get<string>('FRONTEND_URL') ||
        'https://api.academiahelm.com'
      ).replace(/\/+$/, '');
      return `${base}${logoRaw}`;
    }
    return null;
  }
}
