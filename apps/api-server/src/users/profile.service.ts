/**
 * ============================================================================
 * PROFILE SERVICE — Profil self-service « Mon profil » (tous les UI)
 * ============================================================================
 *
 * Photo de profil + informations de profil de l'utilisateur CONNECTÉ.
 * Contrairement aux contrôleurs métier (RH, élèves), ces endpoints portent
 * uniquement sur l'utilisateur courant (identité tirée du JWT) — jamais d'ID
 * passé par le client → impossible de modifier la photo d'un autre compte.
 *
 * Stockage : colonne `users.avatarUrl` (créée par Helm Connect v2 —
 * migration 20260824020000_add_channels_e2e_avatar), déclarée dans le schéma
 * Prisma. La photo est stockée en data URL optimisée (sharp 512×512 webp),
 * pattern standard Helm (photos élèves/personnel).
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import sharp from 'sharp';
import { DataUrlHelper } from '../common/pipes/data-url-validation.pipe';

/** Taille finale de l'avatar (carré, fit cover) — suffisant pour topbars/sidebar. */
const AVATAR_SIZE = 512;
/** Qualité WebP — 85 = bon compromis qualité/taille (~30-120 Ko). */
const AVATAR_QUALITY = 85;
/** Taille max après traitement — garde-fou si l'image ne compresse pas (PNG photo). */
const MAX_STORED_BYTES = 2 * 1024 * 1024;

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Profil complet de l'utilisateur connecté — champs SÉCURISÉS uniquement
   * (jamais passwordHash / secrets 2FA, contrairement à l'ancien /users/me).
   *
   * ⭐ hrPhotoUrl : fallback lecture seule vers la photo du dossier du
   *    personnel (staff_photos — module « RH et personnel »). Si certaines
   *    personnes ont déjà une photo définie dans le module RH, elle doit
   *    s'afficher dans « Mon profil » (et partout où l'avatar apparaît),
   *    même sans photo perso users.avatarUrl ; l'utilisateur peut ensuite
   *    la remplacer par sa propre photo (upload → users.avatarUrl prioritaire).
   *    Liaison Staff ↔ User : même email dans le même tenant (pattern
   *    staff-credential.service.ts). AUCUNE écriture côté RH.
   */
  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        status: true,
        avatarUrl: true,
        twoFactorEnabled: true,
        lastLogin: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    // ── Fallback photo RH (lecture seule, best-effort) ──
    let hrPhotoUrl: string | null = null;
    if (!user.avatarUrl && user.tenantId && user.email) {
      try {
        const staff = await this.prisma.staff.findFirst({
          where: {
            tenantId: user.tenantId,
            email: { equals: user.email, mode: 'insensitive' },
          },
          select: { photo: { select: { thumbnailUrl: true } } },
        });
        const thumb = staff?.photo?.thumbnailUrl ?? null;
        // Data URLs (pattern upload RH) et URLs http(s) directement
        // exploitables dans <img src> — tout autre format ignoré (clé de
        // stockage non résolue ici, pas de coupling StorageService).
        if (thumb && (/^data:image\//i.test(thumb) || /^https?:\/\//i.test(thumb))) {
          hrPhotoUrl = thumb;
        }
      } catch (e: any) {
        this.logger.warn(`Fallback photo RH indisponible pour ${user.email}: ${e?.message || e}`);
      }
    }

    return { ...user, hrPhotoUrl };
  }

  /**
   * Upload de la photo de profil de l'utilisateur connecté.
   *
   * Pipeline sharp : rotation EXIF → recadrage carré intelligent
   * (position 'attention' = focus sur la zone saillante, idéale pour un
   * visage) → webp 512×512. Résultat stocké en data URL dans users.avatarUrl.
   */
  async uploadAvatar(userId: string, photoDataUrl: string): Promise<{ avatarUrl: string }> {
    const parsed = DataUrlHelper.decode(photoDataUrl);
    if (!parsed) {
      throw new BadRequestException('Format attendu : data URL base64 (data:image/...;base64,...).');
    }

    // Vérifier que l'utilisateur existe avant le traitement (image coûteux)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    let outBuffer: Buffer;
    try {
      outBuffer = await sharp(parsed.buffer, { failOn: 'truncated' })
        .rotate() // respecte l'orientation EXIF
        .resize(AVATAR_SIZE, AVATAR_SIZE, {
          fit: 'cover',
          position: sharp.strategy.attention, // recadrage centré sur le sujet
          withoutEnlargement: false,
        })
        .webp({ quality: AVATAR_QUALITY, effort: 4 })
        .toBuffer();
    } catch (error: any) {
      this.logger.warn(`Échec du traitement sharp de l'avatar (${user.email}): ${error?.message}`);
      throw new BadRequestException("Impossible de traiter cette image. Essayez un autre format (JPEG, PNG, WebP).");
    }

    if (outBuffer.length > MAX_STORED_BYTES) {
      throw new BadRequestException('Image trop volumineuse après compression. Choisissez une image plus simple.');
    }

    const avatarUrl = `data:image/webp;base64,${outBuffer.toString('base64')}`;

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    this.logger.log(`Avatar mis à jour pour ${user.email} (${(outBuffer.length / 1024).toFixed(0)} Ko webp ${AVATAR_SIZE}px)`);
    return { avatarUrl };
  }

  /**
   * Suppression de la photo de profil de l'utilisateur connecté.
   */
  async deleteAvatar(userId: string): Promise<{ success: boolean; avatarUrl: null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });

    this.logger.log(`Avatar supprimé pour ${user.email}`);
    return { success: true, avatarUrl: null };
  }
}
