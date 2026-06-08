import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Templates officiels de comptes rendus intégrés
 */
const SYSTEM_TEMPLATES = {
  ADMIN: {
    name: 'Compte rendu de réunion administrative',
    description: 'Template officiel pour réunions administratives (Direction, Conseil d\'administration, Gestion, RH)',
    meetingType: 'ADMIN',
    template: `# COMPTE RENDU DE RÉUNION ADMINISTRATIVE

## En-tête institutionnel

**Établissement :** {{tenant_name}}
**Type de réunion :** Réunion administrative
**Date :** {{meeting_date}}
**Heure :** {{start_time}} – {{end_time}}
**Lieu :** {{location}}
**Année scolaire :** {{academic_year}}

---

## Participants

### Présents :
{{#each participants.present}}
- {{name}} – {{function}}
{{/each}}

### Absents excusés :
{{#each participants.excused}}
- {{name}}
{{/each}}

### Absents non excusés :
{{#each participants.absent}}
- {{name}}
{{/each}}

---

## Ordre du jour

{{#each agendas}}
{{inc @index}}. {{topic}}
{{/each}}

---

## Déroulement & discussions

{{#each agendas}}
### Point {{inc @index}} : {{topic}}
{{description}}

{{/each}}

---

## Décisions prises

| N° | Décision | Responsable | Échéance | Statut |
|----|----------|-------------|----------|--------|
{{#each decisions}}
| {{decisionOrder}} | {{decisionText}} | {{responsibleName}} | {{dueDate}} | {{status}} |
{{/each}}

---

## Points de vigilance

{{#if risks}}
{{#each risks}}
- {{this}}
{{/each}}
{{else}}
Aucun point de vigilance particulier.
{{/if}}

---

## Clôture

La séance est levée à {{end_time}}.
Compte rendu rédigé par {{recorderName}}.

---

## Validation

**Validé par :** {{validatorName}}
**Date de validation :** {{validatedAt}}
**Signature :** [Signature électronique]
`,
  },
  PEDAGOGIC: {
    name: 'Compte rendu de réunion pédagogique',
    description: 'Template officiel pour réunions pédagogiques (Conseil pédagogique, Conseil de classe, Harmonisation)',
    meetingType: 'PEDAGOGIC',
    template: `# COMPTE RENDU DE RÉUNION PÉDAGOGIQUE

## En-tête

**Type de réunion :** Réunion pédagogique
**Niveau :** {{school_level}}
**Classe :** {{class_name}} (si applicable)
**Période :** {{exam_period}}
**Date :** {{meeting_date}}
**Année scolaire :** {{academic_year}}

---

## Participants

### Direction
{{#each participants.direction}}
- {{name}} – {{function}}
{{/each}}

### Enseignants concernés
{{#each participants.teachers}}
- {{name}} – {{subject}}
{{/each}}

{{#if participants.counselor}}
### Conseiller pédagogique
- {{participants.counselor.name}}
{{/if}}

---

## Ordre du jour

- Analyse des résultats
- Difficultés pédagogiques
- Mesures correctives

---

## Analyse des résultats

- **Moyenne générale :** {{average_grade}}
- **Matières en difficulté :** {{difficult_subjects}}
- **Évolution par rapport à la période précédente :** {{evolution}}

---

## Décisions pédagogiques

| Action | Responsable | Classe | Échéance | Statut |
|--------|-------------|--------|----------|--------|
{{#each decisions}}
| {{decisionText}} | {{responsibleName}} | {{class_name}} | {{dueDate}} | {{status}} |
{{/each}}

---

## Recommandations

{{#each recommendations}}
- {{this}}
{{/each}}

---

## Validation

**Compte rendu validé par la Direction**
**Date :** {{validatedAt}}
**Signature :** [Signature électronique]
`,
  },
  PARENTS: {
    name: 'Compte rendu de réunion parents d\'élèves',
    description: 'Template officiel pour réunions parents d\'élèves (Réunion générale, par classe, individuelle)',
    meetingType: 'PARENTS',
    template: `# COMPTE RENDU DE RÉUNION PARENTS D'ÉLÈVES

## En-tête

**Type :** Réunion Parents d'élèves
**Classe / Niveau :** {{class_or_level}}
**Date :** {{meeting_date}}
**Lieu :** {{location}}

---

## Participants

### Présents :
**Parents :**
{{#each participants.parents}}
- {{name}}
{{/each}}

**Enseignants :**
{{#each participants.teachers}}
- {{name}} – {{subject}}
{{/each}}

**Administration :**
{{#each participants.admin}}
- {{name}} – {{function}}
{{/each}}

---

## Points abordés

- Résultats scolaires
- Discipline & assiduité
- Frais de scolarité

---

## Informations communiquées

{{#each announcements}}
- {{this}}
{{/each}}

---

## Questions / Réponses

{{#each qa}}
**Q :** {{question}}
**R :** {{answer}}

{{/each}}

---

## Engagements

| Engagement | Responsable | Échéance | Statut |
|------------|-------------|----------|--------|
{{#each engagements}}
| {{text}} | {{responsible}} | {{dueDate}} | {{status}} |
{{/each}}

---

## Clôture

La réunion est levée à {{end_time}}.

**Date du compte rendu :** {{recordedAt}}
**Rédigé par :** {{recorderName}}
`,
  },
};

