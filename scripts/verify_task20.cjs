#!/usr/bin/env node
/**
 * verify_task20.cjs — Vérification du lot 2026-10-01 (module « Épreuves et
 * documents » — Academia Frederis) :
 *
 *   1. FRACTIONS & FORMULES EN LIGNE (champ de saisie enrichi) : les
 *      éléments textuels du panneau Maths (fractions, symboles,
 *      puissances/indices) ne sont PLUS traités comme des objets média —
 *      ils vivent DANS le flux du texte (« A) ¾  B) ⅝  C) ½ » sur UNE
 *      ligne). Fractions posées contenteditable="false" (atome insécable :
 *      clic = sélection, glisser-déposer NATIF, Suppr = retrait en bloc),
 *      plus AUCUN habillage proposé dessus (l'habillage float/block/
 *      absolute déformait la ligne). Garde anti-dépôt-sur-soi pour le drag
 *      custom des vrais médias (insertNode levait HierarchyRequestError
 *      avalé par le catch → « pas déplaçable »).
 *   2. BOUTON UNIQUE « Ajouter » (interface de création d'épreuves) :
 *      remplace les boutons « + Problème / + Exercice / + Section libre ».
 *      Au clic, l'utilisateur choisit le type (Problème, Exercice, Item,
 *      Question, Consigne, Partie, Titre libre) — numérotation automatique
 *      par type (Problème 1, Problème 2… Partie A, Partie B…).
 *   3. HIÉRARCHIE DES BLOCS : un bloc peut en contenir d'autres
 *      (parentSectionId) — « on met le titre consigne et c'est dedans on
 *      va voir après problème 1 problème 2, ou bien consigne et item 1
 *      item 2 ». Front (arbre, Ajouter dedans, suppression en cascade,
 *      déplacement entre frères) + backend (sanitize + purge orphelins) +
 *      PDF (sous-blocs indentés .section-sub dans le bloc parent).
 *
 * Exécution : node scripts/verify_task20.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let ok = 0;
let fail = 0;

function check(label, condition, detail = '') {
  if (condition) {
    ok++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function read(p) {
  return fs.readFileSync(path.join(ROOT, p), 'utf8');
}

// TypeScript partagé (pattern verify_task15/19.cjs)
let ts;
const TS_PATHS = [
  '/home/z/my-project/scripts/tscheck/node_modules/typescript',
  path.join(ROOT, 'node_modules/typescript'),
  'typescript',
];
for (const p of TS_PATHS) {
  try {
    ts = require(p);
    break;
  } catch { /* essayer le suivant */ }
}

/** Transpile un extrait TS et l'évalue en CommonJS (retourne les exports). */
function evalTsModule(code) {
  const out = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  const mod = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', out)(mod, mod.exports, require);
  return mod.exports;
}

const rte = read('apps/web-app/src/components/ui/RichTextEditor.tsx');
const math = read('apps/web-app/src/components/pedagogy/media/MathPanel.tsx');
const page = read('apps/web-app/src/components/federis/FederisEpreuvesPage.tsx');
const svc = read('apps/api-server/src/federis/federis-epreuve.service.ts');

console.log('════════════════════════════════════════════════════════════════════');
console.log(' TASK 20 — Fractions en ligne, bouton « Ajouter » unique, blocs imbriqués');
console.log('════════════════════════════════════════════════════════════════════');

// ══════════════════════════════════════════════════════════════════════
// 1. FRACTIONS & FORMULES EN LIGNE (RichTextEditor + MathPanel)
// ══════════════════════════════════════════════════════════════════════
console.log('\n── 1. Fractions & formules EN LIGNE (plus un objet média) ──');

