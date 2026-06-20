/**
 * ============================================================================
 * EMAIL TRACKING SERVICE — Tracking pixel + liens trackés
 * ============================================================================
 *
 * Complète les webhooks Resend (qui peuvent être bloqués par certains clients
 * mail) avec deux méthodes additionnelles :
 *
 *   1. Tracking pixel (ouverture)
 *      - Une image invisible 1×1 est ajoutée à la fin du HTML de chaque email
 *        envoyé via sendCategorized()
 *      - URL : /api/communication/track/open/{logId}.png
 *      - Quand le client mail charge l'image → GET /track/open/{logId}.png
 *        → on incrémente openCount et set openedAt
 *      - Sécurité : logId est un UUID difficile à deviner (96 bits d'entropie)
 *
 *   2. Liens trackés (clics)
 *      - Tous les liens <a href="..."> dans le HTML sont réécrits vers
 *        /api/communication/track/click?logId=...&url=...
 *      - Au clic → GET /track/click → on incrémente clickCount et set clickedAt
 *        puis redirection HTTP 302 vers l'URL finale
 *      - Sécurité : on ne réécrit QUE les liens http(s):// (pas mailto:, tel:,
 *        javascript:, anchors #)
 *
 * Notes :
 *   - Les liens déjà internes (academiahelm.com) ne sont PAS trackés pour
 *     éviter le spam de tracking quand l'utilisateur navigue dans l'app
 *   - Le tracking pixel utilise un GIF transparent (43 bytes) plutôt que
 *     une image serveur — c'est plus rapide et fiable
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

// GIF transparent 1×1 (43 bytes) — Base64
// Source : https://en.wikipedia.org/wiki/GIF#Transparent_pixels
const TRACKING_PIXEL_BASE64 =
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const TRACKING_PIXEL_BUFFER = Buffer.from(TRACKING_PIXEL_BASE64, 'base64');

@Injectable()
export class EmailTrackingService {
  private readonly logger = new Logger(EmailTrackingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Renvoie le buffer du pixel tracking (GIF transparent 1×1).
   * Utilisé par le controller GET /track/open/:logId.png
   */
  getTrackingPixelBuffer(): Buffer {
    return TRACKING_PIXEL_BUFFER;
  }

  /**
   * Post-traite le HTML d'un email pour y ajouter :
   *   1. Le tracking pixel (image invisible en fin de body)
   *   2. La réécriture des liens trackés
   *
   * À appeler APRÈS renderEmail() et AVANT l'envoi via sendEmail().
   *
   * @param html   HTML de l'email
   * @param logId  ID de l'EmailLog (pour le tracking)
   * @returns HTML modifié avec pixel + liens trackés
   */
  injectTracking(html: string, logId: string): string {
    if (!html || !logId) return html;

    let result = html;

    try {
      // 1. Réécrire les liens trackés
      result = this.rewriteLinksForTracking(result, logId);

      // 2. Ajouter le pixel tracking avant </body> (ou à la fin si pas de body)
      const pixelUrl = `https://api.academiahelm.com/api/communication/track/open/${logId}.gif`;
      const pixelHtml = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />`;

      if (result.includes('</body>')) {
        result = result.replace('</body>', `${pixelHtml}</body>`);
      } else if (result.includes('</table>')) {
        // Les emails Academia Helm sont dans des tables — on ajoute après la dernière
        result = result.replace(/(<\/table>\s*)(<\/td>\s*<\/tr>\s*<\/table>\s*<\/td>\s*<\/tr>\s*<\/table>\s*$)/, `$1${pixelHtml}$2`);
      } else {
        // Fallback : ajouter à la fin
        result = result + pixelHtml;
      }
    } catch (err: any) {
      this.logger.error(`Failed to inject tracking for log ${logId}: ${err.message}`);
      // On retourne le HTML non modifié — l'email doit quand même partir
    }

    return result;
  }

  /**
   * Réécrit les liens <a href="..."> dans le HTML pour les tracker.
   *
   * Règles :
   *   - On ne tracker QUE les http(s)://
   *   - On NE tracker PAS les liens internes (academiahelm.com) pour éviter
   *     le bruit quand l'utilisateur clique vers l'app
   *   - On préserve les attributs existants (target, rel, class, style)
   */
  private rewriteLinksForTracking(html: string, logId: string): string {
    // Regex : capture le href="..." et le reste du tag <a ...>
    // On évite les commentaires HTML et les CDATA
    const linkRegex = /<a\s+([^>]*?)href="(https?:\/\/[^"]+)"([^>]*)>/gi;

    return html.replace(linkRegex, (match, before: string, url: string, after: string) => {
      // Ignorer les liens internes (academiahelm.com)
      if (this.isInternalUrl(url)) {
        return match;
      }

      // Encoder l'URL finale en query param
      const encodedUrl = encodeURIComponent(url);
      const trackedUrl = `https://api.academiahelm.com/api/communication/track/click?logId=${logId}&url=${encodedUrl}`;

      return `<a ${before}href="${trackedUrl}"${after}>`;
    });
  }

  /**
   * Détermine si une URL est "interne" (academiahelm.com ou ses sous-domaines).
   * On ne tracker pas ces liens pour éviter le bruit.
   */
  private isInternalUrl(url: string): boolean {
    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();
      return (
        host === 'academiahelm.com' ||
        host.endsWith('.academiahelm.com') ||
        host === 'localhost' ||
        host === '127.0.0.1'
      );
    } catch {
      return false;
    }
  }

  /**
   * Enregistre une ouverture d'email (appelé par GET /track/open/:logId.gif).
   *
   * Logique :
   *   - Si pas encore ouvert → set openedAt + status=OPENED (sauf si déjà CLICKED)
   *   - Incrémente openCount
   *   - Idempotent : si l'email n'existe pas, on ne fait rien (mais on renvoie
   *     quand même le pixel pour ne pas casser l'email)
   */
  async recordOpen(logId: string): Promise<void> {
    try {
      const log = await this.prisma.emailLog.findUnique({
        where: { id: logId },
        select: { id: true, status: true, openCount: true, openedAt: true },
      });

      if (!log) {
        // EmailLog non trouvé — silencieux (le pixel est quand même renvoyé)
        return;
      }

      const updateData: any = {
        openCount: (log.openCount || 0) + 1,
      };

      // Première ouverture
      if (!log.openedAt) {
        updateData.openedAt = new Date();
        // On garde CLICKED supérieur à OPENED dans la hiérarchie
        if (log.status !== 'CLICKED' && log.status !== 'BOUNCED' && log.status !== 'FAILED') {
          updateData.status = 'OPENED';
        }
      }

      await this.prisma.emailLog.update({
        where: { id: logId },
        data: updateData,
      });

      this.logger.log(`📧 Email ${logId} opened (openCount=${updateData.openCount})`);
    } catch (err: any) {
      this.logger.error(`Failed to record open for ${logId}: ${err.message}`);
    }
  }

  /**
   * Enregistre un clic sur un lien tracké (appelé par GET /track/click).
   *
   * @returns l'URL finale vers laquelle rediriger (302)
   */
  async recordClick(logId: string, originalUrl: string): Promise<string | null> {
    try {
      const log = await this.prisma.emailLog.findUnique({
        where: { id: logId },
        select: { id: true, status: true, clickCount: true, clickedAt: true },
      });

      if (!log) {
        return null;
      }

      const updateData: any = {
        clickCount: (log.clickCount || 0) + 1,
      };

      // Premier clic
      if (!log.clickedAt) {
        updateData.clickedAt = new Date();
        // CLICKED est le statut le plus élevé dans la hiérarchie d'engagement
        if (log.status !== 'BOUNCED' && log.status !== 'FAILED') {
          updateData.status = 'CLICKED';
        }
      }

      await this.prisma.emailLog.update({
        where: { id: logId },
        data: updateData,
      });

      this.logger.log(
        `📧 Email ${logId} link clicked (clickCount=${updateData.clickCount}) → ${originalUrl.substring(0, 80)}`,
      );

      return originalUrl;
    } catch (err: any) {
      this.logger.error(`Failed to record click for ${logId}: ${err.message}`);
      return originalUrl; // On redirige quand même vers l'URL finale
    }
  }

  /**
   * Extrait le logId d'une URL de tracking (validation).
   * Format attendu : UUID v4
   */
  isValidLogId(logId: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(logId);
  }
}
