/**
 * ============================================================================
 * LOGO PALETTE SERVICE — Palette du site institutionnel dérivée du logo
 * ============================================================================
 *
 * ⭐ 2026-11-23 — Demande promoteur : « une fois que le logo de l'école est
 *    paramétré, le système vérifie la palette de couleurs du logo afin
 *    d'adapter les couleurs du site institutionnel de l'école (le
 *    sous-domaine) en fonction du logo. »
 *
 * Principe (même chaîne de décision que le reste du site) :
 *   - Le logo est enregistré dans Paramètres → Identité (logoUrl du
 *     TenantIdentityProfile actif) ;
 *   - Ce service extrait les couleurs dominantes du logo (décodage via
 *     sharp, déjà une dépendance du projet — aucun ajout) ;
 *   - Il en dérive 4 rôles sémantiques (primary / secondary / accent /
 *     dark) et les écrit dans tenant_websites."logoPalette" au MÊME format
 *     JSON que customColors ([{name, value}] — ordre resolveTenantColors :
 *     [0]=primary, [1]=accent, [2]=secondary, [3]=dark) ;
 *   - Le site institutionnel du sous-domaine lit logoPalette en fallback
 *     de customColors : priorité thème officiel > customColors (choix
 *     manuel CMS) > logoPalette (auto logo) > palette Helm par défaut.
 *
 * Déclencheurs :
 *   - IdentityProfileService.createNewVersion (chaque enregistrement du
 *     formulaire Identité — le logo vient de changer) ;
 *   - IdentityProfileService.updateVisuals (upload direct du logo) ;
 *   - POST /settings/logo-palette/regenerate (régénération manuelle).
 *
 * Extraction (aucune dépendance ajoutée — sharp 0.33) :
 *   1. Chargement des octets du logo : data: URL (base64), http(s) (fetch),
 *      chemin fichier (fs) — même résolution que resolveInlineLogo du
 *      module finance ;
 *   2. sharp → resize 96px (inside, sans agrandissement) → RGBA brut ;
 *   3. Sondage des pixels (alpha ≥ 48) — le blanc de fond et le noir
 *      presque pur sont écartés (un logo sur fond blanc ne doit pas donner
 *      un site blanc) ;
 *   4. Quantification par seaux RGB (5 bits/canal) regroupés par distance ;
 *   5. Score = population × (0,45 + saturation) → primary = meilleur
 *      cluster ; accent = meilleur cluster de teinte nettement différente
 *      (sinon dérivation ambre/lumineuse) ; secondary/dark = dérivations du
 *      primary (assombrir la teinte : garantir un blanc lisible dessus).
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { prismaCreateDefaults } from '../../common/utils/prisma-helpers';

/** Format écrit dans tenant_websites.logoPalette (compatible resolveTenantColors). */
export interface LogoPaletteEntry {
  name: string;
  value: string;
}