// 1-a. MEDIA_SELECTOR : les éléments textuels Maths en sont RETIRÉS
{
  const m = rte.match(/const MEDIA_SELECTOR = \[([\s\S]*?)\]\.join\(", "\);/);
  check('MEDIA_SELECTOR trouvé dans RichTextEditor', !!m);
  if (m) {
    const body = m[1];
    check('MEDIA_SELECTOR : span.ah-frac RETIRÉ (fraction = texte, pas objet)',
      !body.includes('ah-frac'));
    check('MEDIA_SELECTOR : span.ah-math RETIRÉ (symboles = texte)',
      !body.includes('ah-math'));
    check('MEDIA_SELECTOR : sup.ah-sup / sub.ah-sub RETIRÉS (puissances = texte)',
      !body.includes('ah-sup') && !body.includes('ah-sub'));
    check('MEDIA_SELECTOR : vrais médias conservés (ah-fig, ah-op, ah-table, calli-lines, img, svg)',
      body.includes('ah-fig') && body.includes('ah-op') &&
      body.includes('ah-table') && body.includes('calli-lines') &&
      body.includes('img') && body.includes('svg'));
  }
}

// 1-b. Atome inline : INLINE_ATOM_SELECTOR + normalizeInlineAtoms + sync
check('INLINE_ATOM_SELECTOR défini (span.ah-frac)',
  rte.includes('const INLINE_ATOM_SELECTOR = "span.ah-frac"'));
check('normalizeInlineAtoms : pose contenteditable="false" sur les fractions anciennes',
  /function normalizeInlineAtoms[\s\S]*?contenteditable[^\n]*"false"/.test(rte));
check('normalizeInlineAtoms APPELÉ au chargement du contenu externe (useEffect value)',
  /innerHTML = value \|\| "";\s*\n\s*normalizeInlineAtoms\(editorRef\.current\);/.test(rte));

// 1-c. Garde anti-dépôt-sur-soi du drag custom (vrais médias)
check('startMediaDrag : dépôt REFUSÉ si le caret est DANS l\'élément déplacé ' +
  '(fix « pas déplaçable » — HierarchyRequestError silencieux)',
  /!el\.contains\(caret\.startContainer\)/.test(rte));

// 1-d. buildFraction (RUNTIME — vrai code du MathPanel) : atome insécable
if (ts) {
  try {
    const escSrc = math.match(/const escHtml = \(s: string\) =>\n[^\n]*;/);
    const fracSrc = math.match(
      /export function buildFraction\(num: string, den: string\): string \{[\s\S]*?\n\}/,
    );
    if (!escSrc || !fracSrc) throw new Error('buildFraction/escHtml introuvables dans MathPanel');
    const exports = evalTsModule(
      `${escSrc[0]}\n${fracSrc[0]}\nmodule.exports = { buildFraction };`,
    );
    const html = exports.buildFraction('3', '4');
    check('RUNTIME buildFraction : contenteditable="false" posé (atome insécable)',
      html.includes('contenteditable="false"'));
    check('RUNTIME buildFraction : classe ah-frac conservée (données existantes reconnues)',
      html.includes('class="ah-frac"'));
    check('RUNTIME buildFraction : display:inline-flex (reste DANS la ligne, jamais block)',
      html.includes('display:inline-flex'));
    check('RUNTIME buildFraction : numérateur 3 au-dessus, dénominateur 4 en dessous (barre)',
      html.includes('>3<') && html.includes('>4<') &&
      html.includes('border-bottom'));
    const htmlBis = exports.buildFraction('7', '8');
    check('RUNTIME buildFraction : contenus échappés / paramétriques (7/8 ≠ 3/4)',
      htmlBis.includes('>7<') && htmlBis.includes('>8<') && !htmlBis.includes('>3<'));
  } catch (e) {
    check('RUNTIME buildFraction exécutable', false, e.message);
  }
}

// 1-e. sanitizeRichHtml (backend) : contenteditable retiré du PDF uniquement
check('sanitizeRichHtml retire contenteditable du HTML PDF (rendu statique propre)',
  /\\s\+contenteditable\\s\+\\=/.test(svc) || svc.includes("contenteditable\\s"));
check('sanitizeSections ne touche PAS au HTML des contenus (contenteditable ' +
  'conservé EN BASE pour l\'éditeur)', !/contenteditable/.test(
  svc.slice(svc.indexOf('private sanitizeSections'), svc.indexOf('private sanitizeLabelStyle')),
));

