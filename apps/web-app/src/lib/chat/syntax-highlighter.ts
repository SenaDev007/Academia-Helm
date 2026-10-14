/**
 * ============================================================================
 * SYNTAX HIGHLIGHTER — Mise en couleur légère des blocs de code (Helm Connect)
 * ============================================================================
 *
 * ⭐ V1 (2026-10-14) — Implémentation maison sans dépendance externe.
 *
 * Contrairement à Prism.js ou Shiki (lourds ~100 KB), ce highlighter maison
 * couvre les langages les plus courants du chat académique (JavaScript/
 * TypeScript, Python, SQL, JSON, bash/shell) avec des regex simples et
 * un rendu en spans colorés sur fond slate-900 (déjà en place dans le code
 * block existant de WhatsAppChat.tsx).
 *
 * Bénéfices :
 *   - Zero dépendance ajoutée (vs prismjs ~100 KB + composants React)
 *   - Performance maximale (pas de runtime Prism ni de token walking)
 *   - Couvre les besoins courants : partage de snippets entre enseignants,
 *     debug JSON, requêtes SQL, scripts bash de déploiement
 *   - Thème dark slate-900 déjà en place — pas de CSS à charger
 *
 * Limites :
 *   - Ne couvre pas tous les langages (Rust, Go, C++, etc. tombent en mode
 *     "plain text coloré en une seule teinte")
 *   - Pas de coloration multi-lignes pour les strings/regex (les strings
 *     avec retour à la ligne ne sont pas colorés correctement)
 *   - Suffixe `lang` doit être reconnu dans SUPPORTED_LANGUAGES, sinon
 *     fallback "plain" (coloration uniforme grise)
 *
 * Usage (côté WhatsAppChat.tsx renderRichContent) :
 *   import { highlightCode } from '@/lib/chat/syntax-highlighter';
 *   const highlighted = highlightCode(code, lang);
 *   // → HTML string avec <span class="hl-keyword">...</span> etc.
 * ============================================================================
 */

// ─── Langages supportés ────────────────────────────────────────────────
const SUPPORTED_LANGUAGES = new Set([
  'javascript', 'js', 'jsx',
  'typescript', 'ts', 'tsx',
  'python', 'py',
  'sql',
  'json',
  'bash', 'sh', 'shell', 'zsh',
  'html',
  'css',
  'markdown', 'md',
  'plain', 'text', 'txt', '',
]);

// ─── Couleurs (thème slate-900) ─────────────────────────────────────────
//    On définit des classes CSS inline (style="color:...") pour éviter
//    d'avoir à charger un fichier CSS additionnel.
const COLORS = {
  keyword: '#c084fc',     // violet — for, if, function, class, etc.
  string: '#86efac',      // vert clair — "string", 'string', `template`
  number: '#fdba74',      // orange clair — 123, 3.14, 0x1F
  comment: '#94a3b8',     // gris — // comment, /* block */, # comment
  function: '#60a5fa',    // bleu clair — functionName(
  operator: '#f9a8d4',   // rose — +, -, *, /, =, ==, ===, etc.
  punctuation: '#cbd5e1', // gris clair — , ; : . ( ) { } [ ]
  boolean: '#fb7185',     // rouge clair — true, false, null, undefined
  tag: '#fdba74',         // orange — <tag> (HTML)
  attr: '#86efac',        // vert — attr="value" (HTML)
  plain: '#f1f5f9',       // blanc-gris — texte par défaut
};

// ─── Patterns par catégorie ────────────────────────────────────────────
//    On utilise des regex globales avec capture de groupe pour remplacer
//    en un seul passage (order matters : comment > string > keyword > etc.)

const KEYWORDS_JS = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|super|this|typeof|instanceof|in|of|delete|void|yield|async|await|try|catch|finally|throw|import|export|from|as|default|static|get|set|public|private|protected|readonly|abstract|interface|type|enum|namespace|declare|implements)\b/g;

const KEYWORDS_PY = /\b(def|class|return|if|elif|else|for|while|break|continue|import|from|as|try|except|finally|raise|with|lambda|yield|global|nonlocal|pass|del|in|is|not|and|or|None|True|False|self|cls)\b/g;

const KEYWORDS_SQL = /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TABLE|INDEX|VIEW|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|DISTINCT|UNION|ALL|AS|AND|OR|NOT|IN|LIKE|BETWEEN|IS|NULL|CASE|WHEN|THEN|ELSE|END|COUNT|SUM|AVG|MIN|MAX|PRIMARY|KEY|FOREIGN|REFERENCES|DEFAULT|CONSTRAINT|UNIQUE|CHECK|CASCADE|SET|VALUES|INTO|EXEC|EXECUTE|PROCEDURE|FUNCTION|RETURNS|BEGIN|COMMIT|ROLLBACK|TRANSACTION|SCHEMA|GRANT|REVOKE|PRAGMA|INTEGER|TEXT|VARCHAR|BOOLEAN|TIMESTAMP|DATE|JSON|JSONB|SERIAL|BIGINT|SMALLINT|REAL|DECIMAL|NUMERIC)\b/gi;

