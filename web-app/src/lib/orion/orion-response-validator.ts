/**
 * ORION Response Validator
 * 
 * Validateur strict des réponses ORION
 * 
 * CONTRAINTES :
 * - Validation structurelle (JSON)
 * - Validation sémantique (ton, contenu)
 * - Détection de suppositions
 * - Détection de conseils
 */

/**
 * Résultat de validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Mots interdits (suppositions, conseils)
 */
const FORBIDDEN_WORDS = [
  'probablement',
  'semble',
  'devrait',
  'devriez',
  'recommandation',
  'conseil',
  'suggestion d\'action',
  'il faudrait',
  'vous devriez',
  'je recommande',
  'je suggère',
];

/**
 * Mots familiers interdits
 */
const FAMILIAR_WORDS = [
  'salut',
  'hey',
  'coucou',
  'tu',
  'ton',
  'ta',
  'tes',
  't\'as',
];

/**
 * Valide une réponse ORION
 */
export function validateOrionResponse(response: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validation structurelle
  if (!response || typeof response !== 'object') {
    errors.push('Réponse doit être un objet JSON');
    return { valid: false, errors, warnings };
  }

  // Vérifier la présence des champs obligatoires
  if (!Array.isArray(response.facts)) {
    errors.push('Champ "facts" manquant ou invalide (doit être un tableau)');
  }

  if (typeof response.interpretation !== 'string') {
    errors.push('Champ "interpretation" manquant ou invalide (doit être une chaîne)');
  }

  if (response.vigilance !== null && typeof response.vigilance !== 'string') {
    errors.push('Champ "vigilance" invalide (doit être une chaîne ou null)');
  }

  // Validation sémantique : Vérifier les faits
  if (Array.isArray(response.facts)) {
    response.facts.forEach((fact: string, index: number) => {
      if (typeof fact !== 'string') {
        errors.push(`Fact ${index + 1} doit être une chaîne`);
      } else {
        // Vérifier les mots interdits dans les faits
        const lowerFact = fact.toLowerCase();
        for (const word of FORBIDDEN_WORDS) {
          if (lowerFact.includes(word)) {
            errors.push(`Fact ${index + 1} contient un mot interdit : "${word}"`);
          }
        }
        for (const word of FAMILIAR_WORDS) {
          if (lowerFact.includes(word)) {
            errors.push(`Fact ${index + 1} contient un mot familier : "${word}"`);
          }
        }
      }
    });
  }

  // Validation sémantique : Vérifier l'interprétation
  if (typeof response.interpretation === 'string') {
    const lowerInterpretation = response.interpretation.toLowerCase();
    
    // Vérifier les mots interdits
    for (const word of FORBIDDEN_WORDS) {
      if (lowerInterpretation.includes(word)) {
        errors.push(`Interprétation contient un mot interdit : "${word}"`);
      }
    }

    // Vérifier les mots familiers
    for (const word of FAMILIAR_WORDS) {
      if (lowerInterpretation.includes(word)) {
        errors.push(`Interprétation contient un mot familier : "${word}"`);
      }
    }

    // Vérifier la longueur (doit être concise)
    if (response.interpretation.length > 500) {
      warnings.push('Interprétation trop longue (maximum 500 caractères recommandé)');
    }
  }

  // Validation sémantique : Vérifier la vigilance
  if (response.vigilance && typeof response.vigilance === 'string') {
    const lowerVigilance = response.vigilance.toLowerCase();
    
    for (const word of FORBIDDEN_WORDS) {
      if (lowerVigilance.includes(word)) {
        errors.push(`Vigilance contient un mot interdit : "${word}"`);
      }
    }

    for (const word of FAMILIAR_WORDS) {
      if (lowerVigilance.includes(word)) {
        errors.push(`Vigilance contient un mot familier : "${word}"`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valide un résumé mensuel ORION
 */
export function validateOrionSummary(summary: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!summary || typeof summary !== 'object') {
    errors.push('Résumé doit être un objet JSON');
    return { valid: false, errors, warnings };
  }

  // Vérifier les champs obligatoires
  if (typeof summary.overview !== 'string') {
    errors.push('Champ "overview" manquant ou invalide');
  }

  if (!Array.isArray(summary.trends)) {
    errors.push('Champ "trends" manquant ou invalide (doit être un tableau)');
  }

  if (!Array.isArray(summary.highlights)) {
    errors.push('Champ "highlights" manquant ou invalide (doit être un tableau)');
  }

  // Validation sémantique
  if (typeof summary.overview === 'string') {
    const lowerOverview = summary.overview.toLowerCase();
    for (const word of FORBIDDEN_WORDS) {
      if (lowerOverview.includes(word)) {
        errors.push(`Overview contient un mot interdit : "${word}"`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