// ══════════════════════════════════════════════════════════════════════
// 2. BOUTON UNIQUE « AJOUTER » (FederisEpreuvesPage)
// ══════════════════════════════════════════════════════════════════════
console.log('\n── 2. Bouton unique « Ajouter » avec choix du type ──');

check('Anciens boutons « + Problème » / « + Exercice » / « + Section libre » SUPPRIMÉS',
  !page.includes('+ Problème') && !page.includes('+ Exercice') && !page.includes('+ Section libre'));
check('Bouton unique « Ajouter » présent (menu addMenu === \'root\')',
  page.includes("addMenu === 'root'") && page.includes('Ajouter'));
check('Types proposés : Problème, Exercice, Item, Question, Consigne, Partie',
  ['Problème', 'Exercice', 'Item', 'Question', 'Consigne', 'Partie'].every((k) =>
    page.includes(`'${k}',`)));
check('Option « Titre libre… » proposée (bloc sans intitulé pré-rempli)',
  page.includes("'__libre__'") && page.includes('Titre libre'));
check('Indication de numérotation en direct dans le menu (→ Problème 2…)',
  /autoSectionTitle\(kind, siblingsOf\(null\)\)/.test(page));

// 2-b. RUNTIME autoSectionTitle (vrai code du composant)
if (ts) {
  try {
    const fn = page.match(
      /const autoSectionTitle = \(kind: string, siblings: EpreuveSection\[\]\): string => \{[\s\S]*?\n  \};/,
    );
    if (!fn) throw new Error('autoSectionTitle introuvable');
    const exports = evalTsModule(
      `${fn[0]}\nmodule.exports = { autoSectionTitle };`,
    );
    const t = exports.autoSectionTitle;
    check('RUNTIME numérotation : 1er Problème → « Problème 1 »',
      t('Problème', []) === 'Problème 1');
    check('RUNTIME numérotation : 2e Problème → « Problème 2 » (compte les frères du type)',
      t('Problème', [{ title: 'Problème 1' }]) === 'Problème 2');
    check('RUNTIME numérotation : Items indépendants → « Item 3 »',
      t('Item', [{ title: 'Item 1' }, { title: 'Item 2' }]) === 'Item 3');
    check('RUNTIME numérotation : Partie A, Partie B… (lettres)',
      t('Partie', []) === 'Partie A' &&
      t('Partie', [{ title: 'Partie A' }, { title: 'Partie B' }]) === 'Partie C');
    check('RUNTIME numérotation : Consigne numérotée « Consigne 1 »',
      t('Consigne', [{ title: 'Problème 1' }]) === 'Consigne 1');
  } catch (e) {
    check('RUNTIME autoSectionTitle exécutable', false, e.message);
  }
}

// ══════════════════════════════════════════════════════════════════════
// 3. HIÉRARCHIE DES BLOCS (front + backend + PDF)
// ══════════════════════════════════════════════════════════════════════
console.log('\n── 3. Blocs imbriqués (Consigne → Problème 1/2, Item 1/2) ──');

// 3-a. Front : modèle + arbre + cascade
check('EpreuveSection porte parentSectionId (lien parent)',
  /interface EpreuveSection \{[\s\S]*?parentSectionId\?: string \| null;[\s\S]*?\}/.test(page));
check('Ajout DANS un bloc : bouton « Ajouter dedans » + addSection(kind, s.id)',
  page.includes('Ajouter dedans') && /addSection\(kind, s\.id\)/.test(page));
check('Suppression EN CASCADE (un bloc parent supprimé emporte ses enfants)',
  /const doomed = new Set[\s\S]*?doomed\.has\(s\.parentSectionId\)/.test(page));
check('Déplacement entre FRÈRES uniquement (siblingsOf — l\'arbre reste intact)',
  /siblingsOf\(current\.parentSectionId\)/.test(page) &&
  /siblings\.findIndex\(\(s\) => s\.id === id\)/.test(page));
