/**
 * ============================================================================
 * SEED TEST TENANTS - Création complète de 2 tenants/écoles de test
 * ============================================================================
 * 
 * Ce script crée 2 tenants complets avec :
 * - Country (Bénin)
 * - Tenant 1: CSPEB (Parakou)
 * - Tenant 2: La Persévérance (N'Dali)
 * - School pour chaque tenant
 * - Tous les types d'utilisateurs avec leurs identifiants depuis .env
 * - SchoolLevels (Maternelle, Primaire, Secondaire)
 * - AcademicYear active (2025-2026)
 * 
 * Usage: npx ts-node prisma/seed-test-tenants.ts
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Informations depuis ENV-EXAMPLE.txt
const TENANTS_DATA = [
  {
    school: {
      name: 'Complexe Scolaire Privé Entrepreneurial et Bilingue - Eveil d\'Afrique Education',
      nameShort: 'CSPEB-Eveil d\'Afrique Education',
      slug: 'cspeb-eveil-afrique',
      subdomain: 'cspeb',
      address: 'A 500m de la RNIE 2, 1ère Von apres EPP Bèyarou',
      contact: '+229 0195722234',
      email: 'cspeb-eveildafriqueeducation@gmail.com',
      city: 'Parakou',
      country: 'Bénin',
      countryCode: 'BJ',
    },
    users: {
      promoteur: {
        email: 'promoteur@cspeb.bj',
        password: 'promoteur123',
        firstName: 'Promoteur',
        lastName: 'CSPEB',
        role: 'SUPER_DIRECTOR',
      },
      directeur: {
        email: 's.akpovitohou@gmail.com',
        password: 'C@ptain.Yehioracadhub2021',
        firstName: 'Directeur',
        lastName: 'CSPEB',
        role: 'DIRECTOR',
      },
      secretaire: {
        email: 'secretaire@cspeb.bj',
        password: 'secretaire123',
        firstName: 'Secrétaire',
        lastName: 'CSPEB',
        role: 'ADMIN',
      },
      comptable: {
        email: 'comptable@cspeb.bj',
        password: 'comptable123',
        firstName: 'Comptable',
        lastName: 'CSPEB',
        role: 'ACCOUNTANT',
      },
      secretaireComptable: {
        email: 'secretaire.comptable@cspeb.bj',
        password: 'seccompta123',
        firstName: 'Secrétaire',
        lastName: 'Comptable CSPEB',
        role: 'ACCOUNTANT',
      },
      censeur: {
        email: 'censeur@cspeb.bj',
        password: 'censeur123',
        firstName: 'Censeur',
        lastName: 'CSPEB',
        role: 'DIRECTOR',
      },
      surveillant: {
        email: 'surveillant@cspeb.bj',
        password: 'surveillant123',
        firstName: 'Surveillant',
        lastName: 'CSPEB',
        role: 'ADMIN',
      },
      enseignant1: {
        email: 'enseignant1@cspeb.bj',
        password: 'enseignant123',
        firstName: 'Enseignant',
        lastName: '1 CSPEB',
        role: 'TEACHER',
        matricule: 'EMP001',
      },
      enseignant2: {
        email: 'enseignant2@cspeb.bj',
        password: 'enseignant456',
        firstName: 'Enseignant',
        lastName: '2 CSPEB',
        role: 'TEACHER',
        matricule: 'EMP002',
      },
    },
  },
  {
    school: {
      name: 'La Persévérance',
      nameShort: 'La Persévérance',
      slug: 'la-perseverance',
      subdomain: 'perseverance',
      address: 'N\'Dali, Bénin',
      contact: '+229 0123456789',
      email: 'contact@perseverance.bj',
      city: 'N\'Dali',
      country: 'Bénin',
      countryCode: 'BJ',
    },
    users: {
      promoteur: {
        email: 'promoteur@perseverance.bj',
        password: 'promoteur123',
        firstName: 'Promoteur',
        lastName: 'La Persévérance',
        role: 'SUPER_DIRECTOR',
      },
      directeur: {
        email: 'directeur@perseverance.bj',
        password: 'C@ptain.Yehioracadhub2021',
        firstName: 'Directeur',
        lastName: 'La Persévérance',
        role: 'DIRECTOR',
      },
      secretaire: {
        email: 'secretaire@perseverance.bj',
        password: 'secretaire123',
        firstName: 'Secrétaire',
        lastName: 'La Persévérance',
        role: 'ADMIN',
      },
      comptable: {
        email: 'comptable@perseverance.bj',
        password: 'comptable123',
        firstName: 'Comptable',
        lastName: 'La Persévérance',
        role: 'ACCOUNTANT',
      },
      secretaireComptable: {
        email: 'secretaire.comptable@perseverance.bj',
        password: 'seccompta123',
        firstName: 'Secrétaire',
        lastName: 'Comptable La Persévérance',
        role: 'ACCOUNTANT',
      },
      censeur: {
        email: 'censeur@perseverance.bj',
        password: 'censeur123',
        firstName: 'Censeur',
        lastName: 'La Persévérance',
        role: 'DIRECTOR',
      },
      surveillant: {
        email: 'surveillant@perseverance.bj',
        password: 'surveillant123',
        firstName: 'Surveillant',
        lastName: 'La Persévérance',
        role: 'ADMIN',
      },
      enseignant1: {
        email: 'enseignant1@perseverance.bj',
        password: 'enseignant123',
        firstName: 'Enseignant',
        lastName: '1 La Persévérance',
        role: 'TEACHER',
        matricule: 'EMP001',
      },
      enseignant2: {
        email: 'enseignant2@perseverance.bj',
        password: 'enseignant456',
        firstName: 'Enseignant',
        lastName: '2 La Persévérance',
        role: 'TEACHER',
        matricule: 'EMP002',
      },
    },
  },
];

// PLATFORM_OWNER (commun aux deux tenants)
const PLATFORM_OWNER = {
  email: process.env.PLATFORM_OWNER_EMAIL || 'dev@academia-hub.local',
  password: process.env.PLATFORM_OWNER_SECRET || 'C@ptain.Yehioracadhub2021',
  firstName: 'Platform',
  lastName: 'Owner',
};

async function createOrUpdateUser(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  role: string,
  tenantId: string,
  isSuperAdmin: boolean = false,
) {
  const passwordHash = await bcrypt.hash(password, 10);
  
  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    return await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        tenantId,
        firstName,
        lastName,
        role,
        isSuperAdmin,
        status: 'active',
      },
    });
  } else {
    return await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        tenantId,
        role,
        isSuperAdmin,
        status: 'active',
      },
    });
  }
}

async function createTeacher(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  matricule: string,
  tenantId: string,
) {
  // Créer l'utilisateur
  const user = await createOrUpdateUser(
    email,
    password,
    firstName,
    lastName,
    'TEACHER',
    tenantId,
  );

  // Récupérer le premier niveau scolaire (PRIMAIRE par défaut)
  const schoolLevel = await prisma.schoolLevel.findFirst({
    where: {
      tenantId,
      code: 'PRIMAIRE',
    },
  });

  if (!schoolLevel) {
    console.warn(`   ⚠️  Aucun niveau scolaire trouvé pour le tenant ${tenantId}, l'enseignant ne sera pas créé`);
    return user;
  }

  // Créer l'enseignant
  const existingTeacher = await prisma.teacher.findFirst({
    where: {
      tenantId,
      matricule,
    },
  });

  if (!existingTeacher) {
    await prisma.teacher.create({
      data: {
        tenantId,
        schoolLevelId: schoolLevel.id,
        matricule,
        firstName,
        lastName,
        email,
        status: 'active',
      },
    });
  }

  return user;
}

async function main() {
  console.log('🌱 Démarrage du seed des tenants de test...\n');

  try {
    // 1. Créer ou récupérer le pays (Bénin)
    console.log('1️⃣  Création/récupération du pays (Bénin)...');
    let country = await prisma.country.findUnique({
      where: { code: 'BJ' },
    });

    if (!country) {
      country = await prisma.country.create({
        data: {
          code: 'BJ',
          name: 'Bénin',
          code3: 'BEN',
          numericCode: '204',
          currencyCode: 'XOF',
          currencySymbol: 'CFA',
          phonePrefix: '+229',
          flagEmoji: '🇧🇯',
          isActive: true,
        },
      });
      console.log('   ✅ Pays créé:', country.name);
    } else {
      console.log('   ✅ Pays existant:', country.name);
    }

    // 2. Créer l'utilisateur PLATFORM_OWNER (sans tenantId)
    console.log('\n2️⃣  Création de l\'utilisateur PLATFORM_OWNER...');
    const platformOwnerPasswordHash = await bcrypt.hash(PLATFORM_OWNER.password, 10);
    
    let platformOwner = await prisma.user.findUnique({
      where: { email: PLATFORM_OWNER.email },
    });

    if (platformOwner) {
      platformOwner = await prisma.user.update({
        where: { id: platformOwner.id },
        data: {
          passwordHash: platformOwnerPasswordHash,
          firstName: PLATFORM_OWNER.firstName,
          lastName: PLATFORM_OWNER.lastName,
          isSuperAdmin: true,
          status: 'active',
          tenantId: null, // PLATFORM_OWNER n'a pas de tenant
        },
      });
      console.log('   ✅ Utilisateur PLATFORM_OWNER mis à jour');
    } else {
      platformOwner = await prisma.user.create({
        data: {
          email: PLATFORM_OWNER.email,
          passwordHash: platformOwnerPasswordHash,
          firstName: PLATFORM_OWNER.firstName,
          lastName: PLATFORM_OWNER.lastName,
          role: 'SUPER_DIRECTOR',
          isSuperAdmin: true,
          status: 'active',
          tenantId: null, // PLATFORM_OWNER n'a pas de tenant
        },
      });
      console.log('   ✅ Utilisateur PLATFORM_OWNER créé:', platformOwner.email);
    }

    const createdTenants = [];

    // 3. Créer chaque tenant
    for (const tenantData of TENANTS_DATA) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🏫 Création du tenant: ${tenantData.school.nameShort}`);
      console.log('='.repeat(60));

      // 3.1. Créer ou mettre à jour le tenant
      console.log(`\n3️⃣  Création/mise à jour du tenant...`);
      let tenant = await prisma.tenant.findUnique({
        where: { slug: tenantData.school.slug },
      });

      if (tenant) {
        tenant = await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            name: tenantData.school.nameShort,
            subdomain: tenantData.school.subdomain,
            countryId: country.id,
            status: 'active',
            subscriptionStatus: 'ACTIVE_SUBSCRIBED',
          },
        });
        console.log('   ✅ Tenant mis à jour');
      } else {
        tenant = await prisma.tenant.create({
          data: {
            name: tenantData.school.nameShort,
            slug: tenantData.school.slug,
            subdomain: tenantData.school.subdomain,
            countryId: country.id,
            type: 'SCHOOL',
            status: 'active',
            subscriptionStatus: 'ACTIVE_SUBSCRIBED',
            subscriptionPlan: 'premium',
          },
        });
        console.log('   ✅ Tenant créé:', tenant.name);
      }

      // 3.2. Créer ou mettre à jour l'école
      console.log(`\n4️⃣  Création/mise à jour de l'école...`);
      let school = await prisma.school.findUnique({
        where: { tenantId: tenant.id },
      });

      const schoolData = {
        name: tenantData.school.name,
        abbreviation: tenantData.school.nameShort.substring(0, 10),
        educationLevels: ['MATERNELLE', 'PRIMAIRE', 'SECONDAIRE'],
        address: tenantData.school.address,
        primaryPhone: tenantData.school.contact,
        primaryEmail: tenantData.school.email,
        primaryColor: '#3b82f6',
        secondaryColor: '#10b981',
      };

      if (school) {
        school = await prisma.school.update({
          where: { id: school.id },
          data: schoolData,
        });
        console.log('   ✅ École mise à jour');
      } else {
        school = await prisma.school.create({
          data: {
            ...schoolData,
            tenantId: tenant.id,
          },
        });
        console.log('   ✅ École créée:', school.name);
      }

      // 3.3. Créer les niveaux scolaires
      console.log(`\n5️⃣  Création des niveaux scolaires...`);
      const schoolLevels = [
        { code: 'MATERNELLE', name: 'Maternelle', label: 'Maternelle', order: 1 },
        { code: 'PRIMAIRE', name: 'Primaire', label: 'Primaire', order: 2 },
        { code: 'SECONDAIRE', name: 'Secondaire', label: 'Secondaire', order: 3 },
      ];

      for (const level of schoolLevels) {
        const existing = await prisma.schoolLevel.findFirst({
          where: {
            tenantId: tenant.id,
            code: level.code,
          },
        });

        if (!existing) {
          await prisma.schoolLevel.create({
            data: {
              ...level,
              tenantId: tenant.id,
            },
          });
          console.log(`   ✅ Niveau créé: ${level.name}`);
        } else {
          console.log(`   ✅ Niveau existant: ${level.name}`);
        }
      }

      // 3.4. Créer l'année scolaire active (2025-2026)
      console.log(`\n6️⃣  Création de l'année scolaire active (2025-2026)...`);
      const academicYearName = '2025-2026';
      
      let academicYear = await prisma.academicYear.findFirst({
        where: {
          tenantId: tenant.id,
          name: academicYearName,
        },
      });

      if (!academicYear) {
        const startDate = new Date('2025-09-01');
        const endDate = new Date('2026-07-31');
        const preEntryDate = new Date('2025-09-02');

        academicYear = await prisma.academicYear.create({
          data: {
            tenantId: tenant.id,
            name: academicYearName,
            label: `Année scolaire ${academicYearName}`,
            startDate: startDate,
            endDate: endDate,
            preEntryDate: preEntryDate,
            isActive: true,
            isAutoGenerated: false,
          },
        });
        console.log(`   ✅ Année scolaire créée: ${academicYear.label}`);
      } else {
        // S'assurer qu'elle est active
        if (!academicYear.isActive) {
          academicYear = await prisma.academicYear.update({
            where: { id: academicYear.id },
            data: { isActive: true },
          });
        }
        console.log(`   ✅ Année scolaire existante: ${academicYear.label}`);
      }

      // 3.5. Créer tous les utilisateurs
      console.log(`\n7️⃣  Création des utilisateurs...`);
      const createdUsers = [];

      // Promoteur
      const promoteur = await createOrUpdateUser(
        tenantData.users.promoteur.email,
        tenantData.users.promoteur.password,
        tenantData.users.promoteur.firstName,
        tenantData.users.promoteur.lastName,
        tenantData.users.promoteur.role,
        tenant.id,
        false,
      );
      createdUsers.push({ email: promoteur.email, role: 'Promoteur' });
      console.log(`   ✅ Promoteur: ${promoteur.email}`);

      // Directeur
      const directeur = await createOrUpdateUser(
        tenantData.users.directeur.email,
        tenantData.users.directeur.password,
        tenantData.users.directeur.firstName,
        tenantData.users.directeur.lastName,
        tenantData.users.directeur.role,
        tenant.id,
        false,
      );
      createdUsers.push({ email: directeur.email, role: 'Directeur' });
      console.log(`   ✅ Directeur: ${directeur.email}`);

      // Mettre à jour l'école avec le directeur
      if (school.directorPrimary !== directeur.id) {
        school = await prisma.school.update({
          where: { id: school.id },
          data: {
            directorPrimary: directeur.id,
          },
        });
      }

      // Secrétaire
      const secretaire = await createOrUpdateUser(
        tenantData.users.secretaire.email,
        tenantData.users.secretaire.password,
        tenantData.users.secretaire.firstName,
        tenantData.users.secretaire.lastName,
        tenantData.users.secretaire.role,
        tenant.id,
        false,
      );
      createdUsers.push({ email: secretaire.email, role: 'Secrétaire' });
      console.log(`   ✅ Secrétaire: ${secretaire.email}`);

      // Comptable
      const comptable = await createOrUpdateUser(
        tenantData.users.comptable.email,
        tenantData.users.comptable.password,
        tenantData.users.comptable.firstName,
        tenantData.users.comptable.lastName,
        tenantData.users.comptable.role,
        tenant.id,
        false,
      );
      createdUsers.push({ email: comptable.email, role: 'Comptable' });
      console.log(`   ✅ Comptable: ${comptable.email}`);

      // Secrétaire-Comptable
      const secretaireComptable = await createOrUpdateUser(
        tenantData.users.secretaireComptable.email,
        tenantData.users.secretaireComptable.password,
        tenantData.users.secretaireComptable.firstName,
        tenantData.users.secretaireComptable.lastName,
        tenantData.users.secretaireComptable.role,
        tenant.id,
        false,
      );
      createdUsers.push({ email: secretaireComptable.email, role: 'Secrétaire-Comptable' });
      console.log(`   ✅ Secrétaire-Comptable: ${secretaireComptable.email}`);

      // Censeur
      const censeur = await createOrUpdateUser(
        tenantData.users.censeur.email,
        tenantData.users.censeur.password,
        tenantData.users.censeur.firstName,
        tenantData.users.censeur.lastName,
        tenantData.users.censeur.role,
        tenant.id,
        false,
      );
      createdUsers.push({ email: censeur.email, role: 'Censeur' });
      console.log(`   ✅ Censeur: ${censeur.email}`);

      // Surveillant
      const surveillant = await createOrUpdateUser(
        tenantData.users.surveillant.email,
        tenantData.users.surveillant.password,
        tenantData.users.surveillant.firstName,
        tenantData.users.surveillant.lastName,
        tenantData.users.surveillant.role,
        tenant.id,
        false,
      );
      createdUsers.push({ email: surveillant.email, role: 'Surveillant' });
      console.log(`   ✅ Surveillant: ${surveillant.email}`);

      // Enseignants
      const enseignant1 = await createTeacher(
        tenantData.users.enseignant1.email,
        tenantData.users.enseignant1.password,
        tenantData.users.enseignant1.firstName,
        tenantData.users.enseignant1.lastName,
        tenantData.users.enseignant1.matricule!,
        tenant.id,
      );
      createdUsers.push({ email: enseignant1.email, role: 'Enseignant 1' });
      console.log(`   ✅ Enseignant 1: ${enseignant1.email} (${tenantData.users.enseignant1.matricule})`);

      const enseignant2 = await createTeacher(
        tenantData.users.enseignant2.email,
        tenantData.users.enseignant2.password,
        tenantData.users.enseignant2.firstName,
        tenantData.users.enseignant2.lastName,
        tenantData.users.enseignant2.matricule!,
        tenant.id,
      );
      createdUsers.push({ email: enseignant2.email, role: 'Enseignant 2' });
      console.log(`   ✅ Enseignant 2: ${enseignant2.email} (${tenantData.users.enseignant2.matricule})`);

      createdTenants.push({
        tenant,
        school,
        academicYear,
        users: createdUsers,
      });
    }

    // Résumé final
    console.log('\n' + '='.repeat(60));
    console.log('✅ SEED TERMINÉ AVEC SUCCÈS !');
    console.log('='.repeat(60));
    console.log('\n📊 Résumé :');
    console.log(`   • Pays: ${country.name}`);
    console.log(`   • PLATFORM_OWNER: ${platformOwner.email}`);
    console.log(`   • Nombre de tenants: ${createdTenants.length}\n`);

    for (const { tenant, school, academicYear, users } of createdTenants) {
      console.log(`\n🏫 ${tenant.name} (${tenant.slug})`);
      console.log(`   • École: ${school.name}`);
      console.log(`   • Ville: ${school.address}`);
      console.log(`   • Année scolaire: ${academicYear.label}`);
      console.log(`   • Utilisateurs: ${users.length}`);
      console.log(`   • Liste des utilisateurs:`);
      for (const user of users) {
        console.log(`     - ${user.role}: ${user.email}`);
      }
    }

    console.log('\n🔐 Identifiants PLATFORM_OWNER :');
    console.log(`   Email: ${PLATFORM_OWNER.email}`);
    console.log(`   Password: ${PLATFORM_OWNER.password}`);
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Erreur lors du seed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
