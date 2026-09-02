/**
 * ============================================================================
 * Script : Applique la migration OTP + grandfather CSPEB
 * ============================================================================
 *
 * Ce script fait 2 choses :
 * 1. Applique la migration SQL qui ajoute les colonnes OTP + expiry à la table
 *    settings_bilingual (pendingOtpCode, pendingOtpExpiresAt, pendingOtpAttempts,
 *    otpActivatedAt, expiresAt, isExpired)
 * 2. Pour le tenant CSPEB (59b8c348-ae5f-4d67-8fbd-af6aefa1f394), considéré
 *    comme déjà en règle :
 *    - Active le mode bilingue (isEnabled = true)
 *    - Définit activatedAt = maintenant
 *    - Définit expiresAt = dans 10 ans (jamais d'expiration pratique)
 *    - Définit isExpired = false
 *
 * Usage sur Railway :
 *   railway run npx ts-node scripts/migrate-bilingual-otp-and-grandfather-cspeb.ts
 *
 * Usage en local :
 *   npx ts-node scripts/migrate-bilingual-otp-and-grandfather-cspeb.ts
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CSPEB_TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Migration OTP Bilingue + Grandfather CSPEB');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // ─── Étape 1 : Appliquer la migration SQL directement ───
  console.log('\n📋 Étape 1 : Application de la migration SQL...');
  const migrationSql = `
    ALTER TABLE "settings_bilingual" ADD COLUMN IF NOT EXISTS "pendingOtpCode" TEXT;
    ALTER TABLE "settings_bilingual" ADD COLUMN IF NOT EXISTS "pendingOtpExpiresAt" TIMESTAMP(3);
    ALTER TABLE "settings_bilingual" ADD COLUMN IF NOT EXISTS "pendingOtpAttempts" INTEGER DEFAULT 0;
    ALTER TABLE "settings_bilingual" ADD COLUMN IF NOT EXISTS "otpActivatedAt" TIMESTAMP(3);
    ALTER TABLE "settings_bilingual" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
    ALTER TABLE "settings_bilingual" ADD COLUMN IF NOT EXISTS "isExpired" BOOLEAN DEFAULT false;
  `;
  try {
    await prisma.$executeRawUnsafe(migrationSql);
    console.log('  ✅ Migration SQL appliquée avec succès');
  } catch (err: any) {
    console.error('  ❌ Erreur migration SQL:', err.message);
    throw err;
  }

  // ─── Étape 2 : Grandfather CSPEB ───
  console.log('\n📋 Étape 2 : Grandfather CSPEB (tenant: ' + CSPEB_TENANT_ID + ')...');
  const now = new Date();
  const tenYears = new Date(now);
  tenYears.setFullYear(tenYears.getFullYear() + 10);

  // Vérifier si le settings_bilingual existe pour CSPEB
  let settings = await prisma.settingsBilingual.findUnique({
    where: { tenantId: CSPEB_TENANT_ID },
  });

  if (!settings) {
    // Créer le settings_bilingual pour CSPEB
    settings = await prisma.settingsBilingual.create({
      data: {
        tenantId: CSPEB_TENANT_ID,
        isEnabled: true,
        separateSubjects: true,
        separateGrades: true,
        defaultLanguage: 'FR',
        defaultUILanguage: 'FR',
        migrationRequired: false,
        billingImpactAcknowledged: true,
        activatedAt: now,
        otpActivatedAt: now,
        expiresAt: tenYears,
        isExpired: false,
        pendingOtpAttempts: 0,
      },
    });
    console.log('  ✅ settings_bilingual créé pour CSPEB (isEnabled=true, expiresAt=' + tenYears.toISOString() + ')');
  } else {
    // Mettre à jour le settings_bilingual existant pour CSPEB
    settings = await prisma.settingsBilingual.update({
      where: { tenantId: CSPEB_TENANT_ID },
      data: {
        isEnabled: true,
        activatedAt: settings.activatedAt || now,
        otpActivatedAt: settings.otpActivatedAt || settings.activatedAt || now,
        expiresAt: tenYears,
        isExpired: false,
        pendingOtpCode: null,
        pendingOtpExpiresAt: null,
        pendingOtpAttempts: 0,
      },
    });
    console.log('  ✅ settings_bilingual mis à jour pour CSPEB (isEnabled=true, expiresAt=' + tenYears.toISOString() + ')');
  }

  // ─── Étape 3 : Synchroniser le feature flag BILINGUAL_TRACK pour CSPEB ───
  console.log('\n📋 Étape 3 : Synchronisation du feature flag BILINGUAL_TRACK pour CSPEB...');
  const existingFeature = await prisma.tenantFeature.findFirst({
    where: { tenantId: CSPEB_TENANT_ID, featureCode: 'BILINGUAL_TRACK' as any },
  });
  if (existingFeature) {
    await prisma.tenantFeature.update({
      where: { id: existingFeature.id },
      data: { isEnabled: true },
    });
    console.log('  ✅ Feature flag BILINGUAL_TRACK activé pour CSPEB');
  } else {
    await prisma.tenantFeature.create({
      data: {
        tenantId: CSPEB_TENANT_ID,
        featureCode: 'BILINGUAL_TRACK' as any,
        isEnabled: true,
        enabledBy: 'system',
        enabledReason: 'Grandfathered — CSPEB is already paid and in good standing',
      },
    });
    console.log('  ✅ Feature flag BILINGUAL_TRACK créé et activé pour CSPEB');
  }

  // ─── Étape 4 : Synchroniser Subscription.bilingualEnabled pour CSPEB ───
  console.log('\n📋 Étape 4 : Synchronisation de Subscription.bilingualEnabled pour CSPEB...');
  const subResult = await prisma.subscription.updateMany({
    where: { tenantId: CSPEB_TENANT_ID },
    data: { bilingualEnabled: true },
  });
  if (subResult.count > 0) {
    console.log('  ✅ Subscription.bilingualEnabled = true pour CSPEB (' + subResult.count + ' ligne(s) mise(s) à jour)');
  } else {
    console.log('  ⚠️  Aucune subscription trouvée pour CSPEB — ignoré');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅ Migration + Grandfather CSPEB terminé avec succès');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\nRésumé :');
  console.log('  - Colonnes OTP + expiry ajoutées à settings_bilingual');
  console.log('  - CSPEB (' + CSPEB_TENANT_ID + ') marqué comme :');
  console.log('    • isEnabled = true');
  console.log('    • expiresAt = ' + tenYears.toISOString() + ' (dans 10 ans)');
  console.log('    • isExpired = false');
  console.log('    • BILINGUAL_TRACK feature flag = true');
  console.log('    • Subscription.bilingualEnabled = true');
  console.log('');
}

main()
  .catch((e) => {
    console.error('\n❌ Erreur fatale:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
