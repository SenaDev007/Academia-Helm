/**
 * ============================================================================
 * PRISMA SEED - BIBLIOTHÈQUE PÉDAGOGIQUE GLOBALE
 * ============================================================================
 * 
 * Script de seed pour alimenter la bibliothèque virtuelle avec des ressources
 * institutionnelles de test.
 * 
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Charger les variables d'environnement
dotenv.config({ path: resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Démarrage du seed de la Bibliothèque Virtuelle...\n');

  // 1. Récupérer le Platform Owner pour marquer le créateur
  const platformOwner = await prisma.user.findFirst({
    where: { role: 'PLATFORM_OWNER' }
  });

  if (!platformOwner) {
    console.error('❌ Erreur: PLATFORM_OWNER non trouvé. Lancez d''abord le seed principal.');
    process.exit(1);
  }

  // 2. Définition des ressources à créer
  const resources = [
    {
      title: "Guide de Didactique des Mathématiques - CI/CP",
      description: "Méthodologie complète pour l'enseignement des bases du calcul et de la numération au cycle préparatoire.",
      level: "PRIMAIRE",
      classLevel: "CI/CP",
      subject: "Mathématiques",
      language: "FR",
      resourceType: "PDF",
      fileUrl: "https://academia-helm-assets.s3.amazonaws.com/pedagogy/guides/math-ci-cp.pdf",
      isPublished: true,
    },
    {
      title: "Recueil de Textes Littéraires Béninois - 3ème",
      description: "Sélection d'extraits d'auteurs béninois conformes au programme national pour la préparation au BEPC.",
      level: "SECONDAIRE",
      classLevel: "3ème",
      series: "TOUTES",
      subject: "Français",
      language: "FR",
      resourceType: "PDF",
      fileUrl: "https://academia-helm-assets.s3.amazonaws.com/pedagogy/collections/litterature-benin-3eme.pdf",
      isPublished: true,
    },
    {
      title: "Expériences Scientifiques Amusantes - Physique-Chimie",
      description: "Série de vidéos montrant des expériences réalisables avec du matériel local pour illustrer les cours de science.",
      level: "SECONDAIRE",
      classLevel: "4ème/3ème",
      subject: "Physique-Chimie",
      language: "FR",
      resourceType: "VIDEO",
      fileUrl: "https://academia-helm-assets.s3.amazonaws.com/pedagogy/videos/science-exp-4-3.mp4",
      isPublished: true,
    },
    {
      title: "English Pronunciation Guide for Primary School",
      description: "Audio lessons focusing on common pronunciation challenges for francophone students.",
      level: "PRIMAIRE",
      classLevel: "CM1/CM2",
      subject: "Anglais",
      language: "EN",
      resourceType: "AUDIO",
      fileUrl: "https://academia-helm-assets.s3.amazonaws.com/pedagogy/audio/english-pronunciation.mp3",
      isPublished: true,
    },
    {
      title: "Ressources Numériques Khan Academy - SVT",
      description: "Lien vers le portail Khan Academy pour les ressources interactives en SVT.",
      level: "SECONDAIRE",
      classLevel: "2nde/1ère/Tle",
      subject: "SVT",
      language: "FR",
      resourceType: "LINK",
      externalUrl: "https://fr.khanacademy.org/science/biology",
      isPublished: true,
    }
  ];

  console.log(`📚 Création de ${resources.length} ressources globales...`);

  for (const resData of resources) {
    const { fileUrl, externalUrl, ...baseData } = resData;
    
    const resource = await prisma.globalPedagogicalResource.upsert({
      where: { title: resData.title },
      update: { ...baseData, fileUrl, externalUrl },
      create: {
        ...baseData,
        fileUrl,
        externalUrl,
        createdBy: platformOwner.id,
        version: 1
      },
    });

    // Créer la version 1 si elle n'existe pas
    if (fileUrl || externalUrl) {
      await prisma.globalResourceVersion.upsert({
        where: {
          resourceId_version: {
            resourceId: resource.id,
            version: 1
          }
        },
        update: {},
        create: {
          resourceId: resource.id,
          version: 1,
          fileUrl: fileUrl || externalUrl || '',
        }
      });
    }

    console.log(`   ✅ Ressource assurée: ${resource.title} (${resource.resourceType})`);
  }

  // 3. Simuler quelques usages si possible (CSPEB)
  const cspeb = await prisma.tenant.findUnique({ where: { slug: 'cspeb-eveil-afrique' } });
  if (cspeb) {
    const teacher = await prisma.staff.findFirst({
      where: { tenantId: cspeb.id, category: 'PEDAGOGICAL' }
    });

    if (teacher) {
      console.log(`\n📊 Simulation d'usage pour le tenant CSPEB...`);
      const firstRes = await prisma.globalPedagogicalResource.findFirst();
      if (firstRes) {
        await prisma.tenantResourceUsage.create({
          data: {
            tenantId: cspeb.id,
            resourceId: firstRes.id,
            staffId: teacher.id
          }
        });
        
        await prisma.tenantResourceAnnotation.create({
          data: {
            tenantId: cspeb.id,
            resourceId: firstRes.id,
            staffId: teacher.id,
            note: "Excellent support pour ma séance sur la numération demain. À utiliser en complément du manuel habituel."
          }
        });
        console.log(`   ✅ Usage et annotation simulés pour: ${teacher.firstName} ${teacher.lastName}`);
      }
    }
  }

  console.log('\n✅ Seed de la Bibliothèque terminé avec succès !');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