check('Rendu récursif de l\'arbre : racines + enfants indentés',
  /renderSectionBlock[\s\S]*?children\.map\(\(c\) => renderSectionBlock\(c, depth \+ 1\)\)/.test(page));
check('Blocs enfants VISUELLEMENT distincts (indentation + ↳ + bordure bleue)',
  /ml-3 sm:ml-6/.test(page) && page.includes('↳') && page.includes('border-blue-100'));

// 3-b. Backend : sanitizeSections (RUNTIME — vrai code du service)
if (ts) {
  try {
    const m = svc.match(/private sanitizeSections[\s\S]*?\n  \}\n/);
    if (!m) throw new Error('sanitizeSections introuvable');
    const fnSrc = m[0].replace('private sanitizeSections', 'function sanitizeSections');
    const exports = evalTsModule(
      `${fnSrc}\nconst RICH_FIELD_MAX = 200000;\nmodule.exports = { sanitizeSections };`,
    );
    const s = exports.sanitizeSections;

    const out1 = s([
      { id: 'cons1', title: 'Consigne', content: '<p>Lis.</p>' },
      { id: 'p1', title: 'Problème 1', content: '', parentSectionId: 'cons1' },
      { id: 'p2', title: 'Problème 2', content: '', parentSectionId: 'cons1' },
      { id: 'ex1', title: 'Exercice 1', content: '' },
    ]);
    check('RUNTIME sanitize : parentSectionId PROPAGÉ (p1/p2 dans cons1)',
      out1.find((x) => x.id === 'p1').parentSectionId === 'cons1' &&
      out1.find((x) => x.id === 'p2').parentSectionId === 'cons1');
    check('RUNTIME sanitize : bloc racine sans parent (ex1 → null)',
      out1.find((x) => x.id === 'ex1').parentSectionId === null);

    const out2 = s([
      { id: 'a', title: 'A', content: '' },
      { id: 'b', title: 'B', content: '', parentSectionId: 'inconnu' },
      { id: 'c', title: 'C', content: '', parentSectionId: 'c' },
    ]);
    check('RUNTIME sanitize : parent ORPHELIN → racine (aucun bloc perdu)',
      out2.find((x) => x.id === 'b').parentSectionId === null);
    check('RUNTIME sanitize : AUTO-référence → racine (pas de cycle)',
      out2.find((x) => x.id === 'c').parentSectionId === null);

    const out3 = s(null);
    check('RUNTIME sanitize : null → null (comportement inchangé)', out3 === null);
    const out4 = s([{ title: 'X', content: '' }]);
    check('RUNTIME sanitize : id régénéré + parentSectionId null par défaut',
      out4[0].id === 'section-1' && out4[0].parentSectionId === null);
  } catch (e) {
    check('RUNTIME sanitizeSections exécutable', false, e.message);
  }
}

