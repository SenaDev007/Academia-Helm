import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateReleaseDto } from './dto/create-release.dto';

@Injectable()
export class ReleasesService {
  private readonly logger = new Logger(ReleasesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère toutes les releases, filtrées par plateforme si spécifié.
   * Par défaut, ne retourne que les releases "stable".
   */
  async findAll(params?: {
    platform?: string;
    channel?: string;
    latestOnly?: boolean;
  }) {
    const where: any = {};

    if (params?.platform) {
      where.platform = params.platform;
    }

    if (params?.channel) {
      where.releaseChannel = params.channel;
    } else {
      // Par défaut, ne montrer que les releases stable
      where.releaseChannel = 'stable';
    }

    if (params?.latestOnly) {
      where.isLatest = true;
    }

    return this.prisma.appRelease.findMany({
      where,
      orderBy: [
        { platform: 'asc' },
        { uploadedAt: 'desc' },
      ],
    });
  }

  /**
   * Récupère la dernière version pour chaque plateforme.
   * Utilisé par la page /downloads pour afficher les boutons de téléchargement.
   */
  async findLatest() {
    const platforms = ['android', 'windows', 'ios', 'macos', 'linux'];
    const results: any[] = [];

    for (const platform of platforms) {
      const latest = await this.prisma.appRelease.findFirst({
        where: {
          platform,
          isLatest: true,
          releaseChannel: 'stable',
        },
        orderBy: { uploadedAt: 'desc' },
      });

      if (latest) {
        results.push(latest);
      }
    }

    return results;
  }

  /**
   * Récupère une release par son ID.
   */
  async findOne(id: string) {
    const release = await this.prisma.appRelease.findUnique({
      where: { id },
    });

    if (!release) {
      throw new NotFoundException(`Release ${id} not found`);
    }

    return release;
  }

  /**
   * Crée une nouvelle release.
   * Si isLatest = true, le trigger SQL démarque automatiquement les autres.
   */
  async create(dto: CreateReleaseDto) {
    this.logger.log(
      `Creating release: ${dto.platform} v${dto.version} (${dto.filename}, ${dto.fileSize} bytes)`,
    );

    const release = await this.prisma.appRelease.create({
      data: {
        version: dto.version,
        platform: dto.platform,
        arch: dto.arch || 'universal',
        filename: dto.filename,
        fileSize: BigInt(dto.fileSize),
        downloadUrl: dto.downloadUrl,
        checksumSha256: dto.checksumSha256,
        releaseChannel: dto.releaseChannel || 'stable',
        isLatest: dto.isLatest,
        releaseNotes: dto.releaseNotes,
        minOsVersion: dto.minOsVersion,
      },
    });

    this.logger.log(`Release created: ${release.id}`);
    return release;
  }

  /**
   * Supprime une release.
   */
  async remove(id: string) {
    const release = await this.findOne(id);

    await this.prisma.appRelease.delete({
      where: { id },
    });

    this.logger.log(`Release deleted: ${id}`);
    return { deleted: true, id };
  }

  /**
   * Marque une release comme "latest" pour sa plateforme.
   * Le trigger SQL démarque automatiquement les autres.
   */
  async markAsLatest(id: string) {
    const release = await this.findOne(id);

    const updated = await this.prisma.appRelease.update({
      where: { id },
      data: { isLatest: true },
    });

    this.logger.log(
      `Release ${id} (${release.platform} v${release.version}) marked as latest`,
    );
    return updated;
  }
}
