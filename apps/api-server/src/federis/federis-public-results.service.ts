/**
 * FederisPublicResultsService — ⭐ T26 (2026-10-01)
 * Portail PUBLIC PROVISOIRE de consultation des résultats (parents)
 * ═══════════════════════════════════════════════════════════════════════════
 * Une fois les résultats PUBLIÉS par le patronat, un LIEN PROVISOIRE est
 * généré (token 32 hex + durée de vie paramétrable, révocable à tout moment
 * — FederisDeliberationService). Les parents ouvrent ce lien SANS COMPTE et
 * recherchent leur enfant :
 *
 *   - par NOM (prénom et/ou nom, insensible à la casse et aux accents) ;
 *   - par NUMÉRO DE TABLE (correspondance exacte) ;
 *   - par MATRICULE (correspondance exacte).
 *
 * La fiche affichée récapitule l'état civil utile (nom, matricule, n° de
 * table, école, centre), les notes par matière, la moyenne, le rang, la
 * mention et la DÉCISION FINALE (Admis / Ajourné) issue du board de
 * délibération (source de vérité unique : PUBLIÉ > cas du jury > seuils).
 *
 * Sécurité :
 *   - routes @Public() MAIS garées par le token : examen introuvable si le
 *     token ne correspond à aucun lien, 403 si révoqué/expiré/non publié ;
 *   - AUCUNE PII sensible diffusée (ni email, ni téléphone, ni adresse, ni
 *     date de naissance) — uniquement le résultat officiel ;
 *   - résultats plafonnés (20) pour éviter la constitution de listes ;
 *   - les décision/moyennes proviennent du MÊME moteur que le patronat
 *     (buildDeliberationBoard) — aucune double logique divergente.
 */

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FederisGradesService } from './federis-grades.service';
import { FederisDeliberationService } from './federis-deliberation.service';

/** Nombre maximum de fiches renvoyées par recherche. */
const LOOKUP_LIMIT = 20;

/** Normalisation recherche : minuscules, sans accents, alphanumérique. */
function normTerm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