// 3-c. E2E PDF : rendu hiérarchique réel (buildEpreuvePdfHtml exécuté)
if (ts) {
  try {
    const escSrc = svc.match(/function esc\(value: unknown\): string \{[\s\S]*?\n\}/)[0];
    const constsSrc =
      "const CATEGORY_LABELS = { CEP: 'x', BEPC: 'x', BAC: 'x', CAP: 'x' };\n" +
      "const CATEGORY_SHORT_LABELS = { CEP: 'CEP', BEPC: 'BEPC', BAC: 'Baccalauréat', CAP: 'CAP' };";
    const helperNames = [
      'sanitizeRichHtml', 'sanitizeLabelStyle', 'sanitizeCopiesPerPage',
      'sanitizeWatermarkMode', 'stripAcademicYearPrefix',
    ];
    const helpersSrc = helperNames.map((name) => {
      const m = svc.match(new RegExp(`private ${name}[\\s\\S]*?\\n  \\}\\n`));
      if (!m) throw new Error(`helper ${name} introuvable`);
      return m[0].replace(`private ${name}`, `function ${name}`);
    }).join('\n\n');
    const buildStart = svc.indexOf('private buildEpreuvePdfHtml');
    const buildEnd = svc.indexOf('// ── Helpers internes');
    let buildSrc = svc.slice(buildStart, buildEnd).trim();
    buildSrc = buildSrc.replace('private buildEpreuvePdfHtml', 'function buildEpreuvePdfHtml');

    const testModule = evalTsModule(`
${constsSrc}
${escSrc}
${helpersSrc}
const SCHOOL_FONTS_CSS = '/* polices stub */';
${buildSrc}
module.exports = { buildEpreuvePdfHtml, sanitizeRichHtml, sanitizeLabelStyle, sanitizeCopiesPerPage, sanitizeWatermarkMode, stripAcademicYearPrefix };
`);

    const fakeThis = {
      sanitizeRichHtml: testModule.sanitizeRichHtml,
      sanitizeLabelStyle: testModule.sanitizeLabelStyle,
      sanitizeCopiesPerPage: testModule.sanitizeCopiesPerPage,
      sanitizeWatermarkMode: testModule.sanitizeWatermarkMode,
      stripAcademicYearPrefix: testModule.stripAcademicYearPrefix,
    };
    const ctx = {
      patronatName: 'Patronat Test',
      patronatShortName: 'PPT',
      abbreviation: 'PPT',
      country: 'Bénin',
      logo: null,
      reusableHeader: null,
      academicYearLabel: 'Année scolaire 2026-2027',
    };

    // Sujet avec hiérarchie : Consigne → (Problème 1, Problème 2) + Exercice 1 racine
    const paper = {
      title: 'Épreuve de Mathématiques',
      subject: 'Mathématiques',
      sessionLabel: 'Examen blanc',
      durationLabel: '2h',
      maxScoreLabel: '20 pts',
      coefficient: null,
      showIdentityFields: true,
      examCategory: 'CEP',
      situation: '<p>Situation.</p>',
      tache: '<p>Tâche.</p>',
      sections: [
        { id: 'cons1', title: 'Consigne', content: '<p>Lis bien.</p>' },
        { id: 'p1', title: 'Problème 1', content: '<p>Calcule <span class="ah-frac" contenteditable="false">¾</span>.</p>', parentSectionId: 'cons1' },
        { id: 'p2', title: 'Problème 2', content: '<p>Démontre.</p>', parentSectionId: 'cons1' },
        { id: 'ex1', title: 'Exercice 1', content: '<p>Écris.</p>' },
      ],
      cleCorrection: '',
      grilleCorrection: '',
      footerText: '',
      customHeader: '',
      labelStyle: null,
      copiesPerPage: 1,
      watermarkMode: 'none',
      watermarkText: null,
    };

    const html = testModule.buildEpreuvePdfHtml.call(fakeThis, paper, ctx);
    const idxConsigne = html.indexOf('>Consigne<');
    const idxP1 = html.indexOf('>Problème 1<');
    const idxP2 = html.indexOf('>Problème 2<');
    const idxEx1 = html.indexOf('>Exercice 1<');
    const rootCount = (html.match(/class="section"/g) || []).length;
    const subCount = (html.match(/class="section section-sub"/g) || []).length;
    check('E2E PDF : les 4 blocs rendus (aucun perdu)', idxConsigne > -1 && idxP1 > -1 && idxP2 > -1 && idxEx1 > -1);
    check('E2E PDF : sous-blocs .section-sub × 2 (Problème 1 et 2 DANS la Consigne)',
      subCount === 2);
    check('E2E PDF : 4 blocs racines exacts (Situation, Tâche, Consigne, Exercice 1)',
      rootCount === 4, `trouvés : ${rootCount}`);
    check('E2E PDF : ordre conservé (Consigne → Problème 1 → Problème 2 → Exercice 1)',
      idxConsigne < idxP1 && idxP1 < idxP2 && idxP2 < idxEx1);
    check('E2E PDF : CSS des sous-blocs présents (.section .section-sub, indentation 6mm)',
      html.includes('.section .section-sub') && html.includes('margin-left: 6mm'));
    // Les enfants sont rendus dans le <div> du parent (avant sa fermeture) :
    // le </div> qui suit la Consigne est APRÈS le rendu des 2 problèmes.
    const consigneBlockEnd = html.indexOf('</div>', idxConsigne);
    check('E2E PDF : les problèmes sont rendus DANS le bloc de la consigne (imbrication réelle)',
      idxP1 > idxConsigne && idxP1 < html.lastIndexOf('</div>', html.lastIndexOf('</div>') - 0) && idxP2 > idxP1);
    // Fractions : le PDF retire contenteditable (rendu statique) mais garde la classe
    check('E2E PDF : fraction rendue SANS contenteditable (sanitise) mais classe ah-frac conservée',
      html.includes('ah-frac') && !html.includes('contenteditable'));

    // Parent orphelin côté PDF (données anciennes corrompues) → racine, jamais perdu
    const html2 = testModule.buildEpreuvePdfHtml.call(fakeThis, {
      ...paper,
      sections: [
        { id: 'x1', title: 'Bloc perdu', content: '<p>Contenu.</p>', parentSectionId: 'fantome' },
      ],
    }, ctx);
    check('E2E PDF : parentSectionId orphelin → bloc rendu comme racine (jamais perdu)',
      html2.includes('>Bloc perdu<'));

    // Régression : sujet PLAT (sans parentSectionId) — rendu identique à avant
    const html3 = testModule.buildEpreuvePdfHtml.call(fakeThis, {
      ...paper,
      sections: [
        { id: 's1', title: 'Problème 1', content: '<p>A.</p>' },
        { id: 's2', title: 'Problème 2', content: '<p>B.</p>' },
      ],
    }, ctx);
    const rootCount3 = (html3.match(/class="section"/g) || []).length;
    const subCount3 = (html3.match(/class="section section-sub"/g) || []).length;
    check('E2E PDF : régression sujet PLAT — 4 blocs racines (Situation, Tâche, P1, P2), AUCUN section-sub',
      rootCount3 === 4 && subCount3 === 0, `racines : ${rootCount3}, sous-blocs : ${subCount3}`);
  } catch (e) {
    check('E2E buildEpreuvePdfHtml exécutable', false, e.message);
  }
}

