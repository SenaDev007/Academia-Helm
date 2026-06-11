import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Service NLP pour l'extraction de données depuis les comptes rendus
 * Alimente ORION avec des insights qualitatifs
 */
@Injectable()
export class MeetingMinutesNlpService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Extrait les entités clés d'un compte rendu
   * (personnes, dates, montants, actions, problèmes)
   */
  async extractEntities(minutesId: string, tenantId: string) {
    const minutes = await this.prisma.meetingMinutes.findFirst({
      where: {
        id: minutesId,
        meeting: {
          tenantId,
        },
      },
      include: {
        meeting: {
          include: {
            decisions: true,
            agendas: true,
          },
        },
      },
    });

    if (!minutes) {
      throw new Error(`Minutes with ID ${minutesId} not found`);
    }

    const content = minutes.renderedContent || minutes.content;

    // Extraction basique (peut être améliorée avec une vraie bibliothèque NLP)
    const entities = {
      people: this.extractPeople(content),
      dates: this.extractDates(content),
      amounts: this.extractAmounts(content),
      actions: this.extractActions(content),
      problems: this.extractProblems(content),
      risks: this.extractRisks(content),
      commitments: this.extractCommitments(content),
    };

    return entities;
  }

  /**
   * Extrait les personnes mentionnées
   */
  private extractPeople(content: string): string[] {
    // Patterns simples pour détecter les noms
    // TODO: Utiliser une bibliothèque NLP plus avancée (spacy, nlp.js, etc.)
    const namePatterns = [
      /M\.\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
      /Mme\.\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
      /([A-Z][a-z]+\s+[A-Z][a-z]+)/g, // Noms complets
    ];

    const people = new Set<string>();

    namePatterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        people.add(match[1] || match[0]);
      }
    });

    return Array.from(people);
  }

  /**
   * Extrait les dates mentionnées
   */
  private extractDates(content: string): string[] {
    const datePatterns = [
      /\d{1,2}\/\d{1,2}\/\d{4}/g, // DD/MM/YYYY
      /\d{1,2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}/gi, // DD mois YYYY
      /(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+\d{1,2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/gi,
    ];

    const dates = new Set<string>();

    datePatterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        dates.add(match[0]);
      }
    });

    return Array.from(dates);
  }

  /**
   * Extrait les montants mentionnés
   */
  private extractAmounts(content: string): Array<{ amount: string; currency?: string }> {
    const amountPatterns = [
      /(\d+(?:\s+\d{3})*(?:,\d{2})?)\s*(FCFA|XOF|€|EUR|\$|USD)/gi,
      /(\d+(?:\s+\d{3})*(?:,\d{2})?)\s*(francs?|euros?|dollars?)/gi,
    ];

    const amounts: Array<{ amount: string; currency?: string }> = [];

    amountPatterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        amounts.push({
          amount: match[1],
          currency: match[2]?.toUpperCase(),
        });
      }
    });

    return amounts;
  }

  /**
   * Extrait les actions mentionnées
   */
  private extractActions(content: string): string[] {
    const actionKeywords = [
      'doit',
      'devra',
      'sera',
      'nécessite',
      'requiert',
      'action',
      'mesure',
      'décision',
      'engagé',
      's\'engage',
    ];

    const sentences = content.split(/[.!?]\s+/);
    const actions: string[] = [];

    sentences.forEach((sentence) => {
      const lowerSentence = sentence.toLowerCase();
      actionKeywords.forEach((keyword) => {
        if (lowerSentence.includes(keyword)) {
          actions.push(sentence.trim());
        }
      });
    });

    return actions;
  }

  /**
   * Extrait les problèmes mentionnés
   */
  private extractProblems(content: string): string[] {
    const problemKeywords = [
      'problème',
      'difficulté',
      'défi',
      'risque',
      'manque',
      'absence',
      'retard',
      'échec',
      'insuffisant',
      'critique',
      'urgent',
      'alarmant',
    ];

    const sentences = content.split(/[.!?]\s+/);
    const problems: string[] = [];

    sentences.forEach((sentence) => {
      const lowerSentence = sentence.toLowerCase();
      problemKeywords.forEach((keyword) => {
        if (lowerSentence.includes(keyword)) {
          problems.push(sentence.trim());
        }
      });
    });

    return problems;
  }

  /**
   * Extrait les risques mentionnés
   */
  private extractRisks(content: string): string[] {
    const riskKeywords = [
      'risque',
      'danger',
      'menace',
      'vulnérable',
      'fragile',
      'instable',
      'incertitude',
      'aléa',
    ];

    const sentences = content.split(/[.!?]\s+/);
    const risks: string[] = [];

    sentences.forEach((sentence) => {
      const lowerSentence = sentence.toLowerCase();
      riskKeywords.forEach((keyword) => {
        if (lowerSentence.includes(keyword)) {
          risks.push(sentence.trim());
        }
      });
    });

    return risks;
  }

  /**
   * Extrait les engagements mentionnés
   */
  private extractCommitments(content: string): string[] {
    const commitmentKeywords = [
      's\'engage',
      'engagement',
      'promet',
      'promesse',
      'garantit',
      'assure',
      's\'assure',
      's\'oblige',
    ];

    const sentences = content.split(/[.!?]\s+/);
    const commitments: string[] = [];

    sentences.forEach((sentence) => {
      const lowerSentence = sentence.toLowerCase();
      commitmentKeywords.forEach((keyword) => {
        if (lowerSentence.includes(keyword)) {
          commitments.push(sentence.trim());
        }
      });
    });

    return commitments;
  }

  /**
   * Analyse le sentiment d'un compte rendu
   */
  async analyzeSentiment(minutesId: string, tenantId: string) {
    const minutes = await this.prisma.meetingMinutes.findFirst({
      where: {
        id: minutesId,
        meeting: {
          tenantId,
        },
      },
    });

    if (!minutes) {
      throw new Error(`Minutes with ID ${minutesId} not found`);
    }

    const content = minutes.renderedContent || minutes.content;

    // Analyse basique du sentiment
    const positiveWords = [
      'excellent',
      'bon',
      'bien',
      'réussi',
      'succès',
      'amélioration',
      'progrès',
      'positif',
      'satisfaisant',
    ];
    const negativeWords = [
      'problème',
      'difficulté',
      'échec',
      'négatif',
      'insuffisant',
      'critique',
      'alarmant',
      'décevant',
    ];

    const lowerContent = content.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;

    positiveWords.forEach((word) => {
      const matches = lowerContent.match(new RegExp(word, 'g'));
      if (matches) positiveCount += matches.length;
    });

    negativeWords.forEach((word) => {
      const matches = lowerContent.match(new RegExp(word, 'g'));
      if (matches) negativeCount += matches.length;
    });

    const total = positiveCount + negativeCount;
    const sentiment = total > 0
      ? positiveCount > negativeCount
        ? 'POSITIVE'
        : negativeCount > positiveCount
          ? 'NEGATIVE'
          : 'NEUTRAL'
      : 'NEUTRAL';

    return {
      sentiment,
      positiveScore: positiveCount,
      negativeScore: negativeCount,
      confidence: total > 0 ? Math.abs(positiveCount - negativeCount) / total : 0,
    };
  }

  /**
   * Détecte les thèmes récurrents dans plusieurs comptes rendus
   */
  async detectRecurringThemes(tenantId: string, academicYearId: string) {
    const minutes = await this.prisma.meetingMinutes.findMany({
      where: {
        meeting: {
          tenantId,
          academicYearId,
          status: 'HELD',
        },
        validated: true,
      },
      include: {
        meeting: {
          select: {
            id: true,
            title: true,
            meetingType: true,
            meetingDate: true,
          },
        },
      },
    });

    // Extraire les problèmes de tous les comptes rendus
    const allProblems: string[] = [];
    const allRisks: string[] = [];
    const allActions: string[] = [];

    for (const minute of minutes) {
      const content = minute.renderedContent || minute.content;
      allProblems.push(...this.extractProblems(content));
      allRisks.push(...this.extractRisks(content));
      allActions.push(...this.extractActions(content));
    }

    // Compter les occurrences
    const problemCounts = this.countOccurrences(allProblems);
    const riskCounts = this.countOccurrences(allRisks);
    const actionCounts = this.countOccurrences(allActions);

    // Identifier les thèmes récurrents (apparaissent dans au moins 3 réunions)
    const recurringProblems = Object.entries(problemCounts)
      .filter(([_, count]) => count >= 3)
      .map(([problem, count]) => ({ problem, count }))
      .sort((a, b) => b.count - a.count);

    const recurringRisks = Object.entries(riskCounts)
      .filter(([_, count]) => count >= 3)
      .map(([risk, count]) => ({ risk, count }))
      .sort((a, b) => b.count - a.count);

    return {
      recurringProblems,
      recurringRisks,
      totalMinutes: minutes.length,
      analyzedAt: new Date(),
    };
  }

  /**
   * Compte les occurrences de phrases similaires
   */
  private countOccurrences(items: string[]): Record<string, number> {
    const counts: Record<string, number> = {};

    items.forEach((item) => {
      // Normaliser (minuscules, supprimer ponctuation)
      const normalized = item.toLowerCase().replace(/[.,!?;:]/g, '').trim();
      if (normalized.length > 10) {
        // Ignorer les phrases trop courtes
        counts[normalized] = (counts[normalized] || 0) + 1;
      }
    });

    return counts;
  }

  /**
   * Génère des insights ORION depuis les comptes rendus
   */
  async generateOrionInsights(tenantId: string, academicYearId: string) {
    const [recurringThemes, minutes] = await Promise.all([
      this.detectRecurringThemes(tenantId, academicYearId),
      this.prisma.meetingMinutes.findMany({
        where: {
          meeting: {
            tenantId,
            academicYearId,
            status: 'HELD',
          },
          validated: true,
        },
        include: {
          meeting: {
            select: {
              id: true,
              title: true,
              meetingType: true,
              meetingDate: true,
            },
          },
        },
        take: 10, // Analyser les 10 derniers
        orderBy: {
          validatedAt: 'desc',
        },
      }),
    ]);

    const insights: any[] = [];

    // Insight : Problèmes récurrents
    if (recurringThemes.recurringProblems.length > 0) {
      insights.push({
        category: 'RISQUE',
        priority: 'HIGH',
        title: 'Problèmes récurrents identifiés',
        content: `${recurringThemes.recurringProblems.length} problème(s) récurrent(s) détecté(s) dans les comptes rendus.`,
        metadata: {
          problems: recurringThemes.recurringProblems.slice(0, 5),
        },
      });
    }

    // Insight : Risques récurrents
    if (recurringThemes.recurringRisks.length > 0) {
      insights.push({
        category: 'RISQUE',
        priority: 'HIGH',
        title: 'Risques récurrents identifiés',
        content: `${recurringThemes.recurringRisks.length} risque(s) récurrent(s) détecté(s).`,
        metadata: {
          risks: recurringThemes.recurringRisks.slice(0, 5),
        },
      });
    }

    // Analyser le sentiment global
    let totalPositive = 0;
    let totalNegative = 0;

    for (const minute of minutes) {
      const sentiment = await this.analyzeSentiment(minute.id, tenantId);
      if (sentiment.sentiment === 'POSITIVE') totalPositive++;
      if (sentiment.sentiment === 'NEGATIVE') totalNegative++;
    }

    if (totalNegative > totalPositive && minutes.length > 5) {
      insights.push({
        category: 'GOVERNANCE',
        priority: 'MEDIUM',
        title: 'Sentiment négatif dans les réunions',
        content: `Les comptes rendus récents montrent un sentiment majoritairement négatif (${totalNegative} vs ${totalPositive}).`,
        recommendation: 'Analyser les causes et mettre en place des actions correctives.',
      });
    }

    return insights;
  }
}

