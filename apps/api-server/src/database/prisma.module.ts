import { Module } from '@nestjs/common';

/**
 * PrismaModule — alias léger qui réexporte PrismaService depuis DatabaseModule.
 *
 * ⚠️ IMPORTANT : Ne PAS fournir PrismaService ici ! DatabaseModule est @Global()
 * et fournit déjà PrismaService. Si on le fournit aussi ici, NestJS crée une
 * DEUXIÈME instance de PrismaClient (très lourde en mémoire avec 534 modèles),
 * ce qui provoque un crash OOM (Out of Memory) sur Railway.
 *
 * Ce module existe uniquement pour la compatibilité avec les imports qui
 * font `import { PrismaModule }` au lieu de `import { DatabaseModule }`.
 */
@Module({})
export class PrismaModule {}