export interface LogoPaletteResult {
  palette: LogoPaletteEntry[];
  colors: { primary: string; secondary: string; accent: string; dark: string };
  source: 'logo';
  generatedAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class LogoPaletteService {
  private readonly logger = new Logger(LogoPaletteService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Extrait la palette du logo fourni (URL/chaîne) — pure, sans écriture DB.
   * Retourne null si l'extraction échoue (logo absent, format non décodable…).
   */
  async extractLogoPalette(logoUrl: string | null | undefined): Promise<LogoPaletteResult | null> {
    if (!logoUrl || !String(logoUrl).trim()) return null;
    try {
      const bytes = await this.loadLogoBytes(String(logoUrl).trim());
      if (!bytes || bytes.length < 64) return null;

      // Décodage + normalisation en petites dimensions (≤96px) RGBA brut.
      const { default: sharp } = await import('sharp');
      const { data, info } = await sharp(bytes)
        .resize(96, 96, { fit: 'inside', withoutEnlargement: true })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const width = info.width;
      const height = info.height;
      const channels = info.channels; // 4 = RGBA

      // ── Sondage des pixels ──────────────────────────────────────────────
      // Sont écartés : transparents (alpha < 48), quasi-blancs (fond papier
      // des logos) et quasi-noirs purs (contours/texte — gardés seulement si
      // rien d'autre n'existe).
      const pixels: Array<[number, number, number]> = [];
      for (let i = 0; i < width * height; i++) {
        const o = i * channels;
        const r = data[o];
        const g = data[o + 1];
        const b = data[o + 2];
        const a = channels > 3 ? data[o + 3] : 255;
        if (a < 48) continue;
        if (r >= 238 && g >= 238 && b >= 238) continue; // blanc de fond
        pixels.push([r, g, b]);
      }
      if (pixels.length < 24) return null; // logo quasi vide / monochrome blanc

      // ── Quantification par seaux 5 bits/canal ───────────────────────────
      const buckets = new Map<number, { r: number; g: number; b: number; count: number }>();
      for (const [r, g, b] of pixels) {
        const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
        const bucket = buckets.get(key);
        if (bucket) {
          bucket.r += r; bucket.g += g; bucket.b += b; bucket.count++;
        } else {
          buckets.set(key, { r, g, b, count: 1 });
        }
      }
      // Moyennes par seau + classement par score population×saturation.
      const clusters = [...buckets.values()].map((c) => ({
        r: Math.round(c.r / c.count),
        g: Math.round(c.g / c.count),
        b: Math.round(c.b / c.count),
        count: c.count,
        sat: rgbSaturation(c.r / c.count, c.g / c.count, c.b / c.count),
        lum: rgbLuminance(c.r / c.count, c.g / c.count, c.b / c.count),
      }));
      const score = (c: any) => c.count * (0.45 + c.sat);
      clusters.sort((a, b) => score(b) - score(a));
      if (clusters.length === 0) return null;

      // ── Choix des rôles sémantiques ─────────────────────────────────────
      // primary : meilleur cluster, assombri si trop clair (contraste texte
      // blanc sur fond header/hero/footer). cible : luminance ≤ 0,62.
      let primary = hexOf(clusters[0].r, clusters[0].g, clusters[0].b);
      primary = darkenUntil(primary, 0.62);

      // accent : meilleur cluster de teinte éloignée (ΔH > 60°) et saturé ;
      // sinon dérivation ambre chaude (l'équivalent du GOLD Helm).
      const primaryHue = rgbHue(clusters[0].r, clusters[0].g, clusters[0].b);
      let accent: string | null = null;
      for (const c of clusters.slice(1, 10)) {
        if (c.count < 6) break;
        const hue = rgbHue(c.r, c.g, c.b);
        const dh = angularDistance(hue, primaryHue);
        if (dh > 60 && c.sat > 0.25) {
          accent = hexOf(c.r, c.g, c.b);
          break;
        }
      }
      if (!accent) {
        accent = shiftHue(primary, 38, 0.82); // teinte chaude lumineuse du primary
      }

      // secondary : variante légèrement éclaircie du primary (gradient du hero)
      // dark : variante nettement assombrie du primary (fond footer, textes)
      const secondary = adjustHex(primary, 22);
      const dark = adjustHex(primary, -34);

      const colors = { primary, secondary, accent, dark };
      // Ordre = ordre de résolution de resolveTenantColors :
      // [0]=primary, [1]=accent, [2]=secondary, [3]=dark
      const palette: LogoPaletteEntry[] = [
        { name: 'Primaire (logo)', value: primary },
        { name: 'Accent (logo)', value: accent },
        { name: 'Secondaire (logo)', value: secondary },
        { name: 'Sombre (logo)', value: dark },
      ];
      return { palette, colors, source: 'logo', generatedAt: new Date().toISOString() };
    } catch (e: any) {
      this.logger.warn(`extractLogoPalette échoué : ${e?.message || e}`);
      return null;
    }
  }

  /**
   * Extrait la palette du logo ACTIF du tenant et l'écrit dans
   * tenant_websites.logoPalette (crée la ligne website si absente).
   * Logo absent/null → logoPalette remise à null (le site retombe sur la
   * palette Helm par défaut).
   * Retourne le résultat (ou null) — ne JAMAIS faire échouer l'enregistrement
   * de l'identité pour un souci de palette.
   */
  async extractAndApplyLogoPalette(tenantId: string): Promise<LogoPaletteResult | null> {
    try {
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        select: { logoUrl: true },
        orderBy: { version: 'desc' },
      });
      const logoUrl = profile?.logoUrl || null;
      if (!logoUrl) {
        await this.storePalette(tenantId, null);
        return null;
      }
      const result = await this.extractLogoPalette(logoUrl);
      if (!result) {
        // Extraction impossible (format exotique, image cassée…) → ne pas
        // écraser une éventuelle palette existante, juste ne rien écrire.
        return null;
      }
      await this.storePalette(tenantId, result.palette);
      this.logger.log(`Palette logo appliquée au site institutionnel (tenant ${tenantId}) : ${JSON.stringify(result.colors)}`);
      return result;
    } catch (e: any) {
      this.logger.warn(`extractAndApplyLogoPalette échoué (tenant ${tenantId}) : ${e?.message || e}`);
      return null;
    }
  }