const KEYWORDS_BASH = /\b(if|then|else|elif|fi|for|while|do|done|case|esac|in|function|return|break|continue|exit|echo|printf|read|set|unset|export|source|alias|unalias|cd|pwd|ls|cat|grep|sed|awk|find|which|export|local|declare|trap|test|true|false|null)\b/g;

const KEYWORDS_JSON = /\b(true|false|null)\b/g;

const STRING_DOUBLE = /"(?:[^"\\]|\\.)*"/g;
const STRING_SINGLE = /'(?:[^'\\]|\\.)*'/g;
const STRING_TEMPLATE = /`(?:[^`\\]|\\.)*`/g;
const NUMBER = /\b(0x[0-9a-fA-F]+|\d+\.?\d*(?:e[+-]?\d+)?)\b/g;
const LINE_COMMENT = /\/\/[^\n]*/g;
const HASH_COMMENT = /#[^\n]*/g;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const HTML_TAG = /(<\/?)([\w-]+)/g;
const HTML_ATTR = /([\w-]+)=("(?:[^"\\]|\\.)*")/g;
const FUNCTION_CALL = /\b([a-zA-Z_$][\w$]*)\s*(?=\()/g;

// ─── Helper : escape HTML ──────────────────────────────────────────────
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Helper : wrap token in colored span ───────────────────────────────
function span(text: string, color: string): string {
  return `<span style="color:${color}">${text}</span>`;
}

// ─── Highlighter par langage ────────────────────────────────────────────
//    Chaque fonction prend le code déjà HTML-escaped et renvoie le HTML
//    coloré. On utilise un pattern de remplacement séquentiel (les regex
//    sont globales et on les applique dans le bon ordre).

function highlightJsLike(code: string, keywords: RegExp): string {
  // L'ordre est IMPORTANT : commentaires et strings d'abord pour éviter
  // que les mots-clés DANS les strings soient colorés.
  return code
    .replace(BLOCK_COMMENT, (m) => span(m, COLORS.comment))
    .replace(LINE_COMMENT, (m) => span(m, COLORS.comment))
    .replace(STRING_TEMPLATE, (m) => span(m, COLORS.string))
    .replace(STRING_DOUBLE, (m) => span(m, COLORS.string))
    .replace(STRING_SINGLE, (m) => span(m, COLORS.string))
    .replace(NUMBER, (m) => span(m, COLORS.number))
    .replace(keywords, (m) => span(m, COLORS.keyword))
    .replace(FUNCTION_CALL, (_m, name) => span(name, COLORS.function) + '(')
    .replace(/(\btrue\b|\bfalse\b|\bnull\b|\bundefined\b|\bNaN\b|\bInfinity\b)/g, (m) => span(m, COLORS.boolean))
    .replace(/([+\-*/%=&|!<>?:]+)/g, (m) => span(m, COLORS.operator))
    .replace(/([{}[\]();,.])/g, (m) => span(m, COLORS.punctuation));
}

function highlightSql(code: string): string {
  return code
    .replace(/(--[^\n]*)/g, (m) => span(m, COLORS.comment))
    .replace(STRING_SINGLE, (m) => span(m, COLORS.string))
    .replace(NUMBER, (m) => span(m, COLORS.number))
    .replace(KEYWORDS_SQL, (m) => span(m, COLORS.keyword))
    .replace(FUNCTION_CALL, (_m, name) => span(name, COLORS.function) + '(')
    .replace(/([+\-*/%=<>!]+)/g, (m) => span(m, COLORS.operator))
    .replace(/([(),;])/g, (m) => span(m, COLORS.punctuation));
}

function highlightJson(code: string): string {
  return code
    .replace(/"(?:[^"\\]|\\.)*"(?=\s*:)/g, (m) => span(m, COLORS.attr))
    .replace(STRING_DOUBLE, (m) => span(m, COLORS.string))
    .replace(NUMBER, (m) => span(m, COLORS.number))
    .replace(KEYWORDS_JSON, (m) => span(m, COLORS.boolean))
    .replace(/([{}[\]:,])/g, (m) => span(m, COLORS.punctuation));
}

function highlightBash(code: string): string {
  return code
    .replace(HASH_COMMENT, (m) => span(m, COLORS.comment))
    .replace(STRING_DOUBLE, (m) => span(m, COLORS.string))
    .replace(STRING_SINGLE, (m) => span(m, COLORS.string))
    .replace(NUMBER, (m) => span(m, COLORS.number))
    .replace(KEYWORDS_BASH, (m) => span(m, COLORS.keyword))
    .replace(/\$([A-Z_][A-Z0-9_]*)/gi, (m, name) => span('$' + name, COLORS.attr))
    .replace(/(\$\(|\$\{|\}|`)/g, (m) => span(m, COLORS.punctuation))
    .replace(/([|&;])/g, (m) => span(m, COLORS.operator));
}

