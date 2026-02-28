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
        // ⚠️ IMPORTANT:
        // - `DIRECT_URL` (5432) est généralement le meilleur choix pour TypeORM en local
        // - `DATABASE_URL` peut parfois pointer vers un pooler/port différent
        const directUrl = configService.get<string>('DIRECT_URL');
        const databaseUrl = configService.get<string>('DATABASE_URL');
        const typeOrmUrl = directUrl || databaseUrl;

        const base = {
          type: 'postgres' as const,
          entities: [__dirname + '/../**/*.entity{.ts,.js}'],
          synchronize: false,
          logging: false,
          ssl:
            configService.get<string>('DB_SSL') === 'true'
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

        if (typeOrmUrl) {
          return {
            ...base,
            url: typeOrmUrl,
          };
        }

        return {
          ...base,
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: configService.get<number>('DB_PORT', 5432),
          username: configService.get<string>('DB_USERNAME', 'postgres'),
          password: configService.get<string>('DB_PASSWORD', 'postgres'),
          database: configService.get<string>('DB_DATABASE', 'academia_helm'),
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [PrismaService, DatabaseTriggersBootstrapService],
  exports: [PrismaService],
})
export class DatabaseModule {}

