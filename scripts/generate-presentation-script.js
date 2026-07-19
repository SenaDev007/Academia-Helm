/**
 * Script de présentation vidéo — Academia Helm + SaisieMaster
 * Génère un document DOCX avec le script complet de présentation.
 */

const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
        PageBreak, TabStopType, TabStopPosition, BorderStyle } = require('docx');
const fs = require('fs');

// Palette Academia Helm
const NAVY = '0D1F6E';
const BLUE = '1A237E';
const GOLD = 'F5B335';
const DARK = '1F2937';
const GRAY = '6B7280';

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, color: NAVY, font: 'Calibri' })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 160 },
    children: [new TextRun({ text, bold: true, size: 26, color: BLUE, font: 'Calibri' })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 220, after: 120 },
    children: [new TextRun({ text, bold: true, size: 22, color: DARK, font: 'Calibri' })],
  });
}

function p(text, opts = {}) {
  const runs = [];
  // Handle bold markers **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, size: 22, color: opts.color || DARK, font: 'Calibri' }));
    } else {
      runs.push(new TextRun({ text: part, size: 22, color: opts.color || DARK, font: 'Calibri', italics: opts.italics || false }));
    }
  }
  return new Paragraph({
    spacing: { after: 120, line: 312 },
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: runs,
  });
}

function bullet(text) {
  return new Paragraph({
    spacing: { after: 80, line: 312 },
    indent: { left: 720 },
    children: [
      new TextRun({ text: '• ', size: 22, color: GOLD, font: 'Calibri' }),
      new TextRun({ text, size: 22, color: DARK, font: 'Calibri' }),
    ],
  });
}

function sceneMarker(text) {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({ text: `🎬 ${text}`, bold: true, size: 22, color: GOLD, font: 'Calibri' }),
    ],
  });
}

function narrator(text) {
  return new Paragraph({
    spacing: { after: 100, line: 312 },
    indent: { left: 360 },
    children: [
      new TextRun({ text: '🎙️ ', size: 22, font: 'Calibri' }),
      new TextRun({ text, size: 22, color: DARK, font: 'Calibri' }),
    ],
  });
}

function action(text) {
  return new Paragraph({
    spacing: { after: 80, line: 312 },
    indent: { left: 360 },
    children: [
      new TextRun({ text: '📹 ', size: 22, font: 'Calibri' }),
      new TextRun({ text, size: 20, color: GRAY, font: 'Calibri', italics: true }),
    ],
  });
}

function divider() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { color: 'E5E7EB', space: 1, style: BorderStyle.SINGLE, size: 6 } },
    children: [new TextRun({ text: '' })],
  });
}

function emptyLine() {
  return new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: '' })] });
}

