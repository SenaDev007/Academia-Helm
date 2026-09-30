/**
 * circular-note-parser — Analyse d'une note circulaire (Academia Helm)
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ 2026-09-30 (demande utilisateur) : la note circulaire reçue par l'école
 * dans « Patronats & Examens → Gestion des surveillants / Correction » doit
 * être présentée comme une VÉRITABLE LETTRE PROFESSIONNELLE (structurée),
 * et non plus comme un bloc de texte brut « en vrac ».
 *
 * Ce parser transforme le message brut (généré par
 * buildSurveillanceRequestDraft — surveillance-request-template.ts — ou
 * rédigé librement par le patronat) en une structure de rendu :
 * en-tête (émetteur + date + objet), appel, sections titrées, listes à
 * puces / numérotées, formule de clôture et bloc signature.
 *
 * ROBUSTESSE : une note rédigée librement (sans le gabarit) est rendue
 * comme une lettre simple (paragraphes) — jamais de structure forcée.
 * Fonction PURE (aucun import) — testable et réutilisable côté front.
 */

export interface CircularNoteBlock {
  type: 'para' | 'bullet' | 'numbered';
  text: string;
  /** Numéro d'origine pour les listes numérotées (« 1. », « 2. »…). */
  index?: string;
}

export interface CircularNoteSection {
  /** Titre en capitales (ex. « CRITÈRES DE SÉLECTION DES ENSEIGNANTS »). */
  title: string | null;
  blocks: CircularNoteBlock[];
}

export interface ParsedCircularNote {
  /** Libellé du document (« NOTE CIRCULAIRE » — fallback générique). */
  documentLabel: string;
  /** Objet de la note (ligne « Objet : … »), sans le préfixe. */
  object: string | null;
  /** Appel (ex. « À Mesdames et Messieurs les Chefs d'établissement, »). */
  salutation: string | null;
  /** Corps structuré en sections titrées (titre null = bloc d'ouverture). */
  sections: CircularNoteSection[];
  /** Formule de clôture (paragraphe final avant la signature). */
  closing: string | null;
  /** Bloc signature détaché du corps. */
  signature: { forLabel: string; role: string; name: string } | null;
  /** Lignes non vides du message d'origine (détection « vide »). */
  rawLineCount: number;
}

/** Une ligne est-elle un TITRE DE SECTION en capitales ? (≥ 3 lettres, aucune
 *  minuscule, pas une liste, pas trop longue — les points/accents tolérés) */
function isSectionTitle(line: string): boolean {
  const t = line.trim();
  if (t.length < 4 || t.length > 90) return false;
  if (/^[—•\-–]\s/.test(t)) return false; // puce
  if (/^\d+\s*[.)]\s/.test(t)) return false; // liste numérotée
  const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letters.length < 3) return false;
  const hasLower = /[a-zà-ÿ]/.test(letters);
  const isUpperLike = !hasLower && letters === letters.toUpperCase();
  // Les lignes TOUTES en capitales du gabarit (« EFFECTIF ATTENDU… ») sont
  // des titres ; « NOTE CIRCULAIRE » est traité à part (en-tête document).
  return isUpperLike && t !== 'NOTE CIRCULAIRE';
}