  /** Lit la palette stockée (pour affichage dans Paramètres). */
  async getLogoPalette(tenantId: string): Promise<{ palette: LogoPaletteEntry[] | null; colors: { primary: string; secondary: string; accent: string; dark: string } | null }> {
    const website = await this.prisma.tenantWebsite.findUnique({
      where: { tenantId },
      select: { logoPalette: true },
    });
    const palette = (website?.logoPalette as LogoPaletteEntry[] | null) || null;
    let colors: any = null;
    if (palette && Array.isArray(palette)) {
      const vals = palette.map((p) => p?.value).filter((v) => typeof v === 'string');
      if (vals.length >= 1) {
        colors = {
          primary: vals[0],
          accent: vals[1] ?? undefined,
          secondary: vals[2] ?? undefined,
          dark: vals[3] ?? undefined,
        };
      }
    }
    return { palette, colors };
  }

  /** Écrit (ou efface) la palette — upsert de la ligne tenant_websites. */
  private async storePalette(tenantId: string, palette: LogoPaletteEntry[] | null): Promise<void> {
    try {
      const existing = await this.prisma.tenantWebsite.findUnique({
        where: { tenantId },
        select: { id: true },
      });
      if (existing) {
        await this.prisma.tenantWebsite.update({
          where: { tenantId },
          data: { logoPalette: (palette as any), updatedAt: new Date() },
        });
      } else {
        await this.prisma.tenantWebsite.create({
          data: {
            ...prismaCreateDefaults(),
            tenantId,
            logoPalette: (palette as any),
          } as any,
        });
      }
    } catch (e: any) {
      this.logger.warn(`storePalette échoué (tenant ${tenantId}) : ${e?.message || e}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Chargement des octets du logo (data: / http(s) / chemin fichier)
  // ═══════════════════════════════════════════════════════════════════
  private async loadLogoBytes(raw: string): Promise<Buffer | null> {
    if (raw.startsWith('data:')) {
      const commaIdx = raw.indexOf(',');
      if (commaIdx === -1) return null;
      const header = raw.substring(5, commaIdx).toLowerCase();
      const b64 = raw.substring(commaIdx + 1);
      if (header.includes('base64')) return Buffer.from(b64, 'base64');
      return Buffer.from(decodeURIComponent(b64), 'binary');
    }
    if (/^https?:\/\//.test(raw)) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      try {
        const r = await fetch(raw, { signal: ctrl.signal });
        if (!r.ok) return null;
        return Buffer.from(await r.arrayBuffer());
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    }
    try {
      const fsAsync = await import('fs/promises');
      // Chemin relatif → résolu depuis la racine du process (dist/src) — best effort.
      return await fsAsync.readFile(raw);
    } catch {
      return null;
    }
  }
}

// ─── Petites fonctions couleur (aucune dépendance) ──────────────────────

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function hexOf(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => clamp255(x).toString(16).padStart(2, '0')).join('');
}

function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [
    parseInt(h.substring(0, 2), 16) || 0,
    parseInt(h.substring(2, 4), 16) || 0,
    parseInt(h.substring(4, 6), 16) || 0,
  ];
}

/** Assombrit la couleur jusqu'à ce que la luminance relative ≤ max (contraste texte blanc). */
function darkenUntil(hex: string, maxLum: number): string {
  let [r, g, b] = parseHex(hex);
  let guard = 0;
  while (rgbLuminance(r, g, b) > maxLum && guard < 24) {
    r *= 0.92; g *= 0.92; b *= 0.92;
    guard++;
  }
  return hexOf(r, g, b);
}

/** Éclaircit (amount > 0) / assombrit (amount < 0) — même style que adjustColor frontend. */
function adjustHex(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  return hexOf(r + amount, g + amount, b + amount);
}

/** Luminance relative perçue (0=noir, 1=blanc). */
function rgbLuminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Saturation HSL (0..1). */
function rgbSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const l = (max + min) / 2 / 255;
  const d = (max - min) / 255;
  return l > 0.5 ? d / (2 - max / 255 - min / 255) : d / (max / 255 + min / 255);
}

/** Teinte HSL en degrés (0..360). */
function rgbHue(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h;
}

function angularDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Décale la teinte d'une couleur hex de `degrees` avec luminance cible (0..1). */
function shiftHue(hex: string, degrees: number, targetLum: number): string {
  const [r, g, b] = parseHex(hex);
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  let h = rgbHue(r, g, b) + degrees;
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * targetLum - 1)) * Math.max(s, 0.45);
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = targetLum - c / 2;
  let rp = 0; let gp = 0; let bp = 0;
  if (h < 60) { rp = c; gp = x; }
  else if (h < 120) { rp = x; gp = c; }
  else if (h < 180) { gp = c; bp = x; }
  else if (h < 240) { gp = x; bp = c; }
  else if (h < 300) { rp = x; bp = c; }
  else { rp = c; bp = x; }
  return hexOf((rp + m) * 255, (gp + m) * 255, (bp + m) * 255);
}

// Référence (inutilisée mais documentée) : durée de rétention du cache palette.
export const LOGO_PALETTE_TTL_MS = 7 * DAY_MS;