const doc = new Document({
  sections: [{
    properties: {
      page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
    },
    children: [
      // === PAGE DE GARDE ===
      new Paragraph({ spacing: { before: 2400 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'SCRIPT DE PRÉSENTATION VIDÉO', bold: true, size: 44, color: NAVY, font: 'Calibri' })] }),
      new Paragraph({ spacing: { before: 200 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Academia Helm & SaisieMaster', bold: true, size: 36, color: GOLD, font: 'Calibri' })] }),
      new Paragraph({ spacing: { before: 400 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Présentation complète à destination des promoteurs et directeurs d\'écoles', size: 24, color: GRAY, font: 'Calibri', italics: true })] }),
      new Paragraph({ spacing: { before: 600 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Durée estimée : 15-20 minutes', size: 22, color: DARK, font: 'Calibri' })] }),
      new Paragraph({ spacing: { before: 100 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Format : Capture vidéo (screen recording)', size: 22, color: DARK, font: 'Calibri' })] }),
      new Paragraph({ spacing: { before: 100 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'YEHI OR Tech — Juillet 2026', size: 22, color: GRAY, font: 'Calibri' })] }),

      new Paragraph({ children: [new PageBreak()] }),

      // === TABLE DES MATIÈRES ===
      h1('Table des matières'),
      p('1. Introduction et accroche'),
      p('2. Présentation d\'Academia Helm (teaser marketing)'),
      p('3. Présentation de SaisieMaster — La solution gratuite'),
      p('4. Démonstration : Création de compte'),
      p('5. Démonstration : Import du template EducMaster'),
      p('6. Démonstration : Saisie des notes (par matière et par élève)'),
      p('7. Démonstration : Enregistrement et persistance'),
      p('8. Démonstration : Export Excel au format EducMaster'),
      p('9. Démonstration : Mes classes, Mes fichiers, Historique, Paramètres'),
      p('10. Transition marketing : Pourquoi passer à Academia Helm ?'),
      p('11. Appel à l\'action et conclusion'),
      p('12. Annexe : FAQs et informations pratiques'),

      new Paragraph({ children: [new PageBreak()] }),

      // === SECTION 1: INTRODUCTION ===
      h1('1. Introduction et accroche'),
      sceneMarker('Ouverture — 30 secondes'),
      action('Écran : page d\'accueil de SaisieMaster (saisiemaster.academiahelm.com) avec l\'image de fond du hero bien visible.'),
      emptyLine(),

      narrator('Bonjour à tous, chers directeurs et promoteurs d\'écoles. Si vous regardez cette vidéo, c\'est parce que vous connaissez sûrement la galère annuelle : la saisie des notes sur EducMaster.'),
      narrator('Chaque fin d\'année, c\'est la même chose. Vous téléchargez le template Excel, vous remplissez case par case, vous vérifiez, vous corrigez, vous re-vérifiez... Et si une erreur s\'est glissée, tout est à refaire.'),
      narrator('Aujourd\'hui, je vais vous présenter un outil qui va révolutionner cette tâche : SaisieMaster. Et en bonus, je vous montrerai comment aller bien plus loin avec Academia Helm, la plateforme complète de gestion scolaire.'),

      divider(),

      // === SECTION 2: ACADEMIA HELM TEASER ===
      h1('2. Présentation d\'Academia Helm (teaser marketing)'),
      sceneMarker('Transition — 1 minute 30'),
      action('Écran : capture du site principal academiahelm.com — landing page premium avec les modules.'),

      emptyLine(),
      p('**Objectif** : Planter le décor en 90 secondes. Ne pas tout montrer, juste susciter la curiosité. Le détail viendra à la fin.', { italics: true }),

      narrator('Mais avant de rentrer dans le vif du sujet, laissez-moi vous parler brièvement d\'Academia Helm. C\'est la plateforme qui a rendu SaisieMaster possible.'),
      narrator('Academia Helm, c\'est bien plus qu\'un simple outil de saisie de notes. C\'est une plateforme complète de gestion d\'établissement scolaire, développée ici au Bénin par YEHI OR Tech.'),

      h3('Ce que Academia Helm fait (à montrer rapidement) :'),
      bullet('Gestion financière : suivi des frais de scolarité, encaissements, dépenses, multi-caisses, reçus PDF, SMS et WhatsApp aux parents'),
      bullet('Gestion des élèves : inscriptions, dossiers complets, cartes scolaires avec QR code, transferts'),
      bullet('Examens et bulletins : saisie des notes, calcul automatique des moyennes, bulletins PDF'),
      bullet('Communication : SMS, emails, WhatsApp directement depuis la plateforme'),
      bullet('RH et personnel : contrats, paie, absences, congés'),
      bullet('Site institutionnel : un site web professionnel pour votre école'),
      bullet('Et bien plus : boutique, cantine, transport, infirmerie, ORION (IA de pilotage)...'),

      narrator('Tout ça dans une seule plateforme, accessible depuis n\'importe quel appareil — ordinateur, tablette ou smartphone.'),
      narrator('Mais je reviendrai là-dessus à la fin. Pour l\'instant, concentrons-nous sur SaisieMaster, qui est totalement gratuit.'),

      divider(),

      // === SECTION 3: SAISIEMASTER ===
      h1('3. Présentation de SaisieMaster — La solution gratuite'),
      sceneMarker('Présentation — 1 minute'),
      action('Écran : retour sur saisiemaster.academiahelm.com, scroll lent de la landing page.'),

      narrator('SaisieMaster, c\'est simple : c\'est un outil gratuit qui vous permet de saisir les notes de vos élèves de manière fluide, guidée et conforme au format EducMaster du gouvernement béninois.'),
      narrator('Vous importez le template Excel que vous avez téléchargé depuis EducMaster, vous saisissez les notes dans une interface pensée pour les enseignants, et vous exportez un fichier prêt à être réimporté — sans aucune altération du format officiel.'),
      narrator('Et le meilleur ? C\'est gratuit. Aucun engagement, aucune limite. Créez simplement votre compte et commencez.'),

      divider(),

      // === SECTION 4: CRÉATION DE COMPTE ===
      h1('4. Démonstration : Création de compte'),
      sceneMarker('Démonstration — 1 minute'),
      action('Écran : cliquer sur "Commencer gratuitement". Remplir le formulaire : Prénom, Nom, École, Email, Mot de passe.'),

      narrator('Commençons par la création de compte. Cliquez sur "Commencer gratuitement".'),
      narrator('Remplissez simplement votre prénom, votre nom, le nom de votre école, votre adresse email, et choisissez un mot de passe. C\'est tout.'),
      action('Saisir : Sènakpon, AKPOVI, Academia Helm, s.akpovitohou@gmail.com, mot de passe. Cliquer sur "Commencer gratuitement".'),
      narrator('Et voilà ! Le compte est créé. Vous êtes automatiquement connecté et pouvez commencer à utiliser SaisieMaster.'),
      action('Montrer le badge "SA Sènakpon" en haut à droite — l\'utilisateur est connecté.'),

      divider(),

      // === SECTION 5: IMPORT TEMPLATE ===
      h1('5. Démonstration : Import du template EducMaster'),
      sceneMarker('Démonstration — 1 minute'),
      action('Écran : cliquer sur "Importer un template". Sélectionner le fichier Excel EducMaster.'),

      narrator('Maintenant, importons le template EducMaster. Cliquez sur "Importer un template" ou "Importer un fichier Excel EducMaster".'),
      narrator('Sélectionnez le fichier que vous avez téléchargé depuis la plateforme EducMaster. SaisieMaster va l\'analyser automatiquement.'),
      action('Sélectionner le fichier .xlsx. L\'import se fait automatiquement.'),
      narrator('Et voilà ! SaisieMaster a reconnu la classe — ici CI — les élèves, et toutes les matières avec leurs colonnes. Tout est prêt pour la saisie.'),

      divider(),

      // === SECTION 6: SAISIE DES NOTES ===
      h1('6. Démonstration : Saisie des notes'),
      sceneMarker('Démonstration — 3 minutes'),
      action('Écran : le tableau de saisie avec les élèves en lignes et les matières en colonnes.'),

      h3('6.1 Mode "Par matière" (par défaut)'),
      narrator('Par défaut, SaisieMaster affiche les notes "par matière". Vous voyez tous les élèves en lignes et les matières en colonnes.'),
      narrator('Saisissons quelques notes. Pour chaque matière, vous avez deux colonnes : la note obtenue sur 18 et la note de perfectionnement sur 2. Le total se calcule automatiquement sur 20.'),
      action('Saisir : Dictée — élève 1 : 14/18 + 1/2. Math — élève 1 : 15/18 + 2/2.'),
      narrator('Remarquez les couleurs : les notes sont colorées automatiquement. Vert pour les bonnes notes (14 et plus), orange pour les moyennes (10 à 13), rouge pour les notes en dessous de 10. Cela vous donne un aperçu immédiat du niveau de la classe.'),

      h3('6.2 Mode "Par élève"'),
      narrator('Maintenant, cliquons sur l\'onglet "Par élève". Ici, vous choisissez un élève dans le sélecteur, et toutes ses matières s\'affichent en lignes.'),
      action('Cliquer sur "Par élève". Sélectionner un élève. Saisir quelques notes.'),
      narrator('C\'est très pratique quand vous voulez saisir toutes les notes d\'un élève d\'un coup, par exemple après avoir reçu son bulletin de l\'année précédente.'),

      divider(),

      // === SECTION 7: ENREGISTREMENT ===
      h1('7. Démonstration : Enregistrement et persistance'),
      sceneMarker('Démonstration — 1 minute'),
      action('Écran : cliquer sur "Enregistrer".'),

      narrator('Une fois vos notes saisies, cliquez sur "Enregistrer". Vos données sont sauvegardées automatiquement, à la fois sur votre appareil et sur nos serveurs sécurisés.'),
      action('Cliquer sur Enregistrer. Montrer le message "Modifications enregistrées avec succès".'),
      narrator('Cela signifie que même si vous fermez votre navigateur ou changez d\'ordinateur, vos saisies sont conservées. Il vous suffit de vous reconnecter avec votre email et mot de passe pour retrouver toutes vos données.'),

      divider(),

      // === SECTION 8: EXPORT ===
      h1('8. Démonstration : Export Excel au format EducMaster'),
      sceneMarker('Démonstration — 1 minute'),
      action('Écran : cliquer sur "Exporter Excel".'),

      narrator('Maintenant, l\'étape la plus importante : l\'export. Cliquez sur "Exporter Excel".'),
      action('Cliquer sur Exporter Excel. La boîte de dialogue s\'ouvre. Cliquer sur "Générer le fichier".'),
      narrator('SaisieMaster génère un fichier Excel strictement conforme au format EducMaster. Le fichier est téléchargé automatiquement.'),
      action('Montrer le message "Export réussi ! Le fichier a été téléchargé."'),
      narrator('Vous pouvez maintenant importer ce fichier directement dans la plateforme EducMaster du gouvernement. Aucune modification manuelle n\'est nécessaire — le format est identique à l\'original.'),

      divider(),

      // === SECTION 9: SIDEBAR ===
      h1('9. Démonstration : Mes classes, Mes fichiers, Historique, Paramètres'),
      sceneMarker('Démonstration — 2 minutes'),

      h3('9.1 Mes classes'),
      action('Cliquer sur "Mes classes" dans la sidebar.'),
      narrator('Dans "Mes classes", vous retrouvez toutes les classes que vous avez importées. Chaque carte vous montre le nombre d\'élèves, le nombre de matières, et le pourcentage de saisie complétée.'),
      narrator('Vous pouvez rouvrir une classe d\'un clic, ou en supprimer une.'),

      h3('9.2 Mes fichiers'),
      action('Cliquer sur "Mes fichiers" dans la sidebar.'),
      narrator('"Mes fichiers" liste toutes vos sessions de saisie sauvegardées. Chaque session correspond à une classe avec ses notes. Vous pouvez en ouvrir une pour reprendre la saisie, ou en supprimer une ancienne.'),

      h3('9.3 Historique'),
      action('Cliquer sur "Historique" dans la sidebar.'),
      narrator('"Historique" vous donne un récapitulatif de votre activité : nombre de connexions, nombre de notes saisies, nombre d\'exports effectués.'),

      h3('9.4 Paramètres'),
      action('Cliquer sur "Paramètres" dans la sidebar.'),
      narrator('Dans "Paramètres", vous pouvez modifier vos informations personnelles : prénom, nom, nom de l\'école, téléphone, ville. Vous pouvez aussi vous déconnecter.'),

      divider(),

      // === SECTION 10: TRANSITION MARKETING ===
      h1('10. Transition marketing : Pourquoi passer à Academia Helm ?'),
      sceneMarker('Transition marketing — 2 minutes 30'),
      action('Écran : basculer vers academiahelm.com. Montrer la landing page, puis le dashboard d\'une école.'),

      narrator('Voilà, vous avez vu SaisieMaster en action. Simple, fluide, gratuit. Mais imaginez maintenant si vous aviez TOUT cela integré dans une seule plateforme qui gère l\'ensemble de votre école.'),
      narrator('C\'est exactement ce que fait Academia Helm.'),

      h3('Avec Academia Helm, vous avez :'),

      h3('📊 Gestion financière complète'),
      narrator('Plus besoin de trackers Excel ou de cahiers. Academia Helm gère les frais de scolarité par classe et par niveau, les tranches de paiement, les encaissements, les dépenses, les multi-caisses. Chaque paiement génère un reçu PDF automatique, avec envoi de SMS et WhatsApp aux parents.'),

      h3('👥 Gestion des élèves'),
      narrator('Inscriptions en ligne, dossiers complets avec photos, cartes scolaires avec QR code de vérification, transferts entre classes et entre écoles. Le tout avec un import en masse depuis Excel.'),

      h3('📝 Examens et bulletins'),
      narrator('Saisie des notes au fil de l\'année, calcul automatique des moyennes, génération de bulletins PDF personnalisés. Et surtout : export direct au format EducMaster, comme SaisieMaster, mais sans avoir à re-saisir quoi que ce soit.'),

      h3('💬 Communication'),
      narrator('Envoyez des SMS, des emails et des messages WhatsApp aux parents directement depuis la plateforme. Reçus de paiement, rappels de recouvrement, convocations, tout est automatisé.'),

      h3('🏫 Site institutionnel'),
      narrator('Chaque école dispose de son propre site web professionnel, avec son logo, ses couleurs, ses actualités. Les parents peuvent s\'y pré-inscrire en ligne.'),

      h3('Et bien plus encore...'),
      bullet('RH et personnel : contrats, paie, absences, congés'),
      bullet('Boutique scolaire : vente d\'uniformes, de fournitures, encaissement intégré'),
      bullet('Transport et cantine : gestion des bus et des repas'),
      bullet('ORION : intelligence artificielle pour le pilotage de la direction'),
      bullet('Application installable (PWA) sur téléphone et ordinateur'),

      narrator('Le meilleur ? SaisieMaster est inclus dans Academia Helm. En tant que client Academia Helm, vous n\'avez pas besoin de re-saisir vos notes : elles sont déjà dans le système. Et l\'export EducMaster se fait en un clic depuis le module Examens.'),

      divider(),

      // === SECTION 11: APPEL À L'ACTION ===
      h1('11. Appel à l\'action et conclusion'),
      sceneMarker('Conclusion — 1 minute'),
      action('Écran : revenir sur SaisieMaster, montrer la section "Découvrir Academia Helm" en bas de page.'),

      narrator('Alors, comment commencer ?'),
      narrator('Première étape : si vous ne l\'avez pas déjà fait, créez votre compte gratuit sur SaisieMaster. C\'est sans engagement. Allez sur saisiemaster.academiahelm.com et commencez dès aujourd\'hui.'),
      narrator('Deuxième étape : si vous voulez aller plus loin et gérer toute votre école avec Academia Helm, demandez une démonstration gratuite. Rendez-vous sur academiahelm.com et cliquez sur "Demander une démo gratuite".'),
      narrator('Nos équipes vous accompagneront dans la mise en place de la plateforme pour votre établissement, avec formation complète et support continu.'),
      narrator('Merci d\'avoir regardé cette présentation. SaisieMaster est gratuit, alors n\'hésitez pas à le partager avec vos collègues directeurs. Et pour ceux qui veulent la solution complète, Academia Helm vous attend.'),

      action('Écran final : logo SaisieMaster + logo YEHI OR Tech + URL saisiemaster.academiahelm.com + academiahelm.com'),

      divider(),

      // === SECTION 12: ANNEXE ===
      h1('12. Annexe : FAQs et informations pratiques'),

      h3('SaisieMaster est-il vraiment gratuit ?'),
      p('Oui, SaisieMaster est 100% gratuit, sans limite de temps ni de nombre d\'élèves. Vous créez un compte avec votre email et un mot de passe, et vous pouvez utiliser l\'outil autant que vous voulez.'),

      h3('Mes données sont-elles en sécurité ?'),
      p('Oui. Vos données sont stockées sur des serveurs sécurisés. Elles ne sont jamais partagées avec des tiers. Vous pouvez supprimer votre compte et toutes vos données à tout moment.'),

      h3('Quel format de fichier SaisieMaster accepte-t-il ?'),
      p('SaisieMaster accepte les fichiers Excel (.xlsx) au format EducMaster. C\'est le fichier que vous téléchargez depuis la plateforme EducMaster du gouvernement béninois.'),

      h3('L\'export est-il conforme au format EducMaster ?'),
      p('Oui, l\'export génère un fichier strictement identique au template officiel. Vous pouvez l\'importer directement dans EducMaster sans aucune modification.'),

      h3('Puis-je utiliser SaisieMaster sur mon téléphone ?'),
      p('Oui, SaisieMaster est entièrement responsive. Il fonctionne sur ordinateur, tablette et smartphone. Vous pouvez même l\'installer comme application sur votre téléphone (PWA).'),

      h3('Comment passer à Academia Helm ?'),
      p('Rendez-vous sur academiahelm.com et cliquez sur "Demander une démo gratuite". Nos équipes vous contacteront pour planifier une démonstration et une mise en place personnalisée pour votre établissement.'),

      h3('Quels sont les tarifs d\'Academia Helm ?'),
      p('Academia Helm propose 3 plans : SEED (20 000 FCFA/mois, ≤ 200 élèves), GROW (35 000 FCFA/mois, ≤ 700 élèves) et LEAD (50 000 FCFA/mois, ≤ 1500 élèves). Des frais d\'installation uniques s\'appliquent (100 000 à 300 000 FCFA selon le plan). Les add-ons (SMS, emails) sont facturés à l\'usage.'),

      emptyLine(),
      divider(),
      emptyLine(),

      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400 },
        children: [
          new TextRun({ text: '— Fin du script —', italics: true, size: 20, color: GRAY, font: 'Calibri' }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
        children: [
          new TextRun({ text: 'YEHI OR Tech — Academia Helm', size: 20, color: NAVY, font: 'Calibri', bold: true }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'saisiemaster.academiahelm.com  |  academiahelm.com', size: 18, color: GRAY, font: 'Calibri' }),
        ],
      }),
    ],
  }],
});

const outputPath = '/home/z/my-project/download/Script_Presentation_Video_Academia_Helm_SaisieMaster.docx';

Packer.toBuffer(doc).then(buffer => {
  const dir = require('path').dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  console.log('✅ Document généré : ' + outputPath);
  console.log('   Taille : ' + (buffer.length / 1024).toFixed(1) + ' KB');
}).catch(err => {
  console.error('❌ Erreur :', err);
  process.exit(1);
});