/** Analyse une note circulaire brute en structure de rendu lettre. */
export function parseCircularNote(rawMessage: string | null | undefined): ParsedCircularNote {
  const lines = (rawMessage ?? '')
    .split(/\r?\n/)
    .map((l) => l.trimEnd());

  const result: ParsedCircularNote = {
    documentLabel: 'NOTE CIRCULAIRE',
    object: null,
    salutation: null,
    sections: [],
    closing: null,
    signature: null,
    rawLineCount: lines.filter((l) => l.trim().length > 0).length,
  };

  // ── Bloc signature : « Pour le Patronat…, » / « Le Coordinateur… » / nom
  const sigStart = lines.findIndex((l) => /^pour\s+le\s+patronat/i.test(l.trim()));
  let bodyLines: string[] = lines;
  if (sigStart >= 0) {
    const sigLines = lines
      .slice(sigStart)
      .map((l) => l.trim())
      .filter(Boolean);
    bodyLines = lines.slice(0, sigStart);
    const forLabel = sigLines[0] ?? '';
    const roleLine = sigLines.find((l, i) => i > 0 && /^(le|la)\s+/i.test(l)) ?? '';
    // Le nom = dernière ligne non vide qui n'est ni la formule ni le rôle
    const name = sigLines
      .filter((l, i) => i > 0 && l !== roleLine)
      .pop() ?? '';
    result.signature = {
      forLabel,
      role: roleLine.replace(/,$/, ''),
      name,
    };
  }

  // ── Parcours du corps
  let current: CircularNoteSection = { title: null, blocks: [] };
  const flush = () => {
    if (current.title !== null || current.blocks.length > 0) {
      result.sections.push(current);
    }
    current = { title: null, blocks: [] };
  };

  const paras: string[] = [];
  for (const raw of bodyLines) {
    const line = raw.trim();
    if (!line) continue; // séparation de paragraphes ( implicite par blocs )

    // En-tête du document
    if (/^NOTE\s+CIRCULAIRE$/i.test(line)) continue; // déjà le label par défaut

    // Objet
    if (/^objet\s*:/i.test(line)) {
      result.object = line.replace(/^objet\s*:\s*/i, '').trim();
      continue;
    }

    // Appel (premier paragraphe commençant par « À Mesdames… » / « Madame… »)
    if (
      result.salutation === null &&
      /^(à\s+mesdames|mesdames|à\s+monsieur|monsieur|madame)\b/i.test(line) &&
      line.length < 120
    ) {
      result.salutation = line;
      continue;
    }

    // Titre de section en capitales
    if (isSectionTitle(line)) {
      flush();
      current = { title: line.trim(), blocks: [] };
      continue;
    }

    // Puce « — … »
    const bullet = line.match(/^[—–-]\s+(.*)$/);
    if (bullet) {
      current.blocks.push({ type: 'bullet', text: bullet[1].trim() });
      continue;
    }

    // Liste numérotée « 1. … » / « 2) … »
    const numbered = line.match(/^(\d+)\s*[.)]\s+(.*)$/);
    if (numbered) {
      current.blocks.push({ type: 'numbered', index: numbered[1], text: numbered[2].trim() });
      continue;
    }

    // Paragraphe — la formule de clôture est le DERNIER paragraphe
    // (remerciements) : mémorisée à part pour la mise en forme lettre.
    current.blocks.push({ type: 'para', text: line });
  }
  flush();

  // ── Clôture : dernier paragraphe non vide du corps (hors listes)
  const allParas = result.sections.flatMap((s) =>
    s.blocks.filter((b) => b.type === 'para'),
  );
  void paras;
  if (allParas.length > 0) {
    const last = allParas[allParas.length - 1];
    if (/remercie|compte\s+sur|vous\s+remercies|collaboration/i.test(last.text)) {
      result.closing = last.text;
      // Retrait du paragraphe de clôture des sections
      outer: for (const s of result.sections) {
        for (let i = s.blocks.length - 1; i >= 0; i--) {
          if (s.blocks[i].type === 'para' && s.blocks[i].text === last.text) {
            s.blocks.splice(i, 1);
            break outer;
          }
        }
      }
      // Nettoyage des sections devenues vides
      result.sections = result.sections.filter(
        (s) => s.title !== null || s.blocks.length > 0,
      );
    }
  }

  return result;
}

/** Extrait les N premiers caractères du corps d'une note (aperçu dans les
 *  listes), sans couper au milieu d'un mot. */
export function circularNoteExcerpt(
  rawMessage: string | null | undefined,
  max = 160,
): string {
  const t = (rawMessage ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max)}…`;
}
