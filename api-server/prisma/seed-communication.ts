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
  console.log('🌱 Démarrage du seed Communication Templates...');

  const tenantSlug = 'cspeb-eveil-afrique';
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });

  if (!tenant) {
    console.error(`❌ Tenant avec le slug "${tenantSlug}" non trouvé.`);
    return;
  }

  const templates = [
    {
      name: 'Confirmation d\'absence',
      code: 'ABSENCE_CONFIRMATION',
      category: 'ATTENDANCE',
      channel: 'SMS',
      subjectFr: 'Absence de votre enfant',
      bodyFr: 'Cher parent, nous vous informons que votre enfant {{student_name}} est absent ce jour {{date}}. Veuillez contacter la vie scolaire.',
      variables: { student_name: 'Nom de l\'élève', date: 'Date de l\'absence' },
    },
    {
      name: 'Rappel de paiement',
      code: 'PAYMENT_REMINDER',
      category: 'FINANCE',
      channel: 'EMAIL',
      subjectFr: 'Rappel : Échéance de scolarité - {{school_name}}',
      bodyFr: 'Cher parent,\n\nNous vous informons qu\'une échéance de scolarité pour {{student_name}} arrive à terme le {{due_date}}. Le montant restant est de {{amount}} CFA.\n\nCordialement,\nLa Comptabilité.',
      variables: { student_name: 'Nom de l\'élève', due_date: 'Date d\'échéance', amount: 'Montant', school_name: 'Nom de l\'école' },
    },
    {
      name: 'Bienvenue Academia Helm',
      code: 'WELCOME_EMAIL',
      category: 'GENERAL',
      channel: 'EMAIL',
      subjectFr: 'Bienvenue sur votre portail Academia Helm',
      bodyFr: 'Bienvenue {{user_name}} !\n\nVotre compte a été créé avec succès. Vous pouvez désormais accéder à vos notes, absences et actualités de l\'école {{school_name}}.\n\nVos identifiants :\nLogin : {{login}}\n\nCordialement.',
      variables: { user_name: 'Nom utilisateur', school_name: 'Nom de l\'école', login: 'Identifiant' },
    },
    {
      name: 'Alerte Examen',
      code: 'EXAM_ALERT',
      category: 'EXAM',
      channel: 'PORTAL',
      subjectFr: 'Prochain examen : {{exam_name}}',
      bodyFr: 'N\'oubliez pas votre examen de {{subject}} prévu le {{date}} en salle {{room}}.',
      variables: { exam_name: 'Nom de l\'examen', subject: 'Matière', date: 'Date', room: 'Salle' },
    }
  ];

  for (const t of templates) {
    await prisma.communicationTemplate.upsert({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: t.code,
        },
      },
      update: t as any,
      create: {
        ...t,
        tenantId: tenant.id,
        bodyEn: '',
      } as any,
    });
    console.log(`   ✅ Template "${t.name}" (${t.code}) synchronisé.`);
  }

  console.log('\n✨ Seed Communication terminé !');
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