/**
 * Service pour la gestion des templates de comptes rendus
 */
@Injectable()
export class MeetingMinutesTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Initialise les templates système pour un tenant
   */
  async initializeSystemTemplates(tenantId: string) {
    const templates = [];

    for (const [type, template] of Object.entries(SYSTEM_TEMPLATES)) {
      const existing = await this.prisma.meetingMinutesTemplate.findFirst({
        where: {
          tenantId: null, // Templates système (multi-tenant)
          meetingType: type,
          isSystem: true,
        },
      });

      if (!existing) {
        const created = await this.prisma.meetingMinutesTemplate.create({
          data: {
            tenantId: null, // Templates système globaux
            meetingType: type,
            name: template.name,
            description: template.description,
            template: template.template,
            isSystem: true,
            isActive: true,
            language: 'FR',
          },
        });
        templates.push(created);
      } else {
        templates.push(existing);
      }
    }

    return templates;
  }

  /**
   * Récupère tous les templates disponibles pour un tenant
   */
  async findAll(tenantId: string, meetingType?: string, includeSystem: boolean = true) {
    const where: any = {
      isActive: true,
      OR: [
        { tenantId }, // Templates du tenant
        ...(includeSystem ? [{ tenantId: null, isSystem: true }] : []), // Templates système
      ],
    };

    if (meetingType) {
      where.meetingType = meetingType;
    }

    return this.prisma.meetingMinutesTemplate.findMany({
      where,
      orderBy: [
        { isSystem: 'desc' }, // Templates système en premier
        { name: 'asc' },
      ],
    });
  }

  /**
   * Récupère un template par ID
   */
  async findOne(id: string, tenantId: string) {
    const template = await this.prisma.meetingMinutesTemplate.findFirst({
      where: {
        id,
        OR: [
          { tenantId }, // Template du tenant
          { tenantId: null, isSystem: true }, // Template système
        ],
      },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    return template;
  }

  /**
   * Récupère le template système par défaut pour un type de réunion
   */
  async getSystemTemplate(meetingType: string) {
    const template = await this.prisma.meetingMinutesTemplate.findFirst({
      where: {
        tenantId: null,
        meetingType,
        isSystem: true,
        isActive: true,
      },
    });

    if (!template) {
      // Si le template système n'existe pas, l'initialiser
      const systemTemplates = await this.initializeSystemTemplates('');
      const found = systemTemplates.find((t) => t.meetingType === meetingType);
      if (found) {
        return found;
      }
      throw new NotFoundException(`System template for meeting type ${meetingType} not found`);
    }

    return template;
  }

  /**
   * Crée un template personnalisé pour un tenant
   */
  async create(
    tenantId: string,
    data: {
      meetingType: string;
      name: string;
      description?: string;
      template: string;
      structure?: any;
      language?: string;
    },
  ) {
    return this.prisma.meetingMinutesTemplate.create({
      data: {
        tenantId,
        meetingType: data.meetingType,
        name: data.name,
        description: data.description,
        template: data.template,
        structure: data.structure || null,
        isSystem: false,
        isActive: true,
        language: data.language || 'FR',
      },
    });
  }

  /**
   * Met à jour un template personnalisé
   */
  async update(
    id: string,
    tenantId: string,
    data: {
      name?: string;
      description?: string;
      template?: string;
      structure?: any;
      isActive?: boolean;
    },
  ) {
    const template = await this.findOne(id, tenantId);

    // Ne pas permettre la modification des templates système
    if (template.isSystem) {
      throw new BadRequestException('Cannot modify system templates');
    }

    // Vérifier que le template appartient au tenant
    if (template.tenantId !== tenantId) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    return this.prisma.meetingMinutesTemplate.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Supprime un template personnalisé
   */
  async delete(id: string, tenantId: string) {
    const template = await this.findOne(id, tenantId);

    // Ne pas permettre la suppression des templates système
    if (template.isSystem) {
      throw new BadRequestException('Cannot delete system templates');
    }

    // Vérifier que le template appartient au tenant
    if (template.tenantId !== tenantId) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    // Soft delete : désactiver au lieu de supprimer
    return this.prisma.meetingMinutesTemplate.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });
  }
}

