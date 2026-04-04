import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { DatabaseTriggersBootstrapService } from './database-triggers-bootstrap.service';

@Global() // Global pour que PrismaService soit disponible partout
@Module({
  imports: [
    /**
     * ✅ TypeORM DOIT rester activé
     *
     * Plusieurs modules/repositories dans ce repo utilisent TypeORM (DataSource, @InjectRepository, etc.).
     * Le désactiver casse l'injection de dépendances (ex: StudentAcademicTrackRepository).
     *
     * On le configure pour :
     * - utiliser DATABASE_URL si disponible (le plus fiable)
     * - ne pas boucler en retry (évite hang + OOM en dev)
     * - timeout raisonnable via pg "connectionTimeoutMillis"
     */
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const databaseUrl =
          configService.get<string>('DATABASE_URL') || process.env.DATABASE_URL;
        const directUrl =
          configService.get<string>('DIRECT_URL') || process.env.DIRECT_URL;
        // Neon : préférer la connexion directe pour TypeORM si les deux sont définies
        const typeOrmUrl = directUrl || databaseUrl;

        if (!typeOrmUrl?.trim()) {
          throw new Error(
            'DATABASE_URL (ou DIRECT_URL) doit être défini — requis pour Neon / Railway ; pas de fallback localhost.',
          );
        }

        const base = {
          type: 'postgres' as const,
          entities: [__dirname + '/../**/*.entity{.ts,.js}'],
          synchronize: false,
          logging: false,
          ssl:
            configService.get<string>('DB_SSL') === 'true' ||
            /\.neon\.tech|sslmode=require|sslmode=verify/i.test(typeOrmUrl)
              ? { rejectUnauthorized: false }
              : false,
          autoLoadEntities: true,
          // ✅ éviter les loops de retry infinies (et OOM) en dev
          retryAttempts: 1,
          retryDelay: 1000,
          extra: {
            max: 10,
            connectionTimeoutMillis: 30000,
            statement_timeout: 5000,
          },
        };

        return {
          ...base,
          url: typeOrmUrl,
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [PrismaService, DatabaseTriggersBootstrapService],
  exports: [PrismaService],
})
export class DatabaseModule {}

