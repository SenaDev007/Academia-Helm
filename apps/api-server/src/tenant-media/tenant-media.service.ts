import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../common/services/storage.service';
import { ImageOptimizationService } from '../media/image-optimization.service';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';

/**
 * ============================================================================
 * TenantMediaService — Bibliothèque médias tenant-scoped
 * ============================================================================
 *
 * Stocke les images et fichiers uploadés par les directeurs d'école dans le
 * cloud (R2/S3/Vercel Blob/local) via StorageService, avec :
 *   - 3 variantes d'image (original, hd, thumbnail) générées via Sharp
 *   - Métadonnées en base (table `tenant_media`)
 *   - Isolation par tenantId
 *   - Compteur d'usage (usagesCount) pour détecter les médias orphelins
 *
 * Patterns réutilisés :
 *   - StorageService.uploadBuffer() du module common
 *   - ImageOptimizationService (Sharp) du module media
 *   - ensureTableExists() du module HR (création idempotente de table)
 *
 * Conventions de nommage des clés storage :
 *   tenant-media/{tenantId}/{folder}/{variant}-{uuid}-{fileName}
 *   variant = original | hd | thumbnail
 * ============================================================================
 */

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 Mo
const ALLOWED_MIME_PREFIXES = ['image/', 'application/pdf', 'video/'];

const HD_MAX_EDGE = 1600;
const HD_QUALITY = 82;
const THUMBNAIL_MAX_EDGE = 400;
const THUMBNAIL_QUALITY = 72;

export interface UploadMediaInput {
  fileDataUrl: string;       // data:image/...;base64,... OU data:application/pdf;base64,...
  fileName: string;
  mimeType: string;
  folder?: string;           // ex: 'hero', 'gallery', 'logo', 'og', 'general'
  alt?: string;              // texte alternatif (accessibilité)
  tags?: string[];           // étiquettes libres
}

export interface MediaAsset {
  id: string;
  tenantId: string;
  name: string;
  alt: string | null;
  type: 'image' | 'video' | 'document';
  originalUrl: string;
  hdUrl: string | null;
  thumbnailUrl: string | null;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  folder: string;
  tags: string[];
  uploadedById: string | null;
  usagesCount: number;
  createdAt: string;
  updatedAt: string;
}

function rowToAsset(r: any): MediaAsset {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    alt: r.alt,
    type: r.type,
    originalUrl: r.original_url,
    hdUrl: r.hd_url,
    thumbnailUrl: r.thumbnail_url,
    mimeType: r.mime_type,
    size: Number(r.size) || 0,
    width: r.width ? Number(r.width) : null,
    height: r.height ? Number(r.height) : null,
    folder: r.folder || 'general',
    tags: r.tags ? (typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags) : [],
    uploadedById: r.uploaded_by_id,
    usagesCount: Number(r.usages_count) || 0,
    createdAt: r.created_at?.toISOString?.() || r.created_at,
    updatedAt: r.updated_at?.toISOString?.() || r.updated_at,
  };
}

function getMediaType(mimeType: string): 'image' | 'video' | 'document' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'document';
}

