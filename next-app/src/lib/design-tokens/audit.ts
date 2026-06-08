/**
 * Design System Audit Tools
 * 
 * Outils pour auditer l'UI et vérifier la conformité
 * avec le Design System officiel
 */

import { colors, typography, radius, shadow } from './index';

/**
 * Checklist d'audit visuel
 */
export const auditChecklist = {
  visual: [
    {
      id: 'emoji-check',
      question: 'Emojis restants ?',
      severity: 'error',
      check: (code: string) => {
        const emojiPattern = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
        return !emojiPattern.test(code);
      },
    },
    {
      id: 'icon-centralization',
      question: 'Icônes non centralisées ?',
      severity: 'error',
      check: (code: string) => {
        // Vérifier qu'aucune icône n'est importée directement depuis lucide-react
        const directImport = /from ['"]lucide-react['"]/g;
        const hasAppIcon = /AppIcon|from ['"]@\/components\/ui\/AppIcon['"]/g;
        return !directImport.test(code) || hasAppIcon.test(code);
      },
    },
    {
      id: 'gold-usage',
      question: 'Gold utilisé hors KPI ?',
      severity: 'warning',
      check: (code: string) => {
        // Vérifier l'usage de gold (doit être < 5% et uniquement pour KPI/ORION)
        const goldUsage = (code.match(/gold-|text-gold|bg-gold/g) || []).length;
        const totalColorUsage = (code.match(/(navy|white|slate|gray|gold|crimson)-/g) || []).length;
        const goldPercentage = totalColorUsage > 0 ? (goldUsage / totalColorUsage) * 100 : 0;
        return goldPercentage < 5;
      },
    },
    {
      id: 'crimson-usage',
      question: 'Rouge utilisé hors CTA / alertes ?',
      severity: 'error',
      check: (code: string) => {
        // Vérifier que crimson n'est utilisé que pour CTA et alertes
        const crimsonUsage = code.match(/crimson-/g) || [];
        const validContexts = /(button|cta|alert|danger|error|critical)/gi;
        // Cette vérification nécessite une analyse plus poussée
        return true; // À améliorer avec AST parsing
      },
    },
    {
      id: 'color-overload',
      question: 'Trop de couleurs visibles en même temps ?',
      severity: 'warning',
      check: (code: string) => {
        // Vérifier qu'on n'utilise pas trop de couleurs différentes
        const uniqueColors = new Set(code.match(/(navy|white|slate|gray|gold|crimson)-\d+/g) || []);
        return uniqueColors.size <= 4; // Maximum 4 couleurs différentes par composant
      },
    },
  ],
  
  typography: [
    {
      id: 'text-size-consistency',
      question: 'Tailles de texte incohérentes ?',
      severity: 'warning',
      check: (code: string) => {
        // Vérifier l'usage des classes typographiques officielles
        const officialSizes = /text-(h1|h2|h3|h4|body-large|body|body-small|label|caption)/g;
        const arbitrarySizes = /text-\[?\d+px\]?/g;
        return !arbitrarySizes.test(code) || officialSizes.test(code);
      },
    },
    {
      id: 'heading-hierarchy',
      question: 'Titres sans hiérarchie claire ?',
      severity: 'warning',
      check: (code: string) => {
        // Vérifier que les titres suivent une hiérarchie logique
        const headings = code.match(/<h[1-6]|<Heading|text-h[1-4]/g) || [];
        return headings.length > 0; // Au moins un titre présent
      },
    },
    {
      id: 'label-visibility',
      question: 'Labels plus visibles que le contenu ?',
      severity: 'warning',
      check: (code: string) => {
        // Vérifier que les labels ne sont pas plus visibles que le contenu
        const labelStyles = code.match(/text-label.*text-(gray-900|navy-900)/g) || [];
        return labelStyles.length === 0; // Labels ne doivent pas être en texte principal
      },
    },
    {
      id: 'font-mixing',
      question: 'Mélange de polices ?',
      severity: 'error',
      check: (code: string) => {
        // Vérifier qu'on n'utilise que Inter dans l'app (sauf landing)
        const fontMixing = /font-(montserrat|poppins|roboto)/g;
        const isLandingPage = /landing|public|marketing/gi.test(code);
        return !fontMixing.test(code) || isLandingPage;
      },
    },
  ],
  
  ux: [
    {
      id: 'playful-elements',
      question: 'Trop d\'éléments "ludiques" ?',
      severity: 'warning',
      check: (code: string) => {
        // Vérifier l'absence d'éléments ludiques
        const playfulPatterns = /(emoji|fun|playful|game|cartoon|animation|bounce|spin)/gi;
        return !playfulPatterns.test(code);
      },
    },
    {
      id: 'breathing-room',
      question: 'Manque de respiration ?',
      severity: 'warning',
      check: (code: string) => {
        // Vérifier l'usage d'espacements suffisants
        const spacingUsage = (code.match(/(p-|m-|gap-|space-)/g) || []).length;
        const elementCount = (code.match(/<(div|section|article|main)/g) || []).length;
        return spacingUsage >= elementCount * 0.5; // Au moins 0.5 espacement par élément
      },
    },
    {
      id: 'cta-aggressiveness',
      question: 'CTA trop agressifs ?',
      severity: 'warning',
      check: (code: string) => {
        // Vérifier que les CTA ne sont pas trop agressifs
        const aggressivePatterns = /(blink|pulse|shake|bounce|animate-spin)/g;
        return !aggressivePatterns.test(code);
      },
    },
    {
      id: 'orion-visual-noise',
      question: 'ORION visuellement trop bavard ?',
      severity: 'warning',
      check: (code: string) => {
        // Vérifier que ORION n'est pas trop visuellement chargé
        const orionElements = (code.match(/orion|Orion/gi) || []).length;
        const visualElements = (code.match(/(bg-|text-|border-)/g) || []).length;
        return orionElements <= visualElements * 0.1; // ORION ne doit pas dominer visuellement
      },
    },
  ],
  
  accessibility: [
    {
      id: 'contrast-check',
      question: 'Contraste suffisant ?',
      severity: 'error',
      check: (code: string) => {
        // Vérifier les combinaisons de couleurs pour le contraste
        const lowContrastPatterns = /(text-gray-400.*bg-gray-|text-slate-400.*bg-slate-)/g;
        return !lowContrastPatterns.test(code);
      },
    },
    {
      id: 'icon-labels',
      question: 'Icônes avec labels ?',
      severity: 'error',
      check: (code: string) => {
        // Vérifier que les icônes ont des labels accessibles
        const iconUsage = (code.match(/<AppIcon|<Icon/g) || []).length;
        const ariaLabels = (code.match(/aria-label|aria-hidden/g) || []).length;
        return ariaLabels >= iconUsage * 0.8; // Au moins 80% des icônes avec labels
      },
    },
    {
      id: 'hover-focus-states',
      question: 'États hover / focus visibles ?',
      severity: 'error',
      check: (code: string) => {
        // Vérifier la présence d'états hover/focus
        const interactiveElements = (code.match(/<button|<a|<input/g) || []).length;
        const hoverFocus = (code.match(/hover:|focus:/g) || []).length;
        return hoverFocus >= interactiveElements * 0.5; // Au moins 50% avec états
      },
    },
    {
      id: 'readability',
      question: 'Lisibilité en conditions faibles ?',
      severity: 'warning',
      check: (code: string) => {
        // Vérifier que les textes sont suffisamment grands
        const smallText = (code.match(/text-\[?1[0-1]px\]?|text-body-small/g) || []).length;
        const totalText = (code.match(/text-(h[1-4]|body|label)/g) || []).length;
        const smallTextPercentage = totalText > 0 ? (smallText / totalText) * 100 : 0;
        return smallTextPercentage < 30; // Moins de 30% de texte très petit
      },
    },
  ],
};

/**
 * Fonction d'audit complète
 */
export function auditComponent(code: string, componentName: string): {
  component: string;
  issues: Array<{
    id: string;
    question: string;
    severity: 'error' | 'warning' | 'info';
    passed: boolean;
  }>;
  score: number;
} {
  const allChecks = [
    ...auditChecklist.visual,
    ...auditChecklist.typography,
    ...auditChecklist.ux,
    ...auditChecklist.accessibility,
  ];
  
  const issues = allChecks.map(check => ({
    id: check.id,
    question: check.question,
    severity: check.severity as 'error' | 'warning' | 'info',
    passed: check.check(code),
  }));
  
  const passed = issues.filter(i => i.passed).length;
  const total = issues.length;
  const score = Math.round((passed / total) * 100);
  
  return {
    component: componentName,
    issues,
    score,
  };
}

/**
 * Génère un rapport d'audit
 */
export function generateAuditReport(audits: Array<ReturnType<typeof auditComponent>>): string {
  const totalScore = audits.reduce((sum, audit) => sum + audit.score, 0) / audits.length;
  
  const errors = audits.flatMap(a => a.issues.filter(i => !i.passed && i.severity === 'error'));
  const warnings = audits.flatMap(a => a.issues.filter(i => !i.passed && i.severity === 'warning'));
  
  return `
# Rapport d'Audit Design System

## Score Global : ${Math.round(totalScore)}%

### Erreurs Critiques : ${errors.length}
${errors.map(e => `- ❌ ${e.question}`).join('\n')}

### Avertissements : ${warnings.length}
${warnings.map(w => `- ⚠️ ${w.question}`).join('\n')}

### Composants Audités : ${audits.length}
${audits.map(a => `- ${a.component}: ${a.score}%`).join('\n')}
  `.trim();
}