@Injectable()
export class FederisPublicResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gradesService: FederisGradesService,
    private readonly deliberationService: FederisDeliberationService,
  ) {}

  // ── Résolution du lien token → examen publié ─────────────────────────────

  /** Format attendu : 16 à 64 caractères hexadécimaux (token randomBytes). */
  private isValidTokenShape(token: string): boolean {
    return /^[a-f0-9]{16,64}$/i.test(token);
  }

  /**
   * retrouve l'examen porteur du lien (NationalExam.metadata.publicResultLink).
   * Filtre JSON Prisma d'abord, repli JS (petite table des examens publiés).
   */
  private async findExamByToken(token: string) {
    if (!this.isValidTokenShape(token)) return null;

    // 1. Filtre JSON path (PostgreSQL)
    try {
      const exam = await this.prisma.nationalExam.findFirst({
        where: { metadata: { path: ['publicResultLink', 'token'], equals: token } },
      });
      if (exam) return exam;
    } catch {
      /* certains environnements n'acceptent pas le filtre JSON → repli */
    }

    // 2. Repli : balayage des examens publiés (volume faible)
    const rows = await this.prisma.nationalExam.findMany({
      where: { status: 'RESULTS_PUBLISHED' },
      select: { id: true, metadata: true },
    });
    const hit = rows.find((r) => (r.metadata as any)?.publicResultLink?.token === token);
    if (!hit) return null;
    return this.prisma.nationalExam.findUnique({ where: { id: hit.id } });
  }

  /** Valide le lien : introuvable / révoqué / expiré / non publié → erreur. */
  private assertActiveLink(exam: {
    id: string;
    status: string;
    metadata: unknown;
  } | null) {
    if (!exam) {
      throw new NotFoundException('Lien de consultation introuvable ou invalide.');
    }
    const link = (exam.metadata as any)?.publicResultLink;
    if (!link?.token) {
      throw new NotFoundException('Lien de consultation introuvable ou invalide.');
    }
    if (link.revokedAt) {
      throw new ForbiddenException(
        'Ce lien de consultation a été révoqué par le patronat — il n\u2019est plus accessible.',
      );
    }
    if (!link.expiresAt || new Date(link.expiresAt).getTime() <= Date.now()) {
      throw new ForbiddenException(
        'Ce lien de consultation a expiré — contactez le patronat organisateur.',
      );
    }
    if (exam.status !== 'RESULTS_PUBLISHED') {
      throw new ForbiddenException('Les résultats de cet examen ne sont pas publiés.');
    }
    return link;
  }

  // ── 1. Infos du lien (écran d'accueil parents — SANS résultats) ───────────

  async getPublicInfo(token: string) {
    const exam = await this.findExamByToken(token);
    const link = this.assertActiveLink(exam);

    const [board, header] = await Promise.all([
      this.deliberationService.buildDeliberationBoard(exam!.tenantId, exam!.id),
      this.gradesService.loadPatronatHeaderInfo(exam!.tenantId),
    ]);

    return {
      link: {
        expiresAt: link.expiresAt,
        durationHours: link.durationHours ?? null,
      },
      exam: {
        code: board.exam.code,
        name: board.exam.name,
        examType: board.exam.examType,
        level: board.exam.level,
        session: board.session,
        academicYearLabel: board.academicYearLabel,
      },
      patronat: {
        name: header.name,
        abbreviation: header.abbreviation,
        territoryName: header.territoryName,
        country: header.country,
      },
      stats: {
        totalCandidates: board.stats.totalCandidates,
        admitted: board.stats.admissibles,
        failed: board.stats.ajournes,
        successRate: board.stats.successRate,
      },
    };
  }

  // ── 2. Recherche d'un élève (nom / n° de table / matricule) ──────────────

  async lookup(token: string, q: string) {
    const exam = await this.findExamByToken(token);
    this.assertActiveLink(exam);

    const term = normTerm(q ?? '');
    if (term.length < 2) {
      throw new BadRequestException(
        'Indiquez au moins 2 caractères : nom de l\u2019élève, matricule ou numéro de table.',
      );
    }

    const examTenantId = exam!.tenantId;
    const [board, payload] = await Promise.all([
      this.deliberationService.buildDeliberationBoard(examTenantId, exam!.id),
      this.gradesService.getRelevesForPublicExam(examTenantId, exam!.id),
    ]);

    // Décision officielle par candidat (source de vérité : le board).
    const rowByCandidate = new Map<string, (typeof board.admissibles)[number]>();
    for (const row of [...board.admissibles, ...board.ajournes]) {
      rowByCandidate.set(row.candidateId, row);
    }

    const matches = payload.releves.filter((rel) => {
      // 1. Matricule — correspondance exacte (normalisée)
      const matricule = normTerm(rel.candidate.matricule ?? '');
      if (matricule && matricule === term) return true;

      // 2. Numéro de table — correspondance exacte (normalisée, sans zéros de tête)
      const table = normTerm(rel.candidate.tableNumber ?? '').replace(/^0+/, '');
      if (table && (table === term.replace(/^0+/, '') || table === term)) return true;

      // 3. Nom — prénom/nom combinés dans les deux ordres, ou nom/prénom seul
      const ln = normTerm(rel.candidate.lastName ?? '');
      const fn = normTerm(rel.candidate.firstName ?? '');
      if (!term) return false;
      return (
        (ln + fn).includes(term) ||
        (fn + ln).includes(term) ||
        ln.includes(term) ||
        fn.includes(term)
      );
    });

    const truncated = matches.length > LOOKUP_LIMIT;
    const results = matches.slice(0, LOOKUP_LIMIT).map((rel) => {
      const row = rowByCandidate.get(rel.candidate.id);
      const decision: 'ADMIS' | 'AJOURNE' | null =
        row?.decision === 'ADMIS' ? 'ADMIS' : row?.decision === 'AJOURNE' ? 'AJOURNE' : null;
      return {
        matricule: rel.candidate.matricule,
        tableNumber: rel.candidate.tableNumber,
        fullName: `${rel.candidate.lastName} ${rel.candidate.firstName}`,
        gender: rel.candidate.gender,
        school: rel.candidate.school,
        centerName: rel.candidate.centerName,
        average: row?.moyenne ?? rel.computed?.finalAverage ?? null,
        rank: row?.rank ?? rel.rank ?? null,
        nbEval: row?.nbEval ?? rel.computed?.nbEval ?? 0,
        mention: row?.mention ?? rel.mention ?? null,
        decision,
        decisionLabel: row?.decisionLabel ?? null,
        // ⭐ CEP — décision du jury officielle (admission CEP + entrée en 6ème,
        //    moyenne des matières étoilées).
        cepAdmission: rel.cepAdmission
          ? {
              admisCep: rel.cepAdmission.admisCep,
              admisSixieme: rel.cepAdmission.admisSixieme,
              moyenneEtoiles: rel.cepAdmission.moyenneEtoiles,
              matieresEtoiles: rel.cepAdmission.matieresEtoiles,
            }
          : null,
        lines: rel.lines.map((l) => ({
          code: l.code,
          name: l.name,
          score: l.score,
          isAbsent: l.isAbsent,
          coefficient: l.coefficient,
          maxScore: l.maxScore,
          cm: l.cm,
          cp: l.cp,
          perfectionnement: l.perfectionnement,
        })),
      };
    });

    return {
      exam: {
        code: payload.exam.code,
        name: payload.exam.name,
        examType: payload.exam.examType,
        session: payload.session,
        academicYearLabel: payload.academicYearLabel,
      },
      total: matches.length,
      truncated,
      results,
    };
  }
}
