import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateReleaseDto } from './dto/create-release.dto';

/**
 * ============================================================================
// SYNC SERVICE — Releases (raw SQL, bypass Prisma client cache issues)
 * ============================================================================
 * Utilise $queryRawUnsafe au lieu de prisma.appRelease pour éviter
 * les problèmes de cache Docker avec prisma generate.
 * ============================================================================
 */

@Injectable()
export class ReleasesService {
  private readonly logger = new Logger(ReleasesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(params?: {
    platform?: string;
    channel?: string;
    latestOnly?: boolean;
  }) {
    let query = `SELECT * FROM app_releases WHERE 1=1`;
    const values: any[] = [];
    let valIdx = 1;

    if (params?.platform) {
      query += ` AND platform = $${valIdx++}`;
      values.push(params.platform);
    }

    if (params?.channel) {
      query += ` AND release_channel = $${valIdx++}`;
      values.push(params.channel);
    } else {
      query += ` AND release_channel = 'stable'`;
    }

    if (params?.latestOnly) {
      query += ` AND is_latest = true`;
    }

    query += ` ORDER BY platform ASC, uploaded_at DESC`;

    const result = await this.prisma.$queryRawUnsafe(query, ...values);
    return (result as any[]).map(r => this.normalizeRow(r));
  }

  async findLatest() {
    const platforms = ['android', 'windows', 'ios', 'macos', 'linux'];
    const results: any[] = [];

    for (const platform of platforms) {
      const rows = await this.prisma.$queryRawUnsafe(
        `SELECT * FROM app_releases WHERE platform = $1 AND is_latest = true AND release_channel = 'stable' ORDER BY uploaded_at DESC LIMIT 1`,
        platform,
      );
      if ((rows as any[]).length > 0) {
        results.push(this.normalizeRow((rows as any[])[0]));
      }
    }

    return results;
  }

  async findOne(id: string) {
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM app_releases WHERE id = $1`,
      id,
    );
    if ((rows as any[]).length === 0) {
      throw new NotFoundException(`Release ${id} not found`);
    }
    return this.normalizeRow((rows as any[])[0]);
  }

  async create(dto: CreateReleaseDto) {
    this.logger.log(`Creating release: ${dto.platform} v${dto.version}`);

    const id = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO app_releases (id, version, platform, arch, filename, file_size, download_url, checksum_sha256, release_channel, is_latest, release_notes, min_os_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      id,
      dto.version,
      dto.platform,
      dto.arch || 'universal',
      dto.filename,
      BigInt(dto.fileSize),
      dto.downloadUrl,
      dto.checksumSha256 || null,
      dto.releaseChannel || 'stable',
      dto.isLatest,
      dto.releaseNotes || null,
      dto.minOsVersion || null,
    );

    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id); // Check exists
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM app_releases WHERE id = $1`,
      id,
    );
    this.logger.log(`Release deleted: ${id}`);
    return { deleted: true, id };
  }

  async markAsLatest(id: string) {
    const release = await this.findOne(id);
    await this.prisma.$executeRawUnsafe(
      `UPDATE app_releases SET is_latest = true WHERE id = $1`,
      id,
    );
    this.logger.log(`Release ${id} marked as latest`);
    return this.findOne(id);
  }

  /// Convertit une ligne PostgreSQL (snake_case) vers camelCase pour l'API
  private normalizeRow(row: any): any {
    return {
      id: row.id,
      version: row.version,
      platform: row.platform,
      arch: row.arch,
      filename: row.filename,
      fileSize: Number(row.file_size),
      downloadUrl: row.download_url,
      checksumSha256: row.checksum_sha256,
      releaseChannel: row.release_channel,
      isLatest: row.is_latest,
      releaseNotes: row.release_notes,
      minOsVersion: row.min_os_version,
      uploadedAt: row.uploaded_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
