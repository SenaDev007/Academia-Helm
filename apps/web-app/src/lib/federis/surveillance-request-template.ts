/**
 * surveillance-request-template — Générateur de note circulaire (Academia Federis)
 *
 * ⭐ DEMANDE AUX ÉCOLES AUTO-REMPLIE (2026-09-30, demande utilisateur) :
 * dès que le système connaît l'examen sélectionné (ex. « Examen blanc — CEP
 * 2027 »), il pré-remplit PROFESSIONNELLEMENT l'objet de la demande ET le
 * message aux écoles — une véritable note circulaire administrative, bien
 * structurée, orientée selon le type d'examen (CEP / BEPC / BAC / CAP).
 * Le patronat n'a plus qu'à corriger quelques éléments (nombres attendus,
 * disponibilités) au lieu de rédiger la note de zéro.
 *
 * Fonction PURE (aucun import) — testable et réutilisable côté front.
 * Contraintes backend : title ≤ 190 caractères, message ≤ 2000 caractères
 * (CreateSupervisorRequestDto).
 */

export interface SurveillanceExamLike {
  id: string;
  code?: string;
  name: string;
  /** CEP | BEPC | BAC | CAP (dérivé du level côté API si absent). */
  examType?: string;
  level?: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface SurveillanceRequestDraft {
  title: string;
  message: string;
}

/** Dérive le type d'examen (examType explicite, sinon via le libellé). */
export function deriveExamType(exam?: SurveillanceExamLike | null): 'CEP' | 'BEPC' | 'BAC' | 'CAP' | null {
  if (!exam) return null;
  const explicit = (exam.examType || '').toUpperCase();
  if (['CEP', 'BEPC', 'BAC', 'CAP'].includes(explicit)) {
    return explicit as 'CEP' | 'BEPC' | 'BAC' | 'CAP';
  }
  const haystack = `${exam.name} ${exam.level ?? ''} ${exam.code ?? ''}`.toUpperCase();
  if (haystack.includes('CEP') || haystack.includes('CM2')) return 'CEP';
  if (haystack.includes('BEPC') || haystack.includes('3EME') || haystack.includes('3ÈME')) return 'BEPC';
  if (haystack.includes('BAC') || haystack.includes('BACCALAUR') || haystack.includes('TERMINALE')) return 'BAC';
  if (haystack.includes('CAP')) return 'CAP';
  return null;
}

/** Formate une date ISO en français long (ex. « mardi 15 juin 2027 »). */
function formatFrLong(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatFrShort(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * Brouillon de la demande aux écoles — note circulaire orientée par type
 * d'examen. L'objet est auto-généré dès que l'examen est connu ; le message
 * est structuré comme une note administrative officielle : objet, appel aux
 * chefs d'établissement, effectif attendu (MODIFIABLE), critères de
 * sélection (disponibilité, expérience des examens, rigueur, intégrité),
 * modalités de réponse via Academia Helm et date limite, signature.
 */
export function buildSurveillanceRequestDraft(
  exam: SurveillanceExamLike | null | undefined,
  opts?: { deadline?: string | null },
): SurveillanceRequestDraft {
  if (!exam || !exam.name) {
    return { title: '', message: '' };
  }

  const type = deriveExamType(exam);

  // ── Phrases orientées par type d'examen ──────────────────────────────────
  const epreuvePhrase: Record<string, string> = {
    CEP: 'les épreuves du Certificat d\u2019Études Primaires (CEP)',
    BEPC: 'les épreuves du Brevet d\u2019Études du Premier Cycle du Secondaire (BEPC)',
    BAC: 'les épreuves du Baccalauréat, toutes séries confondues',
    CAP: 'les épreuves du Certificat d\u2019Aptitude Professionnelle (CAP), toutes filières confondues',
  };
  const experiencePhrase: Record<string, string> = {
    CEP: 'des examens primaires (CEP)',
    BEPC: 'du BEPC',
    BAC: 'du Baccalauréat',
    CAP: 'du CAP',
  };
  const epreuves = epreuvePhrase[type ?? ''] ?? 'les épreuves de cet examen';
  const experience = experiencePhrase[type ?? ''] ?? 'des examens nationaux';

  // ── Dates des épreuves ───────────────────────────────────────────────────
  const startLong = formatFrLong(exam.startDate);
  const endLong = formatFrLong(exam.endDate);
  const datesPhrase =
    startLong && endLong && startLong !== endLong
      ? `épreuves prévues du ${startLong} au ${endLong}`
      : startLong
        ? `épreuves prévues le ${startLong}`
        : 'dates des épreuves à confirmer par note complémentaire';

  // ── Date limite de réponse ───────────────────────────────────────────────
  const deadlineShort = formatFrShort(opts?.deadline ?? null);
  const deadlinePhrase = deadlineShort
    ? `, au plus tard le ${deadlineShort}`
    : ' dans les meilleurs délais';

  // ── Objet (≤ 190 caractères — contrainte DTO) ───────────────────────────
  const title = `Désignation d\u2019enseignants surveillants — ${exam.name}`.slice(0, 190);

  // ── Corps de la note circulaire (≤ 2000 caractères — contrainte DTO) ────
  const message = [
    `NOTE CIRCULAIRE`,
    `Objet : Désignation d\u2019enseignants surveillants — ${exam.name}`,
    ``,
    `À Mesdames et Messieurs les Chefs d\u2019établissement,`,
    ``,
    `Dans le cadre de l\u2019organisation de l\u2019examen « ${exam.name} » (${datesPhrase}), le Patronat sollicite le concours de votre établissement pour la désignation d\u2019enseignants chargés de la surveillance de ${epreuves} dans les différents centres d\u2019examen.`,
    ``,
    `EFFECTIF ATTENDU PAR ÉCOLE`,
    `Chaque école est priée de proposer deux (02) à quatre (04) enseignants disponibles, proportionnellement à l\u2019importance de ses effectifs de candidats présentés. Ce nombre demeure ajustable par le Patronat selon les besoins réels des centres.`,
    ``,
    `CRITÈRES DE SÉLECTION DES ENSEIGNANTS`,
    `1. Disponibilité attestée pour l\u2019ensemble de la période des épreuves (${datesPhrase}), y compris la séance de briefing des surveillants ;`,
    `2. Expérience avérée de la surveillance ${experience} ou d\u2019examens assimilés — un antécédent de surveillance constitue un atout déterminant ;`,
    `3. Rigueur professionnelle, ponctualité et respect strict des consignes de surveillance et de la confidentialité des sujets ;`,
    `4. Absence de lien de parenté avec un candidat de la salle d\u2019affectation, afin de préserver l\u2019objectivité et l\u2019intégrité de l\u2019examen.`,
    ``,
    `MODALITÉS DE RÉPONSE`,
    `La liste des enseignants proposés (nom, prénoms, téléphone, e-mail) devra être transmise via le module « Centres, salles & Surveillants » de votre espace Academia Helm${deadlinePhrase}. Les affectations par centre et par salle seront notifiées individuellement aux enseignants après validation des listes par le Patronat.`,
    ``,
    `Le Patronat vous remercie de votre collaboration habituelle et compte sur votre prompte réponse pour la bonne organisation de cette session.`,
    ``,
    `Pour le Patronat,`,
    `Le Président`,
  ].join('\n');

  return { title, message: message.slice(0, 2000) };
}
