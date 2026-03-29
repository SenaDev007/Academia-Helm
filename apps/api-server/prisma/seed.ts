/**
 * ============================================================================
 * PRISMA SEED - DONNÉES INITIALES ACADEMIA HUB
 * ============================================================================
 * 
 * Script de seed pour créer les données initiales indispensables :
 * - Pays BJ (Bénin)
 * - Tenant par défaut (nécessaire pour les autres données)
 * - Année scolaire active (2024-2025)
 * - Niveaux scolaires (Maternelle, Primaire, Secondaire)
 * - Régimes tarifaires STANDARD par niveau
 * 
 * ⚠️ IMPORTANT : Seed idempotent (peut être relancé plusieurs fois)
 * 
 * Usage:
 *   - npm run seed (depuis apps/api-server)
 *   - npm run db:seed (depuis apps/api-server)
 *   - npx ts-node prisma/seed.ts (depuis apps/api-server)
 * 
 * ⚠️ Assurez-vous que DATABASE_URL est configurée dans .env
 * 
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import * as bcrypt from 'bcrypt';
import { execSync } from 'child_process';

// Charger les variables d'environnement depuis .env
dotenv.config({ path: resolve(__dirname, '../.env') });

// Vérifier que DATABASE_URL est définie
if (!process.env.DATABASE_URL) {
  console.error('❌ ERREUR: DATABASE_URL n\'est pas définie dans .env');
  console.error('   Veuillez ajouter DATABASE_URL dans apps/api-server/.env');
  console.error('   Format: DATABASE_URL=postgresql://user:password@host:port/database');
  process.exit(1);
}

console.log('🔍 DATABASE_URL chargée:', process.env.DATABASE_URL ? `${process.env.DATABASE_URL.substring(0, 30)}...` : 'NON DÉFINIE');

// Créer un pool PostgreSQL et l'adapter Prisma (comme dans PrismaService)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter: adapter,
});

async function main() {
  console.log('🌱 Démarrage du seed...\n');

  // ============================================================================
  // 1. CRÉER LE PAYS BJ (BÉNIN) - IDEMPOTENT
  // ============================================================================
  console.log('1️⃣  Création du pays BJ (Bénin)...');
  
  const country = await prisma.country.upsert({
    where: { code: 'BJ' },
    update: {},
    create: {
      code: 'BJ',
      name: 'Bénin',
      code3: 'BEN',
      numericCode: '204',
      currencyCode: 'XOF',
      currencySymbol: 'CFA',
      phonePrefix: '+229',
      flagEmoji: '🇧🇯',
      isDefault: true,
      isActive: true,
    },
  });

  console.log(`   ✅ Pays créé: ${country.name} (${country.code})`);

  // ============================================================================
  // 2. CRÉER UN TENANT PAR DÉFAUT - IDEMPOTENT
  // ============================================================================
  // ⚠️ Nécessaire car AcademicYear, SchoolLevel, et FeeRegime nécessitent un tenantId
  console.log('\n2️⃣  Création du tenant par défaut...');
  
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'default-tenant' },
    update: {},
    create: {
      name: 'Tenant par Défaut - Academia Helm',
      slug: 'default-tenant',
      subdomain: 'default',
      countryId: country.id,
      type: 'SCHOOL',
      subscriptionStatus: 'TRIAL',
      status: 'active',
      subscriptionPlan: 'free',
    },
  });

  console.log(`   ✅ Tenant créé: ${tenant.name} (${tenant.slug})`);

  // ============================================================================
  // 2b. CRÉER LE TENANT CSPEB (ÉCOLE DE TEST) - IDEMPOTENT
  // ============================================================================
  console.log('\n2b. Création du tenant CSPEB (école de test)...');
  const tenantCspeb = await prisma.tenant.upsert({
    where: { slug: 'cspeb-eveil-afrique' },
    update: { status: 'active', type: 'SCHOOL' },
    create: {
      name: "Complexe Scolaire Privé Entrepreneurial et Bilingue - Eveil d'Afrique Education",
      slug: 'cspeb-eveil-afrique',
      subdomain: 'cspeb',
      countryId: country.id,
      type: 'SCHOOL',
      subscriptionStatus: 'ACTIVE_SUBSCRIBED',
      status: 'active',
      subscriptionPlan: 'premium',
    },
  });
  console.log(`   ✅ Tenant CSPEB créé: ${tenantCspeb.name} (${tenantCspeb.slug})`);

  // ============================================================================
  // 2c. CRÉER L'UTILISATEUR PLATFORM_OWNER - IDEMPOTENT
  // ============================================================================
  console.log('\n2c. Création de l\'utilisateur PLATFORM_OWNER...');
  const platformOwnerEmail = process.env.PLATFORM_OWNER_EMAIL || 'dev@academia-hub.local';
  const platformOwnerSecret = process.env.PLATFORM_OWNER_SECRET || 'C@ptain.Yehioracadhub2021';
  const platformOwnerPasswordHash = await bcrypt.hash(platformOwnerSecret, 10);
  
  const platformOwner = await prisma.user.upsert({
    where: { email: platformOwnerEmail },
    update: {
      passwordHash: platformOwnerPasswordHash,
      firstName: 'Platform',
      lastName: 'Owner',
      role: 'PLATFORM_OWNER',
      isSuperAdmin: true,
      status: 'active',
      tenantId: null, // PLATFORM_OWNER n'a pas de tenant
    },
    create: {
      email: platformOwnerEmail,
      passwordHash: platformOwnerPasswordHash,
      firstName: 'Platform',
      lastName: 'Owner',
      role: 'PLATFORM_OWNER',
      isSuperAdmin: true,
      status: 'active',
      tenantId: null, // PLATFORM_OWNER n'a pas de tenant
    },
  });
  console.log(`   ✅ Utilisateur PLATFORM_OWNER créé/mis à jour: ${platformOwner.email}`);

  // ============================================================================
  // 3. CRÉER L'ANNÉE SCOLAIRE ACTIVE (2025-2026) - IDEMPOTENT
  // ============================================================================
  console.log('\n3️⃣  Création de l\'année scolaire active (2025-2026)...');
  
  // Dates : Septembre 2025 - Juillet 2026
  const academicYearName = '2025-2026';
  const startDate = new Date('2025-09-01');
  const endDate = new Date('2026-07-31');
  const preEntryDate = new Date('2025-09-02'); // Lundi 2ème semaine septembre

  // Vérifier si l'année existe déjà (via $queryRaw pour compatibilité PrismaPg adapter)
  const existing = await prisma.$queryRaw<Array<{ id: string; label: string; isActive: boolean }>>`
    SELECT id, label, "isActive" FROM academic_years
    WHERE "tenantId" = ${tenant.id} AND name = ${academicYearName}
    LIMIT 1
  `;
  let academicYear: { id: string; label: string; isActive: boolean };

  if (existing.length === 0) {
    const { randomUUID } = await import('crypto');
    const id = randomUUID();
    const label = `Année scolaire ${academicYearName}`;
    await prisma.$executeRaw`
      INSERT INTO academic_years (id, "tenantId", name, label, "preEntryDate", "startDate", "endDate", "isActive", "isAutoGenerated", "createdAt", "updatedAt")
      VALUES (${id}, ${tenant.id}, ${academicYearName}, ${label}, ${preEntryDate}, ${startDate}, ${endDate}, true, false, NOW(), NOW())
    `;
    academicYear = { id, label, isActive: true };
    console.log(`   ✅ Année scolaire créée: ${academicYear.label}`);
  } else {
    academicYear = existing[0];
    if (!academicYear.isActive) {
      await prisma.$executeRaw`
        UPDATE academic_years SET "isActive" = true, "updatedAt" = NOW() WHERE id = ${academicYear.id}
      `;
      console.log(`   ✅ Année scolaire activée: ${academicYear.label}`);
    } else {
      console.log(`   ℹ️  Année scolaire déjà existante: ${academicYear.label}`);
    }
  }

  // ============================================================================
  // 4. CRÉER LES NIVEAUX SCOLAIRES - IDEMPOTENT
  // ============================================================================
  console.log('\n4️⃣  Création des niveaux scolaires...');

  const schoolLevelsData = [
    { code: 'MATERNELLE', name: 'Maternelle', label: 'Maternelle', order: 1 },
    { code: 'PRIMAIRE', name: 'Primaire', label: 'Primaire', order: 2 },
    { code: 'SECONDAIRE', name: 'Secondaire', label: 'Secondaire', order: 3 },
  ];

  const schoolLevels = [];

  for (const levelData of schoolLevelsData) {
    // Utiliser upsert avec la contrainte unique (tenantId, code)
    const schoolLevel = await prisma.schoolLevel.upsert({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: levelData.code,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        code: levelData.code,
        name: levelData.name,
        label: levelData.label,
        order: levelData.order,
      },
    });

    schoolLevels.push(schoolLevel);
    console.log(`   ✅ Niveau créé: ${schoolLevel.label} (${schoolLevel.code})`);
  }

  // ============================================================================
  // 5. CRÉER LES RÉGIMES TARIFAIRES STANDARD - IDEMPOTENT
  // ============================================================================
  console.log('\n5️⃣  Création des régimes tarifaires STANDARD...');

  for (const schoolLevel of schoolLevels) {
    // Vérifier si le régime STANDARD existe déjà pour cette combinaison
    const existingRegime = await prisma.feeRegime.findFirst({
      where: {
        tenantId: tenant.id,
        academicYearId: academicYear.id,
        schoolLevelId: schoolLevel.id,
        code: 'STANDARD',
      },
    });

    if (!existingRegime) {
      const feeRegime = await prisma.feeRegime.create({
        data: {
          tenantId: tenant.id,
          academicYearId: academicYear.id,
          schoolLevelId: schoolLevel.id,
          code: 'STANDARD',
          label: `Régime STANDARD - ${schoolLevel.label}`,
          description: `Régime tarifaire standard pour le niveau ${schoolLevel.label}`,
          isDefault: true,
        },
      });

      console.log(`   ✅ Régime STANDARD créé pour ${schoolLevel.label}`);
    } else {
      console.log(`   ℹ️  Régime STANDARD déjà existant pour ${schoolLevel.label}`);
    }
  }

  // ============================================================================
  // 6. CRÉER LA CONFIGURATION PRICING - IDEMPOTENT
  // ============================================================================
  console.log('\n6️⃣  Création de la configuration pricing...');

  // Vérifier si une config active existe déjà
  const existingConfig = await prisma.pricingConfig.findFirst({
    where: { isActive: true },
  });

  if (!existingConfig) {
    const pricingConfig = await prisma.pricingConfig.create({
      data: {
        initialSubscriptionFee: 100000, // 100 000 FCFA - Paiement initial
        multiSchoolInitialDiscountPercent: 10, // 10% de réduction sur la souscription initiale pour les promoteurs gérant plusieurs écoles
        monthlyBasePrice: 15000, // 15 000 FCFA - Prix de base mensuel
        yearlyBasePrice: 150000, // 150 000 FCFA - Prix de base annuel
        yearlyDiscountPercent: 17, // 17% de réduction pour l'abonnement annuel
        bilingualMonthlyAddon: 5000, // +5 000 FCFA/mois pour l'option bilingue
        bilingualYearlyAddon: 50000, // +50 000 FCFA/an pour l'option bilingue
        schoolAdditionalPrice: 10000, // +10 000 FCFA par école supplémentaire
        trialDays: 30, // 30 jours d'essai gratuit
        graceDays: 7, // 7 jours de grâce après expiration
        reminderDays: [7, 3, 1], // Rappels à J-7, J-3, J-1
        currency: 'XOF', // Franc CFA
        isActive: true,
        version: 1,
        createdBy: 'SEED',
        metadata: {
          seeded: true,
          seededAt: new Date().toISOString(),
          description: 'Configuration pricing par défaut pour les tests',
        },
      },
    });

    console.log(`   ✅ Configuration pricing créée: version ${pricingConfig.version}`);
    console.log(`      - Paiement initial: ${pricingConfig.initialSubscriptionFee.toLocaleString()} ${pricingConfig.currency}`);
    console.log(`      - Prix mensuel de base: ${pricingConfig.monthlyBasePrice.toLocaleString()} ${pricingConfig.currency}`);
    console.log(`      - Prix annuel de base: ${pricingConfig.yearlyBasePrice.toLocaleString()} ${pricingConfig.currency}`);
    console.log(`      - Réduction annuelle: ${pricingConfig.yearlyDiscountPercent}%`);
    console.log(`      - Réduction multi-écoles: ${pricingConfig.multiSchoolInitialDiscountPercent}%`);
  } else {
    console.log(`   ℹ️  Configuration pricing déjà existante: version ${existingConfig.version}`);
  }

  // ============================================================================
  // 7. CRÉER LES GROUP TIERS (PRIX PAR NOMBRE D'ÉCOLES) - IDEMPOTENT
  // ============================================================================
  console.log('\n7️⃣  Création des group tiers (prix par nombre d\'écoles)...');

  const groupTiers = [
    { schoolsCount: 2, monthlyPrice: 25000, yearlyPrice: 250000 },
    { schoolsCount: 3, monthlyPrice: 35000, yearlyPrice: 350000 },
    { schoolsCount: 4, monthlyPrice: 45000, yearlyPrice: 450000 },
  ];

  for (const tierData of groupTiers) {
    const existing = await prisma.pricingGroupTier.findUnique({
      where: { schoolsCount: tierData.schoolsCount },
    });

    if (!existing) {
      const tier = await prisma.pricingGroupTier.create({
        data: {
          ...tierData,
          isActive: true,
          createdBy: 'SEED',
          metadata: {
            seeded: true,
            seededAt: new Date().toISOString(),
          },
        },
      });

      console.log(`   ✅ Group tier créé: ${tier.schoolsCount} écoles - ${tier.monthlyPrice.toLocaleString()} XOF/mois - ${tier.yearlyPrice.toLocaleString()} XOF/an`);
    } else {
      console.log(`   ℹ️  Group tier déjà existant: ${tierData.schoolsCount} écoles`);
    }
  }

  // ============================================================================
  // 8. AVIS MARKETING PLATEFORME (landing — publiés & vérifiables)
  // ============================================================================
  console.log('\n8️⃣  Témoignages plateforme (platform_marketing_reviews)...');

  const reviewSeeds = [
    {
      id: 'seed-platform-review-1',
      quote:
        'Nous avons enfin une vision unique sur les inscriptions, les frais et le suivi des classes. L’équipe administrative respire.',
      authorLabel: 'Direction pédagogique',
      roleLabel: 'Proviseur adjoint',
      organizationLabel: 'Lycée privé — région côtière',
      rating: 5,
      sortOrder: 1,
    },
    {
      id: 'seed-platform-review-2',
      quote:
        'Le module financier et les relances nous ont fait gagner un temps précieux sur la préparation de la rentrée.',
      authorLabel: 'Service comptable',
      roleLabel: 'Responsable financier',
      organizationLabel: 'Groupe scolaire K–12',
      rating: 5,
      sortOrder: 2,
    },
    {
      id: 'seed-platform-review-3',
      quote:
        'ORION nous aide à prioriser les dossiers sensibles sans noyer l’équipe dans des tableaux interminables.',
      authorLabel: 'Secrétariat général',
      roleLabel: 'Secrétaire général',
      organizationLabel: 'Collège & lycée',
      rating: 5,
      sortOrder: 3,
    },
  ];

  const verifiedAt = new Date('2025-03-01T00:00:00.000Z');
  for (const r of reviewSeeds) {
    await prisma.platformMarketingReview.upsert({
      where: { id: r.id },
      create: {
        ...r,
        published: true,
        verifiedAt,
        collectMethod: 'seed_internal',
      },
      update: {
        quote: r.quote,
        authorLabel: r.authorLabel,
        roleLabel: r.roleLabel,
        organizationLabel: r.organizationLabel,
        rating: r.rating,
        sortOrder: r.sortOrder,
        published: true,
        verifiedAt,
        collectMethod: 'seed_internal',
      },
    });
  }
  console.log(`   ✅ ${reviewSeeds.length} avis plateforme (publiés) assurés`);

  // ============================================================================
  // 8 bis — Avis Helm natifs (table reviews, landing dynamique)
  // ============================================================================
  console.log('\n8️⃣ bis  Avis Helm natifs (reviews, APPROVED)...');
  const tenantForReviews = await prisma.tenant.findFirst({
    where: { slug: 'default-tenant' },
  });
  const publishedDemo = new Date('2025-03-15T12:00:00.000Z');
  const helmReviewSeeds: Array<{
    id: string;
    authorName: string;
    authorRole: string;
    schoolName: string;
    city: string;
    rating: number;
    comment: string;
    featured: boolean;
  }> = [
    {
      id: 'seed-helm-review-1',
      authorName: 'Marie Dossou',
      authorRole: 'Directrice',
      schoolName: 'Complexe scolaire Horizon',
      city: 'Cotonou',
      rating: 5,
      comment:
        'Pilotage clair des inscriptions et des finances : nous avons enfin une vision unique pour toute l’équipe.',
      featured: true,
    },
    {
      id: 'seed-helm-review-2',
      authorName: 'Koffi Mensah',
      authorRole: 'Fondateur',
      schoolName: 'Groupe Alpha Éducation',
      city: 'Porto-Novo',
      rating: 5,
      comment:
        'ORION et les tableaux de bord nous aident à prioriser sans nous noyer dans les chiffres.',
      featured: false,
    },
    {
      id: 'seed-helm-review-3',
      authorName: 'Aminata Traoré',
      authorRole: 'Responsable administratif',
      schoolName: 'Lycée privé Les Bambous',
      city: 'Parakou',
      rating: 4,
      comment:
        'Interface sobre, équipe réactive. Les relances et les exports nous font gagner un temps précieux.',
      featured: false,
    },
  ];

  for (const r of helmReviewSeeds) {
    await prisma.review.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        authorName: r.authorName,
        authorRole: r.authorRole,
        schoolName: r.schoolName,
        city: r.city,
        photoUrl: null,
        rating: r.rating,
        comment: r.comment,
        status: 'APPROVED',
        featured: r.featured,
        source: 'MANUAL',
        publishedAt: publishedDemo,
        tenantId: tenantForReviews?.id ?? null,
      },
      update: {
        authorName: r.authorName,
        authorRole: r.authorRole,
        schoolName: r.schoolName,
        city: r.city,
        rating: r.rating,
        comment: r.comment,
        status: 'APPROVED',
        featured: r.featured,
        publishedAt: publishedDemo,
        tenantId: tenantForReviews?.id ?? null,
      },
    });
  }
  console.log(`   ✅ ${helmReviewSeeds.length} avis Helm (reviews) assurés`);

  // ============================================================================
  // RÉSUMÉ
  // ============================================================================
  console.log('\n' + '='.repeat(60));
  console.log('✅ Seed terminé avec succès!');
  console.log('='.repeat(60));
  console.log('\n📊 Données créées:');
  console.log(`   - Pays: ${country.name} (${country.code})`);
  console.log(`   - Tenants: ${tenant.name}, ${tenantCspeb.name}`);
  console.log(`   - PLATFORM_OWNER: ${platformOwner.email}`);
  console.log(`   - Année scolaire: ${academicYear.label}`);
  console.log(`   - Niveaux scolaires: ${schoolLevels.length} (${schoolLevels.map(s => s.label).join(', ')})`);
  console.log(`   - Régimes tarifaires: ${schoolLevels.length} (STANDARD par niveau)`);
  
  // Afficher le résumé de la configuration pricing
  const activeConfig = await prisma.pricingConfig.findFirst({
    where: { isActive: true },
  });
  if (activeConfig) {
    console.log(`   - Configuration pricing: version ${activeConfig.version} (active)`);
    console.log(`     • Paiement initial: ${activeConfig.initialSubscriptionFee.toLocaleString()} ${activeConfig.currency}`);
    console.log(`     • Prix mensuel: ${activeConfig.monthlyBasePrice.toLocaleString()} ${activeConfig.currency}`);
    console.log(`     • Prix annuel: ${activeConfig.yearlyBasePrice.toLocaleString()} ${activeConfig.currency}`);
    console.log(`     • Réduction annuelle: ${activeConfig.yearlyDiscountPercent}%`);
  }
  
  const tiersCount = await prisma.pricingGroupTier.count({
    where: { isActive: true },
  });
  if (tiersCount > 0) {
    console.log(`   - Group tiers: ${tiersCount} tiers de prix configurés`);
  }

  // ============================================================================
  // PERMISSIONS RBAC — EXHAUSTIF (tous modules × read/write/delete/validate)
  // Aligné avec PermissionGuard et feature flags (production)
  // ============================================================================
  console.log('\n🔐 Seed des permissions RBAC (exhaustif)...');
  const RESOURCES = [
    'ELEVES',
    'INSCRIPTIONS',
    'DOCUMENTS_SCOLAIRES',
    'ORGANISATION_PEDAGOGIQUE',
    'MATERIEL_PEDAGOGIQUE',
    'EXAMENS',
    'BULLETINS',
    'FINANCES',
    'RECOUVREMENT',
    'DEPENSES',
    'RH',
    'PAIE',
    'COMMUNICATION',
    'PARAMETRES',
    'ANNEES_SCOLAIRES',
    'ORION',
    'ATLAS',
    'QHSE',
    'BIBLIOTHEQUE',
    'TRANSPORT',
    'CANTINE',
    'INFIRMERIE',
    'EDUCAST',
    'BOUTIQUE',
  ];
  const ACTIONS = ['read', 'write', 'delete', 'validate'];
  let permsCreated = 0;
  for (const resource of RESOURCES) {
    for (const action of ACTIONS) {
      const name = `${resource}_${action}`;
      await prisma.permission.upsert({
        where: { name },
        update: { resource, action, description: `${resource} - ${action}` },
        create: { name, resource, action, description: `${resource} - ${action}` },
      });
      permsCreated += 1;
    }
  }
  console.log(`   ✅ Permissions: ${permsCreated} (${RESOURCES.length} ressources × ${ACTIONS.length} actions)`);

  // Récupérer toutes les permissions pour les attributions par rôle
  const allPermissions = await prisma.permission.findMany({ select: { id: true, name: true } });
  const permissionIdByName = new Map(allPermissions.map((p) => [p.name, p.id]));

  // ============================================================================
  // RÔLES SYSTÈME — création + attribution des permissions par défaut
  // ============================================================================
  console.log('\n👤 Seed des rôles système RBAC...');

  type RoleDef = {
    name: string;
    description: string;
    canAccessOrion: boolean;
    canAccessAtlas: boolean;
    permissionNames: string[]; // ['EXAMENS_read', 'FINANCES_read', ...]
  };

  const SYSTEM_ROLES: RoleDef[] = [
    {
      name: 'PLATFORM_OWNER',
      description: 'Propriétaire plateforme (vision globale, toutes les écoles)',
      canAccessOrion: true,
      canAccessAtlas: true,
      permissionNames: allPermissions.map((p) => p.name),
    },
    {
      name: 'PLATFORM_ADMIN',
      description: 'Administrateur plateforme',
      canAccessOrion: true,
      canAccessAtlas: true,
      permissionNames: allPermissions.map((p) => p.name),
    },
    {
      name: 'PROMOTEUR',
      description: 'Promoteur / Gestionnaire d\'établissement (vision globale tenant)',
      canAccessOrion: true,
      canAccessAtlas: true,
      permissionNames: allPermissions.map((p) => p.name),
    },
    {
      name: 'DIRECTEUR',
      description: 'Direction (vision globale établissement)',
      canAccessOrion: true,
      canAccessAtlas: true,
      permissionNames: [
        'ELEVES_read', 'ELEVES_write', 'ELEVES_validate', 'INSCRIPTIONS_read', 'INSCRIPTIONS_write', 'DOCUMENTS_SCOLAIRES_read', 'DOCUMENTS_SCOLAIRES_write', 'DOCUMENTS_SCOLAIRES_validate',
        'ORGANISATION_PEDAGOGIQUE_read', 'ORGANISATION_PEDAGOGIQUE_write', 'MATERIEL_PEDAGOGIQUE_read',
        'EXAMENS_read', 'EXAMENS_validate', 'BULLETINS_read', 'BULLETINS_validate',
        'FINANCES_read', 'RECOUVREMENT_read', 'DEPENSES_read',
        'RH_read', 'PAIE_read',
        'COMMUNICATION_read', 'COMMUNICATION_write',
        'PARAMETRES_read', 'PARAMETRES_write', 'ANNEES_SCOLAIRES_read', 'ANNEES_SCOLAIRES_write',
        'ORION_read', 'ATLAS_read',
        'QHSE_read', 'BIBLIOTHEQUE_read', 'TRANSPORT_read', 'CANTINE_read', 'INFIRMERIE_read', 'EDUCAST_read', 'BOUTIQUE_read',
      ],
    },
    {
      name: 'SECRETAIRE',
      description: 'Secrétariat (élèves, inscriptions, documents)',
      canAccessOrion: false,
      canAccessAtlas: false,
      permissionNames: [
        'ELEVES_read', 'ELEVES_write', 'INSCRIPTIONS_read', 'INSCRIPTIONS_write', 'DOCUMENTS_SCOLAIRES_read', 'DOCUMENTS_SCOLAIRES_write',
        'EXAMENS_read', 'BULLETINS_read',
        'FINANCES_read', 'RECOUVREMENT_read', 'RECOUVREMENT_write',
        'PARAMETRES_read', 'ANNEES_SCOLAIRES_read',
        'BIBLIOTHEQUE_read', 'TRANSPORT_read', 'CANTINE_read', 'INFIRMERIE_read',
      ],
    },
    {
      name: 'COMPTABLE',
      description: 'Finances et économat (lecture/écriture, pas les notes)',
      canAccessOrion: false,
      canAccessAtlas: false,
      permissionNames: [
        'FINANCES_read', 'FINANCES_write', 'RECOUVREMENT_read', 'RECOUVREMENT_write', 'DEPENSES_read', 'DEPENSES_write',
        'EXAMENS_read', 'BULLETINS_read',
        'ELEVES_read', 'RH_read', 'PARAMETRES_read', 'ANNEES_SCOLAIRES_read',
      ],
    },
    {
      name: 'SECRETAIRE_COMPTABLE',
      description: 'Secrétariat + Comptabilité',
      canAccessOrion: false,
      canAccessAtlas: false,
      permissionNames: [
        'ELEVES_read', 'ELEVES_write', 'INSCRIPTIONS_read', 'INSCRIPTIONS_write', 'DOCUMENTS_SCOLAIRES_read', 'DOCUMENTS_SCOLAIRES_write',
        'EXAMENS_read', 'BULLETINS_read',
        'FINANCES_read', 'FINANCES_write', 'RECOUVREMENT_read', 'RECOUVREMENT_write', 'DEPENSES_read', 'DEPENSES_write',
        'PARAMETRES_read', 'ANNEES_SCOLAIRES_read',
        'BIBLIOTHEQUE_read', 'TRANSPORT_read', 'CANTINE_read', 'INFIRMERIE_read',
      ],
    },
    {
      name: 'CENSEUR',
      description: 'Censeur (discipline, pédagogie, examens)',
      canAccessOrion: true,
      canAccessAtlas: false,
      permissionNames: [
        'ELEVES_read', 'ELEVES_write', 'INSCRIPTIONS_read', 'DOCUMENTS_SCOLAIRES_read',
        'ORGANISATION_PEDAGOGIQUE_read', 'MATERIEL_PEDAGOGIQUE_read',
        'EXAMENS_read', 'EXAMENS_write', 'EXAMENS_validate', 'BULLETINS_read', 'BULLETINS_validate',
        'RH_read', 'COMMUNICATION_read', 'PARAMETRES_read', 'ANNEES_SCOLAIRES_read', 'ORION_read',
        'QHSE_read', 'BIBLIOTHEQUE_read', 'TRANSPORT_read', 'CANTINE_read', 'INFIRMERIE_read',
      ],
    },
    {
      name: 'SURVEILLANT',
      description: 'Surveillance (assiduité, discipline)',
      canAccessOrion: false,
      canAccessAtlas: false,
      permissionNames: [
        'ELEVES_read', 'INSCRIPTIONS_read', 'DOCUMENTS_SCOLAIRES_read',
        'EXAMENS_read', 'BULLETINS_read',
        'PARAMETRES_read', 'BIBLIOTHEQUE_read', 'TRANSPORT_read', 'CANTINE_read', 'INFIRMERIE_read',
      ],
    },
    {
      name: 'ENSEIGNANT',
      description: 'Enseignant (ses classes uniquement — scope par niveau/classe côté app)',
      canAccessOrion: false,
      canAccessAtlas: false,
      permissionNames: [
        'ELEVES_read', 'INSCRIPTIONS_read', 'DOCUMENTS_SCOLAIRES_read',
        'ORGANISATION_PEDAGOGIQUE_read', 'MATERIEL_PEDAGOGIQUE_read',
        'EXAMENS_read', 'EXAMENS_write', 'BULLETINS_read',
        'COMMUNICATION_read', 'PARAMETRES_read', 'ANNEES_SCOLAIRES_read',
        'BIBLIOTHEQUE_read', 'TRANSPORT_read', 'CANTINE_read', 'INFIRMERIE_read',
      ],
    },
    {
      name: 'PARENT',
      description: 'Parent (accès aux enfants uniquement — scope côté app)',
      canAccessOrion: false,
      canAccessAtlas: false,
      permissionNames: [
        'ELEVES_read', 'BULLETINS_read', 'COMMUNICATION_read',
      ],
    },
    {
      name: 'ELEVE',
      description: 'Élève (accès personnel — scope côté app)',
      canAccessOrion: false,
      canAccessAtlas: false,
      permissionNames: [
        'ELEVES_read', 'BULLETINS_read', 'COMMUNICATION_read',
      ],
    },
  ];

  for (const sr of SYSTEM_ROLES) {
    let role = await prisma.role.findFirst({
      where: { tenantId: null, name: sr.name, isSystemRole: true },
    });
    if (!role) {
      role = await prisma.role.create({
        data: {
          tenantId: null,
          name: sr.name,
          description: sr.description,
          isSystemRole: true,
          canAccessOrion: sr.canAccessOrion,
          canAccessAtlas: sr.canAccessAtlas,
          allowedLevelIds: [],
        },
      });
      console.log(`   ✅ Rôle système créé: ${sr.name}`);
    } else {
      await prisma.role.update({
        where: { id: role.id },
        data: { description: sr.description, canAccessOrion: sr.canAccessOrion, canAccessAtlas: sr.canAccessAtlas },
      });
    }

    const permissionIds = sr.permissionNames
      .map((name) => permissionIdByName.get(name))
      .filter((id): id is string => id != null);

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: role!.id, permissionId })),
        skipDuplicates: true,
      });
    }
    console.log(`   ✅ Permissions attribuées: ${sr.name} (${permissionIds.length} permissions)`);
  }

  console.log('   ✅ Rôles système RBAC prêts (créés/mis à jour + permissions par défaut)');

  console.log('\n🎯 La base de données est prête à l\'usage!');
}

const runSeedWithAutoSchemaFix = async () => {
  let didAutoFix = false;
  try {
    await main();
  } catch (e: any) {
    const code = e?.code as string | undefined;
    const isMissingColumn = code === 'P2022' || /column.*does not exist/i.test(String(e?.message ?? ''));

    if (!didAutoFix && isMissingColumn) {
      didAutoFix = true;
      console.log('\n🧠 Colonnes manquantes détectées (Prisma P2022). Synchronisation automatique de la BDD...');

      // `db push` peut refuser s’il y a des risques de data loss (ex: ajouts de contraintes uniques).
      // Comme on est en contexte "seed/test", on vérifie d'abord les doublons sur les colonnes
      // concernées par ces warnings, puis on relance avec `--accept-data-loss`.
      try {
        // Doublons pour la contrainte unique: (tenantId, matricule)
        const studentDup = await pool.query(
          'SELECT 1 AS hasDup FROM "students" WHERE "tenantId" IS NOT NULL AND "matricule" IS NOT NULL GROUP BY "tenantId", "matricule" HAVING COUNT(*) > 1 LIMIT 1'
        );
        // Doublons pour la contrainte unique: (tenantId) sur subscriptions
        const subscriptionDup = await pool.query(
          'SELECT 1 AS hasDup FROM "subscriptions" WHERE "tenantId" IS NOT NULL GROUP BY "tenantId" HAVING COUNT(*) > 1 LIMIT 1'
        );

        const hasStudentDup = studentDup.rows?.length > 0;
        const hasSubscriptionDup = subscriptionDup.rows?.length > 0;

        if (hasStudentDup || hasSubscriptionDup) {
          console.error('\n❌ db push refusé : des doublons existent sur les colonnes uniques à ajouter.');
          console.error('Veuillez nettoyer la BDD (suppression/merge) avant de relancer le seed.');
          throw new Error('Doublons existants pour contraintes uniques.');
        }
      } catch (dupErr) {
        // Si les tables n'existent pas encore, on continue (db push va les créer).
        // Si erreur d'autre nature, on remonte.
        const msg = String((dupErr as any)?.message ?? '');
        const isTableMissing = /relation .* does not exist|table.*does not exist/i.test(msg);
        if (!isTableMissing) throw dupErr;
      }

      try {
        execSync('npx prisma db push --schema=prisma/schema.prisma --accept-data-loss', {
          cwd: resolve(__dirname, '..'),
          stdio: 'inherit',
        });
      } catch (syncErr: any) {
        const msg = String(syncErr?.message ?? syncErr);
        // Cas typique quand db push a déjà partiellement appliqué des index/contraintes.
        if (/exists already/i.test(msg) || /already exists/i.test(msg)) {
          console.warn('\n⚠️ db push a échoué mais semble avoir appliqué une partie des changements. On continue...');
        } else {
          throw syncErr;
        }
      }

      execSync('npx prisma generate --schema=prisma/schema.prisma', {
        cwd: resolve(__dirname, '..'),
        stdio: 'inherit',
      });

      console.log('✅ Synchronisation OK (ou application partielle). Relance du seed...');
      await main();
      return;
    }

    console.error('\n❌ Erreur lors du seed:');
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

runSeedWithAutoSchemaFix().catch((e) => {
  console.error('\n❌ Erreur fatale pendant le seed:');
  console.error(e);
  process.exit(1);
});