@Injectable()
export class TenantMediaService {
  private readonly logger = new Logger(TenantMediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly imageOptimization: ImageOptimizationService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  //  UPLOAD — Crée un média (avec 3 variantes pour les images)
  // ═══════════════════════════════════════════════════════════════════════

  async upload(tenantId: string, userId: string | undefined, input: UploadMediaInput): Promise<MediaAsset> {
    await this.ensureTableExists();

    // 1. Validation
    if (!input.fileDataUrl?.startsWith('data:')) {
      throw new BadRequestException('Le fichier doit être fourni en format data URL.');
    }
    if (!ALLOWED_MIME_PREFIXES.some((p) => input.mimeType.startsWith(p))) {
      throw new BadRequestException(`Type de fichier non supporté : ${input.mimeType}. Formats acceptés : images, PDF, vidéos.`);
    }
    if (!input.fileName?.trim()) {
      throw new BadRequestException('Le nom du fichier est requis.');
    }

    // 2. Décoder le data URL
    const m = /^data:([^;]+);base64,(.+)$/i.exec(input.fileDataUrl);
    if (!m) {
      throw new BadRequestException('Format data URL invalide.');
    }
    const buffer = Buffer.from(m[2], 'base64');
    if (buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException(`Fichier trop volumineux (max ${Math.round(MAX_FILE_SIZE / (1024 * 1024))} Mo).`);
    }

    const mediaType = getMediaType(input.mimeType);
    const folder = (input.folder || 'general').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || 'general';
    const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
    const uuid = uuidv4();
    const baseKey = `tenant-media/${tenantId}/${folder}`;

    let originalUrl = '';
    let hdUrl: string | null = null;
    let thumbnailUrl: string | null = null;
    let width: number | null = null;
    let height: number | null = null;
    let storedMimeType = input.mimeType;
    let storedSize = buffer.length;

    try {
      if (mediaType === 'image') {
        // === Image : générer 3 variantes ===

        // Variante "original" : format original (préservé)
        const originalKey = `${baseKey}/original-${uuid}-${safeFileName}`;
        originalUrl = await this.storage.uploadBuffer(buffer, originalKey, input.mimeType);

        // Variante "hd" : max 1600px, WebP qualité 82 (réutilise ImageOptimizationService)
        try {
          const hdOptimized = await this.imageOptimization.optimizeDataUrl(input.fileDataUrl);
          const hdBuffer = Buffer.from(hdOptimized.dataUrl.split(',')[1], 'base64');
          const hdKey = `${baseKey}/hd-${uuid}-${safeFileName}.webp`;
          hdUrl = await this.storage.uploadBuffer(hdBuffer, hdKey, 'image/webp');
        } catch (err: any) {
          this.logger.warn(`HD variant failed: ${err.message}`);
        }

        // Variante "thumbnail" : max 400px, WebP qualité 72
        try {
          const thumbBuffer = await sharp(buffer, { failOn: 'truncated' })
            .rotate()
            .resize(THUMBNAIL_MAX_EDGE, THUMBNAIL_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: THUMBNAIL_QUALITY, effort: 4 })
            .toBuffer();
          const thumbKey = `${baseKey}/thumbnail-${uuid}-${safeFileName}.webp`;
          thumbnailUrl = await this.storage.uploadBuffer(thumbBuffer, thumbKey, 'image/webp');

          // Récupérer les dimensions originales
          const metadata = await sharp(buffer).metadata();
          width = metadata.width || null;
          height = metadata.height || null;
        } catch (err: any) {
          this.logger.warn(`Thumbnail variant failed: ${err.message}`);
        }

        // Si l'HD a été généré, c'est le format "principal" pour l'affichage web
        storedMimeType = 'image/webp';
        storedSize = buffer.length; // on garde la taille originale en DB
      } else {
        // === PDF / Vidéo : une seule variante ===
        const key = `${baseKey}/original-${uuid}-${safeFileName}`;
        originalUrl = await this.storage.uploadBuffer(buffer, key, input.mimeType);
      }

      // 3. Persister en base
      const id = uuidv4();
      const tags = JSON.stringify(input.tags || []);

      await this.prisma.$executeRawUnsafe(`
        INSERT INTO "tenant_media"
          ("id", "tenant_id", "name", "alt", "type", "original_url", "hd_url", "thumbnail_url",
           "mime_type", "size", "width", "height", "folder", "tags", "uploaded_by_id",
           "usages_count", "created_at", "updated_at")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 0, NOW(), NOW())
      `,
        id, tenantId, input.fileName.trim(), input.alt || null, mediaType,
        originalUrl, hdUrl, thumbnailUrl,
        storedMimeType, storedSize, width, height,
        folder, tags, userId || null,
      );

      this.logger.log(`Tenant media uploaded: ${id} (tenant ${tenantId}, type ${mediaType}, folder ${folder})`);

      // 4. Retourner l'asset avec URLs résolues
      const asset = await this.getById(tenantId, id);
      return asset;
    } catch (err: any) {
      // Nettoyer les fichiers partiellement uploadés en cas d'échec
      this.logger.error(`Upload failed, cleaning up: ${err.message}`);
      const urlsToClean = [originalUrl, hdUrl, thumbnailUrl].filter(Boolean);
      for (const url of urlsToClean) {
        try { await this.storage.deleteFile(url); } catch {}
      }
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  LIST — Liste paginée des médias du tenant
  // ═══════════════════════════════════════════════════════════════════════

  async list(
    tenantId: string,
    opts: { folder?: string; type?: string; search?: string; limit?: number; offset?: number },
  ): Promise<{ items: MediaAsset[]; total: number }> {
    await this.ensureTableExists();

    const limit = Math.min(opts.limit || 50, 200);
    const offset = Math.max(opts.offset || 0, 0);

    const conditions: string[] = [`"tenant_id" = $1`];
    const params: any[] = [tenantId];
    let paramIdx = 2;

    if (opts.folder && opts.folder !== 'ALL') {
      conditions.push(`"folder" = $${paramIdx++}`);
      params.push(opts.folder);
    }
    if (opts.type && opts.type !== 'ALL') {
      conditions.push(`"type" = $${paramIdx++}`);
      params.push(opts.type);
    }
    if (opts.search?.trim()) {
      conditions.push(`("name" ILIKE $${paramIdx} OR "alt" ILIKE $${paramIdx})`);
      params.push(`%${opts.search.trim()}%`);
      paramIdx++;
    }

    const where = conditions.join(' AND ');

    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "tenant_media" WHERE ${where}
      ORDER BY "created_at" DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `, ...params, limit, offset);

    const totalRows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*)::int AS count FROM "tenant_media" WHERE ${where}
    `, ...params);

    const items = await Promise.all(rows.map(rowToAsset).map(async (a: MediaAsset) => {
      a.originalUrl = await this.resolveUrl(a.originalUrl);
      a.hdUrl = a.hdUrl ? await this.resolveUrl(a.hdUrl) : null;
      a.thumbnailUrl = a.thumbnailUrl ? await this.resolveUrl(a.thumbnailUrl) : null;
      return a;
    }));

    return { items, total: totalRows[0]?.count || 0 };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  GET BY ID
  // ═══════════════════════════════════════════════════════════════════════

  async getById(tenantId: string, mediaId: string): Promise<MediaAsset> {
    await this.ensureTableExists();

    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "tenant_media" WHERE "id" = $1 AND "tenant_id" = $2
    `, mediaId, tenantId);

    if (!rows[0]) throw new NotFoundException('Média introuvable');

    const asset = rowToAsset(rows[0]);
    asset.originalUrl = await this.resolveUrl(asset.originalUrl);
    asset.hdUrl = asset.hdUrl ? await this.resolveUrl(asset.hdUrl) : null;
    asset.thumbnailUrl = asset.thumbnailUrl ? await this.resolveUrl(asset.thumbnailUrl) : null;
    return asset;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  UPDATE — Modifier alt, tags, folder
  // ═══════════════════════════════════════════════════════════════════════

  async update(
    tenantId: string,
    mediaId: string,
    patch: { name?: string; alt?: string | null; tags?: string[]; folder?: string },
  ): Promise<MediaAsset> {
    await this.ensureTableExists();

    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (patch.name !== undefined) {
      sets.push(`"name" = $${idx++}`);
      params.push(patch.name.trim());
    }
    if (patch.alt !== undefined) {
      sets.push(`"alt" = $${idx++}`);
      params.push(patch.alt || null);
    }
    if (patch.tags !== undefined) {
      sets.push(`"tags" = $${idx++}`);
      params.push(JSON.stringify(patch.tags));
    }
    if (patch.folder !== undefined) {
      const folder = patch.folder.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || 'general';
      sets.push(`"folder" = $${idx++}`);
      params.push(folder);
    }

    if (sets.length === 0) return this.getById(tenantId, mediaId);

    sets.push(`"updated_at" = NOW()`);
    params.push(mediaId, tenantId);

    await this.prisma.$executeRawUnsafe(`
      UPDATE "tenant_media" SET ${sets.join(', ')} WHERE "id" = $${idx++} AND "tenant_id" = $${idx++}
    `, ...params);

    return this.getById(tenantId, mediaId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  DELETE — Supprimer un média (DB + storage)
  // ═══════════════════════════════════════════════════════════════════════

  async delete(tenantId: string, mediaId: string): Promise<void> {
    await this.ensureTableExists();

    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "tenant_media" WHERE "id" = $1 AND "tenant_id" = $2
    `, mediaId, tenantId);

    if (!rows[0]) throw new NotFoundException('Média introuvable');

    const r = rows[0];
    const urls = [r.original_url, r.hd_url, r.thumbnail_url].filter(Boolean);

    // Supprimer de la DB d'abord (évite les références orphelines)
    await this.prisma.$executeRawUnsafe(`DELETE FROM "tenant_media" WHERE "id" = $1 AND "tenant_id" = $2`, mediaId, tenantId);

    // Puis supprimer du storage (best-effort)
    for (const url of urls) {
      try { await this.storage.deleteFile(url); } catch (err: any) {
        this.logger.warn(`Failed to delete file ${url}: ${err.message}`);
      }
    }

    this.logger.log(`Tenant media deleted: ${mediaId}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  USAGE TRACKING — Incrémenter/décrémenter le compteur d'usage
  // ═══════════════════════════════════════════════════════════════════════

  async incrementUsage(tenantId: string, mediaId: string): Promise<void> {
    await this.ensureTableExists();
    await this.prisma.$executeRawUnsafe(`
      UPDATE "tenant_media" SET "usages_count" = "usages_count" + 1, "updated_at" = NOW()
      WHERE "id" = $1 AND "tenant_id" = $2
    `, mediaId, tenantId);
  }

  async decrementUsage(tenantId: string, mediaId: string): Promise<void> {
    await this.ensureTableExists();
    await this.prisma.$executeRawUnsafe(`
      UPDATE "tenant_media"
      SET "usages_count" = GREATEST("usages_count" - 1, 0), "updated_at" = NOW()
      WHERE "id" = $1 AND "tenant_id" = $2
    `, mediaId, tenantId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  FOLDERS LIST — Récupérer la liste des dossiers utilisés
  // ═══════════════════════════════════════════════════════════════════════

  async listFolders(tenantId: string): Promise<{ folder: string; count: number }[]> {
    await this.ensureTableExists();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "folder", COUNT(*)::int AS count
      FROM "tenant_media"
      WHERE "tenant_id" = $1
      GROUP BY "folder"
      ORDER BY "folder" ASC
    `, tenantId);
    return rows.map((r) => ({ folder: r.folder, count: Number(r.count) }));
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  CLEANUP ORPHANS — Supprimer les fichiers storage non référencés en DB
  // ═══════════════════════════════════════════════════════════════════════

  async cleanupOrphans(tenantId: string): Promise<{ deletedKeys: string[] }> {
    const prefix = `tenant-media/${tenantId}/`;
    let keys: string[] = [];
    try {
      keys = await this.storage.listByPrefix(prefix);
    } catch (err: any) {
      this.logger.warn(`Cannot list storage keys (likely not R2/S3): ${err.message}`);
      return { deletedKeys: [] };
    }

    if (keys.length === 0) return { deletedKeys: [] };

    // Récupérer tous les URLs stockés en DB pour ce tenant
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "original_url", "hd_url", "thumbnail_url" FROM "tenant_media" WHERE "tenant_id" = $1
    `, tenantId);

    const dbUrls = new Set<string>();
    for (const r of rows) {
      for (const f of [r.original_url, r.hd_url, r.thumbnail_url]) {
        if (f && typeof f === 'string') dbUrls.add(f);
      }
    }

    // Pour R2/S3, les URLs DB sont des clés (pas des URLs complètes)
    const deletedKeys: string[] = [];
    for (const key of keys) {
      if (!dbUrls.has(key)) {
        try {
          await this.storage.deleteFile(key);
          deletedKeys.push(key);
        } catch (err: any) {
          this.logger.warn(`Failed to delete orphan ${key}: ${err.message}`);
        }
      }
    }

    this.logger.log(`Cleaned up ${deletedKeys.length} orphaned media files for tenant ${tenantId}`);
    return { deletedKeys };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  HELPERS PRIVÉS
  // ═══════════════════════════════════════════════════════════════════════

  private async resolveUrl(filePath: string): Promise<string> {
    if (!filePath) return '';
    // Data URL : retourner tel quel
    if (filePath.startsWith('data:')) return filePath;
    // URL HTTP : retourner tel quel (Vercel Blob ou URL publique)
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
    // Chemin storage (clé R2/S3 ou chemin local) : résoudre
    return await this.storage.resolveFileUrl(filePath);
  }

  private async ensureTableExists(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "tenant_media" (
          "id" TEXT PRIMARY KEY,
          "tenant_id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "alt" TEXT,
          "type" TEXT NOT NULL,
          "original_url" TEXT NOT NULL,
          "hd_url" TEXT,
          "thumbnail_url" TEXT,
          "mime_type" TEXT NOT NULL,
          "size" BIGINT NOT NULL DEFAULT 0,
          "width" INTEGER,
          "height" INTEGER,
          "folder" TEXT NOT NULL DEFAULT 'general',
          "tags" TEXT NOT NULL DEFAULT '[]',
          "uploaded_by_id" TEXT,
          "usages_count" INTEGER NOT NULL DEFAULT 0,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "tenant_media_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "idx_tenant_media_tenant_created" ON "tenant_media" ("tenant_id", "created_at" DESC);
        CREATE INDEX IF NOT EXISTS "idx_tenant_media_tenant_folder" ON "tenant_media" ("tenant_id", "folder");
        CREATE INDEX IF NOT EXISTS "idx_tenant_media_tenant_type" ON "tenant_media" ("tenant_id", "type");
      `);
    } catch (e: any) {
      this.logger.warn(`ensureTableExists tenant_media: ${e.message}`);
    }
  }
}
