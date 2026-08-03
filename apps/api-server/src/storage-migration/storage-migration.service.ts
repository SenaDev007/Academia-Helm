/**
 * ============================================================================
 * StorageMigrationService — Auto-migration base64 → R2 au démarrage
 * ============================================================================
 *
 * Service NestJS qui s'exécute AUTOMATIQUEMENT au démarrage de l'application.
 * Il détecte tous les logos / images stockés en base64 dans Neon PostgreSQL
 * et les migre vers Cloudflare R2 (ou tout autre backend S3-compatible).
 *
 * Comportement :
 *   - Non-bloquant : s'exécute en arrière-plan après `app.listen()`
 *   - Idempotent : ignore les entrées déjà migrées (URLs https://)
 *   - Auto-désactivé : si STORAGE_TYPE != 'r2'/'s3', ne fait rien
 *   - Rate-limited : traite 1 logo à la fois pour éviter la pression DB/R2
 *   - Auto-réessayé : si une migration échoue, elle sera retry au prochain démarrage
 *
 * Tables scannées :
 *   1. tenant_identity_profiles.logoUrl  (logos des tenants)
 *   2. schools.logo                      (logos écoles — legacy)
 *
 * Tables futures (à ajouter si besoin) :
 *   - tenant_media.* (géré par TenantMediaService — pas besoin de migration)
 *   - staff_documents.fileUrl (déjà stocké via StorageService.uploadBuffer)
 * ============================================================================
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../common/services/storage.service';
import { createHash } from 'crypto';

@Injectable()
export class StorageMigrationService implements OnModuleInit {
  private readonly logger = new Logger(StorageMigrationService.name);

  /** Délai avant la 1ère migration (laisser l'app démarrer). */
  private readonly startupDelayMs = 30_000; // 30s

  /** Délai entre 2 logos (évite la pression R2). */
  private readonly interItemDelayMs = 500; // 0.5s

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Vérifier que le storage est bien R2/S3 — sinon, ne rien faire
    const storageType = this.configService.get<string>('STORAGE_TYPE') || 'local';
    if (storageType !== 'r2' && storageType !== 's3') {
      this.logger.log(
        `Auto-migration désactivée (STORAGE_TYPE=${storageType}). Active STORAGE_TYPE=r2 pour activer l'auto-migration.`,
      );
      return;
    }

    // Lancer la migration en arrière-plan (non-bloquant pour le bootstrap)
    setTimeout(() => {
      this.runAutoMigration().catch((err) => {
        this.logger.error(`Auto-migration crash: ${err.message}`);
      });
    }, this.startupDelayMs);
  }

  /**
   * Exécute l'auto-migration complète.
   * @public — peut aussi être appelée manuellement via un endpoint admin si besoin
   */
  async runAutoMigration(): Promise<void> {
    this.logger.log('🔄 Auto-migration base64 → R2 démarrée...');

    try {
      const r1 = await this.migrateTable({
        table: 'tenant_identity_profiles',
        column: '"logoUrl"',
        idCol: 'id',
        tenantCol: '"tenantId"',
        folder: 'logos/tenants',
        label: 'tenant_identity_profiles.logoUrl',
      });

      const r2 = await this.migrateTable({
        table: 'schools',
        column: 'logo',
        idCol: 'id',
        tenantCol: '"tenantId"',
        folder: 'logos/schools',
        label: 'schools.logo',
      });

      const totalOk = r1.ok + r2.ok;
      const totalSkip = r1.skip + r2.skip;
      const totalErr = r1.err + r2.err;

      if (totalOk === 0 && totalSkip === 0 && totalErr === 0) {
        this.logger.log('✅ Auto-migration: rien à migrer (toutes les images sont déjà sur R2).');
      } else {
        this.logger.log(
          `✅ Auto-migration terminée: ${totalOk} migrés, ${totalSkip} ignorés, ${totalErr} erreurs.`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Auto-migration failed: ${err.message}`);
      // Ne pas throw — on ne veut pas crasher l'app
    }
  }

  /**
   * Migre toutes les entrées base64 d'une table donnée vers R2.
   */
  private async migrateTable(opts: {
    table: string;
    column: string;
    idCol: string;
    tenantCol: string;
    folder: string;
    label: string;
  }): Promise<{ ok: number; skip: number; err: number }> {
    const { table, column, idCol, tenantCol, folder, label } = opts;

    let rows: any[];
    try {
      rows = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT ${idCol} AS id, ${tenantCol} AS "tenantId", ${column} AS data
        FROM ${table}
        WHERE ${column} IS NOT NULL
          AND ${column} LIKE 'data:image%'
      `);
    } catch (err: any) {
      this.logger.warn(`[${label}] SQL query failed: ${err.message} — table peut-être inexistante`);
      return { ok: 0, skip: 0, err: 0 };
    }

    if (rows.length === 0) {
      return { ok: 0, skip: 0, err: 0 };
    }

    this.logger.log(`[${label}] ${rows.length} entrée(s) à migrer`);

    let ok = 0;
    let skip = 0;
    let err = 0;

    for (const row of rows) {
      const result = await this.migrateOne({
        table,
        column,
        idCol,
        folder,
        row,
      });

      if (result === 'ok') ok++;
      else if (result === 'skip') skip++;
      else err++;

      // Petite pause entre chaque logo (évite le rate-limit R2)
      await new Promise((r) => setTimeout(r, this.interItemDelayMs));
    }

    this.logger.log(`[${label}] ${ok} ok, ${skip} skip, ${err} err`);
    return { ok, skip, err };
  }

  /**
   * Migre une seule entrée base64 vers R2.
   */
  private async migrateOne(opts: {
    table: string;
    column: string;
    idCol: string;
    folder: string;
    row: any;
  }): Promise<'ok' | 'skip' | 'err'> {
    const { table, column, idCol, folder, row } = opts;
    const data: string = row.data;

    // Parser le data URL
    const m = data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!m) {
      this.logger.warn(`  ⏭️  ${row.id}: format base64 invalide — skip`);
      return 'skip';
    }

    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const buffer = Buffer.from(m[2], 'base64');
    const hash = createHash('md5').update(buffer).digest('hex').slice(0, 8);
    const id = row.tenantId || row.id;
    const key = `${folder}/${id}/logo-${hash}.${ext}`;

    try {
      // Upload vers R2 (via StorageService — route automatiquement selon STORAGE_TYPE)
      const storedKey = await this.storage.uploadBuffer(
        buffer,
        key,
        `image/${m[1]}`,
      );

      // Construire l'URL publique
      const publicUrl = await this.storage.resolveFileUrl(storedKey);

      // Mettre à jour la DB
      await this.prisma.$executeRawUnsafe(
        `UPDATE ${table} SET ${column} = $1 WHERE ${idCol} = $2`,
        publicUrl,
        row.id,
      );

      this.logger.log(`  ✅ ${row.id} → ${publicUrl}`);
      return 'ok';
    } catch (e: any) {
      this.logger.error(`  ❌ ${row.id}: ${e.message}`);
      return 'err';
    }
  }
}
