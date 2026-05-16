import { PrismaClient } from '@prisma/client';

export async function seedCommunication(prisma: PrismaClient, tenantId: string) {
  console.log('🌱 Seeding Communication module for tenant:', tenantId);

  // 1. Create Communication Templates
  const templates = [
    {
      name: 'Rappel de Paiement Scolarité',
      code: 'TUITION_REMINDER',
      category: 'FINANCIAL',
      channel: 'EMAIL',
      subjectFr: 'Rappel de paiement - Scolarité',
      bodyFr: 'Bonjour {{parentName}}, nous vous rappelons que la prochaine tranche de scolarité pour {{studentName}} est due le {{dueDate}}.',
      bodyEn: 'Dear {{parentName}}, this is a reminder that the next tuition installment for {{studentName}} is due on {{dueDate}}.',
      variables: ['parentName', 'studentName', 'dueDate']
    },
    {
      name: 'Annonce Urgente Ecole',
      code: 'URGENT_ANNOUNCEMENT',
      category: 'ACADEMIC',
      channel: 'SMS',
      bodyFr: 'URGENT: {{message}}',
      bodyEn: 'URGENT: {{message}}',
      variables: ['message']
    },
    {
      name: 'Félicitations Bulletin',
      code: 'BULLETIN_CONGRATS',
      category: 'ACADEMIC',
      channel: 'WHATSAPP',
      bodyFr: 'Félicitations! Le bulletin de {{studentName}} est disponible sur le portail.',
      bodyEn: 'Congratulations! {{studentName}}\'s report card is available on the portal.',
      variables: ['studentName']
    },
    {
      name: 'Confirmation Inscription',
      code: 'ADMISSION_CONFIRMED',
      category: 'ADMINISTRATIVE',
      channel: 'EMAIL',
      subjectFr: 'Confirmation d\'inscription - {{studentName}}',
      bodyFr: 'Bonjour {{parentName}}, l\'inscription de {{studentName}} pour l\'année scolaire {{academicYear}} a été validée avec succès.',
      bodyEn: 'Dear {{parentName}}, the admission of {{studentName}} for the academic year {{academicYear}} has been successfully validated.',
      variables: ['parentName', 'studentName', 'academicYear']
    },
    {
      name: 'Avis de Réunion',
      code: 'MEETING_NOTICE',
      category: 'ADMINISTRATIVE',
      channel: 'WHATSAPP',
      bodyFr: 'Cher parent, vous êtes convié à la réunion de {{meetingType}} qui se tiendra le {{meetingDate}} à {{meetingTime}}.',
      bodyEn: 'Dear parent, you are invited to the {{meetingType}} meeting on {{meetingDate}} at {{meetingTime}}.',
      variables: ['meetingType', 'meetingDate', 'meetingTime']
    },
    {
      name: 'Absence Signalée',
      code: 'ABSENCE_NOTIFICATION',
      category: 'ACADEMIC',
      channel: 'SMS',
      bodyFr: 'Avis d\'absence: {{studentName}} a été absent(e) au cours de {{subject}} le {{date}}.',
      bodyEn: 'Absence notice: {{studentName}} was absent for {{subject}} on {{date}}.',
      variables: ['studentName', 'subject', 'date']
    },
    {
      name: 'Rappel Examen',
      code: 'EXAM_REMINDER',
      category: 'ACADEMIC',
      channel: 'EMAIL',
      subjectFr: 'Calendrier des examens - {{studentName}}',
      bodyFr: 'Bonjour, nous vous informons que les examens de {{period}} débuteront le {{startDate}}.',
      bodyEn: 'Hello, we inform you that the exams for {{period}} will start on {{startDate}}.',
      variables: ['studentName', 'period', 'startDate']
    }
  ];

  for (const t of templates) {
    await prisma.communicationTemplate.upsert({
      where: { 
        tenantId_code: { tenantId, code: t.code } 
      },
      update: {
        ...t,
        updatedAt: new Date()
      } as any,
      create: { 
        ...t, 
        tenantId,
        status: 'ACTIVE'
      } as any
    });
  }

  // 2. Create some initial announcements
  const defaultAdmin = await prisma.user.findFirst({
    where: { 
      tenantId,
      role: { in: ['DIRECTEUR', 'PLATFORM_OWNER', 'ADMIN'] }
    }
  });

  if (defaultAdmin) {
    const announcementExists = await prisma.announcement.findFirst({
      where: { 
        tenantId,
        titleFr: 'Bienvenue sur Academia Helm v2'
      }
    });

    if (!announcementExists) {
      await prisma.announcement.create({
        data: {
          tenantId,
          titleFr: 'Bienvenue sur Academia Helm v2',
          titleEn: 'Welcome to Academia Helm v2',
          bodyFr: 'Nous sommes ravis de vous présenter notre nouveau module de communication multicanal.',
          bodyEn: 'We are excited to present our new multi-channel communication module.',
          category: 'GENERAL',
          status: 'PUBLISHED',
          priority: 'NORMAL',
          publishedAt: new Date(),
          audience: { all: true },
          createdById: defaultAdmin.id
        }
      });
    }
  }

  console.log('✅ Communication module seeded successfully.');
}

