/**
 * ============================================================================
 * ORGANIGRAM PRISMA SERVICE
 * ============================================================================
 *
 * Service pour la gestion de l'organigramme de l'établissement.
 * Structure : Département → Service → Poste
 * Support multi-niveaux scolaires : Maternelle, Primaire, Secondaire, Complet
 *
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrganigramTreeNode {
  id: string;
  title: string;
  type: string;
  level: number;
  order: number;
  schoolLevelCode: string | null;
  staffId: string | null;
  metadata: any;
  isActive: boolean;
  staff?: {
    id: string;
    firstName: string;
    lastName: string;
    position: string | null;
    employeeNumber: string;
    phone: string | null;
    email: string | null;
  } | null;
  children: OrganigramTreeNode[];
}

// ─── Seed Template ────────────────────────────────────────────────────────────

/**
 * Template complet de l'organigramme scolaire.
 * Chaque entrée : [title, type, level, order, schoolLevelCode, metadata]
 *
 * Types : ROOT, DEPARTMENT, SERVICE, POSITION
 * schoolLevelCode : ALL | MAT | PRI | SEC | MAT_PRI
 */
const ORGANIGRAM_TEMPLATE: Array<{
  title: string;
  type: string;
  level: number;
  order: number;
  schoolLevelCode: string;
  children?: Array<{
    title: string;
    type: string;
    order: number;
    schoolLevelCode: string;
    children?: Array<{
      title: string;
      type: string;
      order: number;
      schoolLevelCode: string;
    }>;
  }>;
}> = [
  // ═══════════════════════════════════════════════════════════════════════
  // 1. GOUVERNANCE ET DIRECTION
  // ═══════════════════════════════════════════════════════════════════════
  {
    title: 'Gouvernance et Direction',
    type: 'DEPARTMENT',
    level: 1,
    order: 1,
    schoolLevelCode: 'ALL',
    children: [
      {
        title: 'Conseil d\'Administration',
        type: 'SERVICE',
        order: 1,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Président du Conseil', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Vice-président', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
          { title: 'Membre du Conseil', type: 'POSITION', order: 3, schoolLevelCode: 'ALL' },
        ],
      },
      {
        title: 'Direction Générale',
        type: 'SERVICE',
        order: 2,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Promoteur', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Directeur Général', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
          { title: 'Directeur Exécutif', type: 'POSITION', order: 3, schoolLevelCode: 'ALL' },
          { title: 'Conseiller de Direction', type: 'POSITION', order: 4, schoolLevelCode: 'ALL' },
          { title: 'Assistant de Direction', type: 'POSITION', order: 5, schoolLevelCode: 'ALL' },
          { title: 'Secrétaire de Direction', type: 'POSITION', order: 6, schoolLevelCode: 'ALL' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 2. DIRECTION PÉDAGOGIQUE
  // ═══════════════════════════════════════════════════════════════════════
  {
    title: 'Direction Pédagogique',
    type: 'DEPARTMENT',
    level: 1,
    order: 2,
    schoolLevelCode: 'ALL',
    children: [
      {
        title: 'Direction Académique',
        type: 'SERVICE',
        order: 1,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Directeur des Études', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Directeur Pédagogique', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
          { title: 'Coordinateur Académique', type: 'POSITION', order: 3, schoolLevelCode: 'ALL' },
        ],
      },
      {
        title: 'Maternelle',
        type: 'SERVICE',
        order: 2,
        schoolLevelCode: 'MAT',
        children: [
          { title: 'Responsable de la Maternelle', type: 'POSITION', order: 1, schoolLevelCode: 'MAT' },
          { title: 'Coordinateur Pédagogique Maternelle', type: 'POSITION', order: 2, schoolLevelCode: 'MAT' },
          { title: 'Enseignant(e) de Maternelle', type: 'POSITION', order: 3, schoolLevelCode: 'MAT' },
          { title: 'Assistant(e) de Classe', type: 'POSITION', order: 4, schoolLevelCode: 'MAT' },
          { title: 'Éducateur(trice) de Jeunes Enfants', type: 'POSITION', order: 5, schoolLevelCode: 'MAT' },
        ],
      },
      {
        title: 'Primaire',
        type: 'SERVICE',
        order: 3,
        schoolLevelCode: 'PRI',
        children: [
          { title: 'Responsable du Primaire', type: 'POSITION', order: 1, schoolLevelCode: 'PRI' },
          { title: 'Coordinateur Pédagogique Primaire', type: 'POSITION', order: 2, schoolLevelCode: 'PRI' },
          { title: 'Instituteur(trice)', type: 'POSITION', order: 3, schoolLevelCode: 'PRI' },
          { title: 'Enseignant Spécialisé', type: 'POSITION', order: 4, schoolLevelCode: 'PRI' },
        ],
      },
      {
        title: 'Secondaire',
        type: 'SERVICE',
        order: 4,
        schoolLevelCode: 'SEC',
        children: [
          { title: 'Responsable du Secondaire', type: 'POSITION', order: 1, schoolLevelCode: 'SEC' },
          { title: 'Censeur', type: 'POSITION', order: 2, schoolLevelCode: 'SEC' },
          { title: 'Surveillant Général', type: 'POSITION', order: 3, schoolLevelCode: 'SEC' },
          { title: 'Coordinateur des Filières', type: 'POSITION', order: 4, schoolLevelCode: 'SEC' },
          { title: 'Professeur', type: 'POSITION', order: 5, schoolLevelCode: 'SEC' },
          { title: 'Chef de Département Disciplinaire', type: 'POSITION', order: 6, schoolLevelCode: 'SEC' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 3. DÉPARTEMENTS DISCIPLINAIRES (SECONDAIRE)
  // ═══════════════════════════════════════════════════════════════════════
  {
    title: 'Départements Disciplinaires',
    type: 'DEPARTMENT',
    level: 1,
    order: 3,
    schoolLevelCode: 'SEC',
    children: [
      {
        title: 'Département Langues',
        type: 'SERVICE',
        order: 1,
        schoolLevelCode: 'SEC',
        children: [
          { title: 'Chef Département Français', type: 'POSITION', order: 1, schoolLevelCode: 'SEC' },
          { title: 'Professeur de Français', type: 'POSITION', order: 2, schoolLevelCode: 'SEC' },
          { title: 'Professeur d\'Anglais', type: 'POSITION', order: 3, schoolLevelCode: 'SEC' },
          { title: 'Professeur d\'Espagnol', type: 'POSITION', order: 4, schoolLevelCode: 'SEC' },
        ],
      },
      {
        title: 'Département Sciences',
        type: 'SERVICE',
        order: 2,
        schoolLevelCode: 'SEC',
        children: [
          { title: 'Chef Département Sciences', type: 'POSITION', order: 1, schoolLevelCode: 'SEC' },
          { title: 'Professeur de Mathématiques', type: 'POSITION', order: 2, schoolLevelCode: 'SEC' },
          { title: 'Professeur de Physique', type: 'POSITION', order: 3, schoolLevelCode: 'SEC' },
          { title: 'Professeur de Chimie', type: 'POSITION', order: 4, schoolLevelCode: 'SEC' },
          { title: 'Professeur de SVT', type: 'POSITION', order: 5, schoolLevelCode: 'SEC' },
        ],
      },
      {
        title: 'Département Sciences Humaines',
        type: 'SERVICE',
        order: 3,
        schoolLevelCode: 'SEC',
        children: [
          { title: 'Chef Département Sciences Humaines', type: 'POSITION', order: 1, schoolLevelCode: 'SEC' },
          { title: 'Professeur d\'Histoire', type: 'POSITION', order: 2, schoolLevelCode: 'SEC' },
          { title: 'Professeur de Géographie', type: 'POSITION', order: 3, schoolLevelCode: 'SEC' },
          { title: 'Professeur de Philosophie', type: 'POSITION', order: 4, schoolLevelCode: 'SEC' },
        ],
      },
      {
        title: 'Département TIC',
        type: 'SERVICE',
        order: 4,
        schoolLevelCode: 'SEC',
        children: [
          { title: 'Chef Département Informatique', type: 'POSITION', order: 1, schoolLevelCode: 'SEC' },
          { title: 'Professeur Informatique', type: 'POSITION', order: 2, schoolLevelCode: 'SEC' },
          { title: 'Laborantin Informatique', type: 'POSITION', order: 3, schoolLevelCode: 'SEC' },
        ],
      },
      {
        title: 'Département Arts et Sports',
        type: 'SERVICE',
        order: 5,
        schoolLevelCode: 'SEC',
        children: [
          { title: 'Professeur EPS', type: 'POSITION', order: 1, schoolLevelCode: 'SEC' },
          { title: 'Professeur Musique', type: 'POSITION', order: 2, schoolLevelCode: 'SEC' },
          { title: 'Professeur Arts Plastiques', type: 'POSITION', order: 3, schoolLevelCode: 'SEC' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 4. VIE SCOLAIRE ET DISCIPLINE
  // ═══════════════════════════════════════════════════════════════════════
  {
    title: 'Vie Scolaire et Discipline',
    type: 'DEPARTMENT',
    level: 1,
    order: 4,
    schoolLevelCode: 'ALL',
    children: [
      {
        title: 'Service Discipline',
        type: 'SERVICE',
        order: 1,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Surveillant Général', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Surveillant', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
          { title: 'Responsable Discipline', type: 'POSITION', order: 3, schoolLevelCode: 'ALL' },
        ],
      },
      {
        title: 'Service Orientation',
        type: 'SERVICE',
        order: 2,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Conseiller d\'Orientation', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Psychologue Scolaire', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
          { title: 'Coach Éducatif', type: 'POSITION', order: 3, schoolLevelCode: 'ALL' },
        ],
      },
      {
        title: 'Service Internat',
        type: 'SERVICE',
        order: 3,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Responsable Internat', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Éducateur', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
          { title: 'Maître d\'Internat', type: 'POSITION', order: 3, schoolLevelCode: 'ALL' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 5. ADMINISTRATION
  // ═══════════════════════════════════════════════════════════════════════
  {
    title: 'Administration',
    type: 'DEPARTMENT',
    level: 1,
    order: 5,
    schoolLevelCode: 'ALL',
    children: [
      {
        title: 'Secrétariat',
        type: 'SERVICE',
        order: 1,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Secrétaire Administratif', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Secrétaire Académique', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
          { title: 'Agent d\'Accueil', type: 'POSITION', order: 3, schoolLevelCode: 'ALL' },
        ],
      },
      {
        title: 'Archivage',
        type: 'SERVICE',
        order: 2,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Archiviste', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Gestionnaire de Documents', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
        ],
      },
      {
        title: 'Courrier',
        type: 'SERVICE',
        order: 3,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Agent de Courrier', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 6. DÉPARTEMENT FINANCIER ET COMPTABLE
  // ═══════════════════════════════════════════════════════════════════════
  {
    title: 'Département Financier et Comptable',
    type: 'DEPARTMENT',
    level: 1,
    order: 6,
    schoolLevelCode: 'ALL',
    children: [
      {
        title: 'Comptabilité',
        type: 'SERVICE',
        order: 1,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Directeur Financier', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Comptable', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
          { title: 'Comptable Matières', type: 'POSITION', order: 3, schoolLevelCode: 'ALL' },
          { title: 'Aide-Comptable', type: 'POSITION', order: 4, schoolLevelCode: 'ALL' },
        ],
      },
      {
        title: 'Trésorerie',
        type: 'SERVICE',
        order: 2,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Trésorier', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Caissier', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
        ],
      },
      {
        title: 'Recouvrement',
        type: 'SERVICE',
        order: 3,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Responsable Recouvrement', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Agent de Recouvrement', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
        ],
      },
      {
        title: 'Contrôle de Gestion',
        type: 'SERVICE',
        order: 4,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Contrôleur de Gestion', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Auditeur Interne', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 7. RESSOURCES HUMAINES
  // ═══════════════════════════════════════════════════════════════════════
  {
    title: 'Ressources Humaines',
    type: 'DEPARTMENT',
    level: 1,
    order: 7,
    schoolLevelCode: 'ALL',
    children: [
      {
        title: 'RH',
        type: 'SERVICE',
        order: 1,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Responsable RH', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Gestionnaire RH', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
          { title: 'Chargé Recrutement', type: 'POSITION', order: 3, schoolLevelCode: 'ALL' },
          { title: 'Chargé Formation', type: 'POSITION', order: 4, schoolLevelCode: 'ALL' },
        ],
      },
      {
        title: 'Paie',
        type: 'SERVICE',
        order: 2,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Gestionnaire Paie', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 8. INFORMATIQUE ET TRANSFORMATION DIGITALE
  // ═══════════════════════════════════════════════════════════════════════
  {
    title: 'Informatique et Transformation Digitale',
    type: 'DEPARTMENT',
    level: 1,
    order: 8,
    schoolLevelCode: 'ALL',
    children: [
      {
        title: 'Système d\'Information',
        type: 'SERVICE',
        order: 1,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'DSI', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Responsable Informatique', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
          { title: 'Administrateur Réseau', type: 'POSITION', order: 3, schoolLevelCode: 'ALL' },
          { title: 'Administrateur Système', type: 'POSITION', order: 4, schoolLevelCode: 'ALL' },
        ],
      },
      {
        title: 'Support Technique',
        type: 'SERVICE',
        order: 2,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Technicien Informatique', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Helpdesk', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
        ],
      },
      {
        title: 'Développement',
        type: 'SERVICE',
        order: 3,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Développeur Web', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Développeur Mobile', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
          { title: 'Administrateur Academia Helm', type: 'POSITION', order: 3, schoolLevelCode: 'ALL' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 9. COMMUNICATION ET MARKETING
  // ═══════════════════════════════════════════════════════════════════════
  {
    title: 'Communication et Marketing',
    type: 'DEPARTMENT',
    level: 1,
    order: 9,
    schoolLevelCode: 'ALL',
    children: [
      {
        title: 'Communication',
        type: 'SERVICE',
        order: 1,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Responsable Communication', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Community Manager', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
          { title: 'Chargé Relations Publiques', type: 'POSITION', order: 3, schoolLevelCode: 'ALL' },
        ],
      },
      {
        title: 'Marketing',
        type: 'SERVICE',
        order: 2,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Responsable Marketing', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Chargé Marketing Digital', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
        ],
      },
      {
        title: 'Admissions',
        type: 'SERVICE',
        order: 3,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Responsable Admissions', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Agent d\'Inscription', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 10. SANTÉ ET BIEN-ÊTRE
  // ═══════════════════════════════════════════════════════════════════════
  {
    title: 'Santé et Bien-être',
    type: 'DEPARTMENT',
    level: 1,
    order: 10,
    schoolLevelCode: 'ALL',
    children: [
      {
        title: 'Infirmerie',
        type: 'SERVICE',
        order: 1,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Infirmier(ère)', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Médecin Scolaire', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
        ],
      },
      {
        title: 'Assistance Sociale',
        type: 'SERVICE',
        order: 2,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Assistant Social', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 11. BIBLIOTHÈQUE ET DOCUMENTATION
  // ═══════════════════════════════════════════════════════════════════════
  {
    title: 'Bibliothèque et Documentation',
    type: 'DEPARTMENT',
    level: 1,
    order: 11,
    schoolLevelCode: 'ALL',
    children: [
      {
        title: 'Centre de Documentation',
        type: 'SERVICE',
        order: 1,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Bibliothécaire', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Documentaliste', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
          { title: 'Archiviste Numérique', type: 'POSITION', order: 3, schoolLevelCode: 'ALL' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 12. LABORATOIRES
  // ═══════════════════════════════════════════════════════════════════════
  {
    title: 'Laboratoires',
    type: 'DEPARTMENT',
    level: 1,
    order: 12,
    schoolLevelCode: 'SEC',
    children: [
      {
        title: 'Laboratoire Scientifique',
        type: 'SERVICE',
        order: 1,
        schoolLevelCode: 'SEC',
        children: [
          { title: 'Responsable Laboratoire', type: 'POSITION', order: 1, schoolLevelCode: 'SEC' },
          { title: 'Laborantin', type: 'POSITION', order: 2, schoolLevelCode: 'SEC' },
        ],
      },
      {
        title: 'Laboratoire Informatique',
        type: 'SERVICE',
        order: 2,
        schoolLevelCode: 'SEC',
        children: [
          { title: 'Responsable Salle Informatique', type: 'POSITION', order: 1, schoolLevelCode: 'SEC' },
          { title: 'Technicien Informatique', type: 'POSITION', order: 2, schoolLevelCode: 'SEC' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 13. TRANSPORT SCOLAIRE
  // ═══════════════════════════════════════════════════════════════════════
  {
    title: 'Transport Scolaire',
    type: 'DEPARTMENT',
    level: 1,
    order: 13,
    schoolLevelCode: 'ALL',
    children: [
      {
        title: 'Service Transport',
        type: 'SERVICE',
        order: 1,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Responsable Transport', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Chauffeur', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
          { title: 'Convoyeur', type: 'POSITION', order: 3, schoolLevelCode: 'ALL' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 14. RESTAURATION
  // ═══════════════════════════════════════════════════════════════════════
  {
    title: 'Restauration',
    type: 'DEPARTMENT',
    level: 1,
    order: 14,
    schoolLevelCode: 'ALL',
    children: [
      {
        title: 'Cantine',
        type: 'SERVICE',
        order: 1,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Responsable Cantine', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Cuisinier', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
          { title: 'Aide-Cuisinier', type: 'POSITION', order: 3, schoolLevelCode: 'ALL' },
          { title: 'Serveur', type: 'POSITION', order: 4, schoolLevelCode: 'ALL' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 15. PATRIMOINE ET MAINTENANCE
  // ═══════════════════════════════════════════════════════════════════════
  {
    title: 'Patrimoine et Maintenance',
    type: 'DEPARTMENT',
    level: 1,
    order: 15,
    schoolLevelCode: 'ALL',
    children: [
      {
        title: 'Maintenance',
        type: 'SERVICE',
        order: 1,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Responsable Maintenance', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Électricien', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
          { title: 'Plombier', type: 'POSITION', order: 3, schoolLevelCode: 'ALL' },
          { title: 'Technicien Maintenance', type: 'POSITION', order: 4, schoolLevelCode: 'ALL' },
        ],
      },
      {
        title: 'Bâtiments',
        type: 'SERVICE',
        order: 2,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Gestionnaire Immobilier', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 16. SÉCURITÉ
  // ═══════════════════════════════════════════════════════════════════════
  {
    title: 'Sécurité',
    type: 'DEPARTMENT',
    level: 1,
    order: 16,
    schoolLevelCode: 'ALL',
    children: [
      {
        title: 'Sécurité',
        type: 'SERVICE',
        order: 1,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Chef Sécurité', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Agent de Sécurité', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
          { title: 'Gardien de Nuit', type: 'POSITION', order: 3, schoolLevelCode: 'ALL' },
        ],
      },
      {
        title: 'Contrôle d\'Accès',
        type: 'SERVICE',
        order: 2,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Agent de Contrôle', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 17. ENTRETIEN ET HYGIÈNE
  // ═══════════════════════════════════════════════════════════════════════
  {
    title: 'Entretien et Hygiène',
    type: 'DEPARTMENT',
    level: 1,
    order: 17,
    schoolLevelCode: 'ALL',
    children: [
      {
        title: 'Entretien',
        type: 'SERVICE',
        order: 1,
        schoolLevelCode: 'ALL',
        children: [
          { title: 'Responsable Entretien', type: 'POSITION', order: 1, schoolLevelCode: 'ALL' },
          { title: 'Agent d\'Entretien', type: 'POSITION', order: 2, schoolLevelCode: 'ALL' },
          { title: 'Femme de Ménage', type: 'POSITION', order: 3, schoolLevelCode: 'ALL' },
          { title: 'Jardinier', type: 'POSITION', order: 4, schoolLevelCode: 'ALL' },
        ],
      },
    ],
  },
];

// ─── Color palette for departments ────────────────────────────────────────────

const DEPARTMENT_COLORS: Record<string, string> = {
  'Gouvernance et Direction': '#1A2BA6',
  'Direction Pédagogique': '#7C3AED',
  'Départements Disciplinaires': '#2563EB',
  'Vie Scolaire et Discipline': '#DC2626',
  'Administration': '#0891B2',
  'Département Financier et Comptable': '#059669',
  'Ressources Humaines': '#D97706',
  'Informatique et Transformation Digitale': '#4F46E5',
  'Communication et Marketing': '#E11D48',
  'Santé et Bien-être': '#16A34A',
  'Bibliothèque et Documentation': '#7C3AED',
  'Laboratoires': '#2563EB',
  'Transport Scolaire': '#CA8A04',
  'Restauration': '#EA580C',
  'Patrimoine et Maintenance': '#65A30D',
  'Sécurité': '#991B1B',
  'Entretien et Hygiène': '#0D9488',
};

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class OrganigramPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Seed ─────────────────────────────────────────────────────────────────

  /**
   * Initialise l'organigramme par défaut pour un tenant.
   * Ne fait rien si des nœuds existent déjà.
   */
  async seedOrganigram(tenantId: string): Promise<{ created: number }> {
    const existing = await this.prisma.organigramNode.count({
      where: { tenantId },
    });
    if (existing > 0) {
      return { created: 0 };
    }

    // Créer le nœud racine (l'établissement)
    const root = await this.prisma.organigramNode.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        title: 'Établissement',
        type: 'ROOT',
        level: 0,
        order: 0,
        schoolLevelCode: 'ALL',
        metadata: { color: '#1A2BA6', icon: 'building' },
      },
    });

    let created = 1;

    for (const dept of ORGANIGRAM_TEMPLATE) {
      const deptColor = DEPARTMENT_COLORS[dept.title] || '#64748B';
      const deptNode = await this.prisma.organigramNode.create({
        data: {
          ...prismaCreateDefaults(),
          tenantId,
          title: dept.title,
          type: dept.type,
          level: dept.level,
          order: dept.order,
          schoolLevelCode: dept.schoolLevelCode,
          parentId: root.id,
          metadata: { color: deptColor, icon: 'department' },
        },
      });
      created++;

      if (dept.children) {
        for (const service of dept.children) {
          const serviceNode = await this.prisma.organigramNode.create({
            data: {
              ...prismaCreateDefaults(),
              tenantId,
              title: service.title,
              type: service.type,
              level: dept.level + 1,
              order: service.order,
              schoolLevelCode: service.schoolLevelCode,
              parentId: deptNode.id,
              metadata: { color: deptColor, icon: 'service' },
            },
          });
          created++;

          if (service.children) {
            for (const position of service.children) {
              await this.prisma.organigramNode.create({
                data: {
                  ...prismaCreateDefaults(),
                  tenantId,
                  title: position.title,
                  type: position.type,
                  level: dept.level + 2,
                  order: position.order,
                  schoolLevelCode: position.schoolLevelCode,
                  parentId: serviceNode.id,
                  metadata: { color: deptColor, icon: 'position' },
                },
              });
              created++;
            }
          }
        }
      }
    }

    return { created };
  }

  // ─── Read ─────────────────────────────────────────────────────────────────

  /**
   * Récupère l'organigramme complet sous forme d'arbre.
   * Option : filtrer par niveau scolaire.
   */
  async getOrganigramTree(tenantId: string, schoolLevelCode?: string): Promise<OrganigramTreeNode[]> {
    const where: any = { tenantId, isActive: true };
    if (schoolLevelCode && schoolLevelCode !== 'ALL') {
      // Inclure les nœuds du niveau demandé + les nœuds ALL (communs à tous les niveaux)
      where.OR = [
        { schoolLevelCode: 'ALL' },
        { schoolLevelCode },
      ];
    }

    const nodes = await this.prisma.organigramNode.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
            employeeNumber: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: [{ level: 'asc' }, { order: 'asc' }],
    });

    // Construire l'arbre
    return this.buildTree(nodes);
  }

  /**
   * Récupère tous les nœuds (flat) avec pagination optionnelle.
   */
  async getAllNodes(tenantId: string, filters?: {
    type?: string;
    schoolLevelCode?: string;
    isActive?: boolean;
  }) {
    const where: any = { tenantId };
    if (filters?.type) where.type = filters.type;
    if (filters?.schoolLevelCode && filters.schoolLevelCode !== 'ALL') {
      where.OR = [
        { schoolLevelCode: 'ALL' },
        { schoolLevelCode: filters.schoolLevelCode },
      ];
    }
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;

    return this.prisma.organigramNode.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
            employeeNumber: true,
          },
        },
        children: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: [{ level: 'asc' }, { order: 'asc' }],
    });
  }

  /**
   * Récupère un nœud par ID.
   */
  async getNodeById(id: string, tenantId: string) {
    const node = await this.prisma.organigramNode.findFirst({
      where: { id, tenantId },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
            employeeNumber: true,
            phone: true,
            email: true,
          },
        },
        children: {
          orderBy: { order: 'asc' },
          include: {
            staff: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                position: true,
                employeeNumber: true,
              },
            },
          },
        },
        parent: {
          select: { id: true, title: true, type: true },
        },
      },
    });
    if (!node) throw new NotFoundException(`Nœud ${id} introuvable`);
    return node;
  }

  // ─── Create ───────────────────────────────────────────────────────────────

  /**
   * Crée un nouveau nœud dans l'organigramme.
   */
  async createNode(data: {
    tenantId: string;
    title: string;
    type: string;
    level?: number;
    order?: number;
    schoolLevelCode?: string;
    staffId?: string;
    parentId?: string;
    metadata?: any;
  }) {
    // Valider le parent si fourni
    if (data.parentId) {
      const parent = await this.prisma.organigramNode.findFirst({
        where: { id: data.parentId, tenantId: data.tenantId },
      });
      if (!parent) throw new BadRequestException('Parent introuvable');
    }

    // Valider le staff si fourni
    if (data.staffId) {
      const staff = await this.prisma.staff.findFirst({
        where: { id: data.staffId, tenantId: data.tenantId },
      });
      if (!staff) throw new BadRequestException('Employé introuvable');
    }

    // Calculer le level automatiquement si parent fourni
    let level = data.level ?? 0;
    if (data.parentId) {
      const parent = await this.prisma.organigramNode.findFirst({
        where: { id: data.parentId, tenantId: data.tenantId },
      });
      if (parent) level = parent.level + 1;
    }

    // Calculer l'ordre automatiquement si non fourni
    let order = data.order ?? 0;
    if (!data.order && data.order !== 0) {
      const siblingCount = await this.prisma.organigramNode.count({
        where: { parentId: data.parentId ?? null, tenantId: data.tenantId },
      });
      order = siblingCount;
    }

    return this.prisma.organigramNode.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId: data.tenantId,
        title: data.title,
        type: data.type,
        level,
        order,
        schoolLevelCode: data.schoolLevelCode ?? 'ALL',
        staffId: data.staffId ?? null,
        parentId: data.parentId ?? null,
        metadata: data.metadata ?? null,
      },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
            employeeNumber: true,
          },
        },
      },
    });
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  /**
   * Met à jour un nœud de l'organigramme.
   */
  async updateNode(id: string, tenantId: string, data: {
    title?: string;
    type?: string;
    level?: number;
    order?: number;
    schoolLevelCode?: string;
    staffId?: string | null;
    parentId?: string | null;
    metadata?: any;
    isActive?: boolean;
  }) {
    await this.getNodeById(id, tenantId);

    const updateData: any = { ...prismaUpdateDefaults() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.level !== undefined) updateData.level = data.level;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.schoolLevelCode !== undefined) updateData.schoolLevelCode = data.schoolLevelCode;
    if (data.staffId !== undefined) updateData.staffId = data.staffId;
    if (data.parentId !== undefined) updateData.parentId = data.parentId;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return this.prisma.organigramNode.update({
      where: { id },
      data: updateData,
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
            employeeNumber: true,
          },
        },
      },
    });
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  /**
   * Supprime un nœud (et tous ses enfants en cascade).
   */
  async deleteNode(id: string, tenantId: string) {
    await this.getNodeById(id, tenantId);

    // La suppression en cascade est gérée par Prisma (onDelete: Cascade sur parentId)
    return this.prisma.organigramNode.delete({
      where: { id },
    });
  }

  // ─── Assign Staff ─────────────────────────────────────────────────────────

  /**
   * Assigne un employé à un poste de l'organigramme.
   */
  async assignStaff(nodeId: string, tenantId: string, staffId: string | null) {
    await this.getNodeById(nodeId, tenantId);

    if (staffId) {
      const staff = await this.prisma.staff.findFirst({
        where: { id: staffId, tenantId },
      });
      if (!staff) throw new BadRequestException('Employé introuvable');
    }

    return this.prisma.organigramNode.update({
      where: { id: nodeId },
      data: {
        ...prismaUpdateDefaults(),
        staffId,
      },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
            employeeNumber: true,
          },
        },
      },
    });
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  /**
   * Statistiques de l'organigramme.
   */
  async getOrganigramStats(tenantId: string) {
    const [totalNodes, departments, services, positions, assignedPositions, activeStaff] =
      await Promise.all([
        this.prisma.organigramNode.count({ where: { tenantId, isActive: true } }),
        this.prisma.organigramNode.count({ where: { tenantId, type: 'DEPARTMENT', isActive: true } }),
        this.prisma.organigramNode.count({ where: { tenantId, type: 'SERVICE', isActive: true } }),
        this.prisma.organigramNode.count({ where: { tenantId, type: 'POSITION', isActive: true } }),
        this.prisma.organigramNode.count({ where: { tenantId, type: 'POSITION', staffId: { not: null }, isActive: true } }),
        this.prisma.organigramNode.count({ where: { tenantId, staffId: { not: null }, isActive: true } }),
      ]);

    return {
      totalNodes,
      departments,
      services,
      positions,
      assignedPositions,
      unassignedPositions: positions - assignedPositions,
      occupancyRate: positions > 0 ? Math.round((assignedPositions / positions) * 100) : 0,
    };
  }

  // ─── Reorder ──────────────────────────────────────────────────────────────

  /**
   * Réordonne les nœuds d'un même parent.
   */
  async reorderNodes(tenantId: string, nodeIds: string[]) {
    return this.prisma.$transaction(
      nodeIds.map((id, index) =>
        this.prisma.organigramNode.update({
          where: { id },
          data: { ...prismaUpdateDefaults(), order: index },
        }),
      ),
    );
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private buildTree(nodes: any[]): OrganigramTreeNode[] {
    const map = new Map<string, OrganigramTreeNode>();
    const roots: OrganigramTreeNode[] = [];

    // Premier passage : créer tous les nœuds
    for (const node of nodes) {
      map.set(node.id, {
        id: node.id,
        title: node.title,
        type: node.type,
        level: node.level,
        order: node.order,
        schoolLevelCode: node.schoolLevelCode,
        staffId: node.staffId,
        metadata: node.metadata,
        isActive: node.isActive,
        staff: node.staff
          ? {
              id: node.staff.id,
              firstName: node.staff.firstName,
              lastName: node.staff.lastName,
              position: node.staff.position,
              employeeNumber: node.staff.employeeNumber,
              phone: node.staff.phone,
              email: node.staff.email,
            }
          : null,
        children: [],
      });
    }

    // Deuxième passage : construire la hiérarchie
    for (const node of nodes) {
      const treeNode = map.get(node.id)!;
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(treeNode);
      } else if (!node.parentId) {
        roots.push(treeNode);
      }
    }

    // Trier les enfants par order
    const sortChildren = (nodes: OrganigramTreeNode[]) => {
      nodes.sort((a, b) => a.order - b.order);
      for (const node of nodes) {
        sortChildren(node.children);
      }
    };
    sortChildren(roots);

    return roots;
  }
}