function highlightHtml(code: string): string {
  // ⚠️ HTML doit être échappé AVANT d'arriver ici (sinon on casse les tags)
  // On traite les tags &lt;tag&gt; et les attributs
  return code
    .replace(/(&lt;\/?)([\w-]+)/g, (_m, p1, p2) => span(p1 + p2, COLORS.tag))
    .replace(/([\w-]+)=("(?:[^"\\]|\\.)*")/g, (_m, name, val) => span(name, COLORS.attr) + '=' + span(val, COLORS.string))
    .replace(/(&gt;|&lt;|\/&gt;)/g, (m) => span(m, COLORS.tag));
}

function highlightCss(code: string): string {
  return code
    .replace(/(\/\*[\s\S]*?\*\/)/g, (m) => span(m, COLORS.comment))
    .replace(/([.#]?[\w-]+)(?=[\s{,:])/g, (m) => span(m, COLORS.function))
    .replace(/([\w-]+)(?=:)/g, (m) => span(m, COLORS.attr))
    .replace(/:(.*?);/g, (_m, p1) => ':' + span(p1, COLORS.string) + ';')
    .replace(NUMBER, (m) => span(m, COLORS.number))
    .replace(/([{};,])/g, (m) => span(m, COLORS.punctuation));
}

function highlightMarkdown(code: string): string {
  return code
    .replace(/^(#{1,6})\s.*/gm, (m) => span(m, COLORS.keyword))
    .replace(/(\*\*[^*]+\*\*|__[^_]+__)/g, (m) => span(m, COLORS.function))
    .replace(/(\*[^*]+\*|_[^_]+_)/g, (m) => span(m, COLORS.attr))
    .replace(/(`[^`]+`)/g, (m) => span(m, COLORS.string))
    .replace(/^(-|\*|\d+\.)\s/gm, (m) => span(m, COLORS.number));
}

// ─── API publique ──────────────────────────────────────────────────────

/**
 * Highlight du code source pour affichage dans un bloc <pre><code>.
 *
 * @param code Code source BRUT (non HTML-escaped). Sera escaped en interne.
 * @param lang Code du langage ('js', 'ts', 'python', 'sql', 'json', 'bash',
 *             'html', 'css', 'md', 'plain' ou '' pour plain).
 * @returns HTML string avec <span style="color:...">...</span> pour chaque
 *          token. À insérer dans innerHTML d'un <code> existant.
 */
export function highlightCode(code: string, lang: string = ''): string {
  const escaped = escapeHtml(code);
  const normalizedLang = (lang || '').toLowerCase().trim();

  if (!SUPPORTED_LANGUAGES.has(normalizedLang)) {
    // Langage non reconnu → plain text coloré uniformément
    return span(escaped, COLORS.plain);
  }

  switch (normalizedLang) {
    case 'javascript':
    case 'js':
    case 'jsx':
      return highlightJsLike(escaped, KEYWORDS_JS);
    case 'typescript':
    case 'ts':
    case 'tsx':
      return highlightJsLike(escaped, KEYWORDS_JS);
    case 'python':
    case 'py':
      return highlightJsLike(escaped, KEYWORDS_PY);
    case 'sql':
      return highlightSql(escaped);
    case 'json':
      return highlightJson(escaped);
    case 'bash':
    case 'sh':
    case 'shell':
    case 'zsh':
      return highlightBash(escaped);
    case 'html':
      return highlightHtml(escaped);
    case 'css':
      return highlightCss(escaped);
    case 'markdown':
    case 'md':
      return highlightMarkdown(escaped);
    case 'plain':
    case 'text':
    case 'txt':
    case '':
    default:
      return span(escaped, COLORS.plain);
  }
}

/** Liste des langages supportés (pour autocomplétion / documentation). */
export const HIGHLIGHTED_LANGUAGES = Array.from(SUPPORTED_LANGUAGES).filter(l => l !== '' && l !== 'plain' && l !== 'text' && l !== 'txt');