// ══════════════════════════════════════════════════════════════════════
// 4. CONTRÔLES STRUCTURELS GLOBAUX (non-régression)
// ══════════════════════════════════════════════════════════════════════
console.log('\n── 4. Non-régression ──');

check('RichTextEditor : RESIZABLE_SELECTOR intact (ah-fig, ah-op, table, calli, img, svg)',
  rte.includes('"span.ah-fig", "span.ah-op", "table.ah-table", "div.calli-lines"'));
check('RichTextEditor : habillage toujours disponible pour les VRAIS médias (setWrapMode)',
  rte.includes('const setWrapMode') && rte.includes('ah-float-devant'));
check('RichTextEditor : MathPanel toujours branché (onInsertHtml)',
  rte.includes('<MathPanel'));
check('FederisEpreuvesPage : autosave + PDF + statuts intacts',
  page.includes('dirtyRef.current = true') && page.includes('/pdf') &&
  page.includes("changeStatus('VALIDATED')"));
check('FederisEpreuvesPage : sections envoyées telles quelles (parentSectionId inclus)',
  page.includes('sections: form.sections'));
check('Service : getEpreuve renvoie les sections brutes (hiérarchie conservée à l\'édition)',
  /sections: Array\.isArray\(paper\.sections\) \? paper\.sections : \[\]/.test(svc));
check('Service : sectionsCount toujours calculé (liste)',
  /sectionsCount: Array\.isArray\(p\.sections\)/.test(svc));

// ══════════════════════════════════════════════════════════════════════
console.log('\n════════════════════════════════════════════════════════════════════');
console.log(` RÉSULTAT : ${ok} ✅ / ${fail} ❌  (${ok + fail} contrôles)`);
console.log('════════════════════════════════════════════════════════════════════');
process.exit(fail ? 1 : 0);
