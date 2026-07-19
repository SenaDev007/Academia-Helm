/**
 * Templates de messages professionnels pour relancer les prospects
 * SaisieMaster par email ou WhatsApp.
 *
 * Chaque template a :
 *  - id : identifiant unique
 *  - canal : 'whatsapp' | 'email' | 'both'
 *  - category : 'presentation' | 'modules' | 'demo' | 'closing' | 'followup'
 *  - subject : sujet (pour email)
 *  - body : corps du message avec variables {firstName}, {schoolName}, {city}
 *
 * Les variables sont remplacées côté frontend avant ouverture du client
 * email/WhatsApp.
 */

export type TemplateChannel = 'whatsapp' | 'email' | 'both';
export type TemplateCategory =
  | 'presentation'
  | 'modules'
  | 'demo'
  | 'closing'
  | 'followup';

export interface ContactTemplate {
  id: string;
  name: string;
  channel: TemplateChannel;
  category: TemplateCategory;
  subject?: string;
  body: string;
}

export const CONTACT_TEMPLATES: ContactTemplate[] = [
  // ─── PRÉSENTATION GÉNÉRALE ────────────────────────────────────────────────
  {
    id: 'pres-whatsapp-1',
    name: 'Présentation WhatsApp — Accroche',
    channel: 'whatsapp',
    category: 'presentation',
    body: `Bonjour {firstName},

J'espère que vous allez bien. Je suis {adminName} d'Academia Helm, la plateforme complète de gestion scolaire au Bénin.

J'ai remarqué que vous utilisez SaisieMaster pour la saisie de vos notes EducMaster — c'est un excellent début !

Saviez-vous qu'Academia Helm offre bien plus ? Finances, élèves, bulletins, communication parents, site web... tout réuni dans une seule plateforme.

Auriez-vous 5 minutes cette semaine pour un échange rapide ?

Cordialement,
{adminName}
Academia Helm — YEHI OR Tech`,
  },
  {
    id: 'pres-email-1',
    name: 'Présentation Email — Complète',
    channel: 'email',
    category: 'presentation',
    subject: '{firstName}, découvrez Academia Helm — la plateforme complète pour {schoolName}',
    body: `Bonjour {firstName},

J'espère que vous allez bien.

Vous utilisez actuellement SaisieMaster pour la saisie de vos notes EducMaster, et nous en sommes ravis ! Mais saviez-vous qu'Academia Helm offre bien plus qu'une simple saisie de notes ?

Academia Helm est une plateforme complète de gestion scolaire qui peut transformer la façon dont vous gérez {schoolName} à {city}.

Tout ce qu'Academia Helm peut faire pour votre école :
📊 Finances & Comptabilité : frais de scolarité, encaissements, dépenses, multi-caisses, reçus PDF
👥 Élèves & Scolarité : inscriptions, cartes scolaires, transferts, dossiers complets
📝 Examens & Bulletins : saisie de notes, moyennes automatiques, bulletins PDF
💬 Communication : SMS, emails, WhatsApp aux parents
🏫 Site institutionnel : un site web professionnel pour votre école
👨‍🏫 RH & Personnel : contrats, paie, absences, congés
🌍 Option Bilingue : séparation matières francophones/anglophones

Le meilleur ? Vous pouvez exporter vos élèves ET vos notes au format EducMaster en un seul clic.

Auriez-vous 30 minutes cette semaine pour une démo gratuite ?

Cordialement,
{adminName}
Academia Helm — YEHI OR Tech
Parakou, Bénin`,
  },

  // ─── MODULES SPÉCIFIQUES ──────────────────────────────────────────────────
  {
    id: 'mod-finance-whatsapp',
    name: 'Module Finances — WhatsApp',
    channel: 'whatsapp',
    category: 'modules',
    body: `Bonjour {firstName},

Petite question : combien de temps passez-vous chaque jour à suivre les encaissements de {schoolName} ?

Avec Academia Helm, c'est instantané :
✅ Reçus PDF générés automatiquement
✅ SMS/WhatsApp envoyés aux parents après chaque paiement
✅ Bilan des encaissements en temps réel
✅ Multi-caisses pour suivre chaque source de revenu

Vous économisez des heures chaque semaine.

Démo gratuite de 30 min ?
{adminName}`,
  },
  {
    id: 'mod-bulletin-email',
    name: 'Bulletins PDF — Email',
    channel: 'email',
    category: 'modules',
    subject: 'Bulletins PDF automatiques pour {schoolName}',
    body: `Bonjour {firstName},

À l'approche de la fin du trimestre, le calcul des moyennes et l'édition des bulletins sont souvent un casse-tête.

Avec Academia Helm :
• Saisie des notes pendant l'année (comme SaisieMaster)
• Calcul automatique des moyennes par élève, par classe, par matière
• Génération de bulletins PDF en un clic
• Export EducMaster en un seul clic

Plus besoin de ressaisir les notes à la fin de l'année !

Souhaitez-vous voir une démo ?

Cordialement,
{adminName}
Academia Helm`,
  },
  {
    id: 'mod-communication-whatsapp',
    name: 'Communication Parents — WhatsApp',
    channel: 'whatsapp',
    category: 'modules',
    body: `Bonjour {firstName},

Savez-vous que les parents adorent recevoir des nouvelles de l'école de leurs enfants ?

Avec Academia Helm :
📱 SMS automatiques pour les absences
💬 Messages WhatsApp pour les annonces
📧 Emails pour les communications officielles
💳 Reçus de paiement envoyés automatiquement

Tout est intégré, pas besoin de plateforme externe.

Démo gratuite ?
{adminName}`,
  },

  // ─── DÉMO GRATUITE ────────────────────────────────────────────────────────
  {
    id: 'demo-whatsapp',
    name: 'Invitation Démo — WhatsApp',
    channel: 'whatsapp',
    category: 'demo',
    body: `Bonjour {firstName},

Pour vous montrer comment Academia Helm peut transformer la gestion de {schoolName}, je vous propose une démo GRATUITE de 30 minutes.

Pendant la démo, vous verrez :
✅ Comment importer vos élèves
✅ Comment saisir les notes (vous connaissez déjà avec SaisieMaster !)
✅ Comment générer des bulletins PDF
✅ Comment suivre les encaissements
✅ Comment communiquer avec les parents

Quels créneaux vous conviendraient cette semaine ?
- Mardi [heure] ?
- Mercredi [heure] ?
- Jeudi [heure] ?

{adminName}
Academia Helm`,
  },
  {
    id: 'demo-email',
    name: 'Invitation Démo — Email',
    channel: 'email',
    category: 'demo',
    subject: 'Démo gratuite Academia Helm pour {schoolName}',
    body: `Bonjour {firstName},

Pour vous montrer concrètement comment Academia Helm peut transformer la gestion de {schoolName}, je vous propose une démo gratuite de 30 minutes.

Pendant la démo, vous verrez :
• Comment importer vos élèves et générer des cartes scolaires
• Comment saisir les notes (vous connaissez déjà avec SaisieMaster !)
• Comment générer des bulletins PDF automatiquement
• Comment suivre les encaissements et éditer des reçus
• Comment communiquer avec les parents par SMS, email et WhatsApp

Cette démo est 100% gratuite et sans engagement.

Quels créneaux vous conviendraient cette semaine ?
- Mardi à [heure]
- Mercredi à [heure]
- Jeudi à [heure]

Répondez simplement à cet email avec votre préférence.

Cordialement,
{adminName}
Academia Helm — YEHI OR Tech
Parakou, Bénin`,
  },

  // ─── CLOSING ──────────────────────────────────────────────────────────────
  {
    id: 'closing-offre',
    name: 'Offre Spéciale — Email Closing',
    channel: 'email',
    category: 'closing',
    subject: 'Offre spéciale pour {schoolName} — Frais d\'installation réduits',
    body: `Bonjour {firstName},

J'ai une excellente nouvelle pour vous.

En tant qu'utilisateur de SaisieMaster, vous bénéficiez d'une offre spéciale :
🎁 Frais d'installation réduits pour {schoolName}

Mentionnez le code SAISIEMASTER2026 lors de votre inscription.

Sans Academia Helm :
❌ Saisie manuelle des notes
❌ Cahiers pour les encaissements
❌ Communication parentale limitée

Avec Academia Helm :
✅ Notes saisies pendant l'année, export automatique
✅ Reçus PDF + SMS/WhatsApp automatiques
✅ Cartes scolaires avec QR code en 1 clic
✅ Site institutionnel personnalisé inclus

Cette offre est valable jusqu'à la fin du mois.

Cordialement,
{adminName}
Academia Helm`,
  },
  {
    id: 'closing-urgence-whatsapp',
    name: 'Dernière Chance — WhatsApp',
    channel: 'whatsapp',
    category: 'closing',
    body: `Bonjour {firstName},

C'est notre dernier message à propos d'Academia Helm pour {schoolName}.

Offre spéciale SaisieMaster :
🎁 Frais d'installation réduits
Code : SAISIEMASTER2026

Vous ne recevrez plus d'autres messages de notre part.

Mais n'hésitez pas à revenir quand vous serez prêt !
{adminName}
Academia Helm`,
  },

  // ─── FOLLOW-UP ────────────────────────────────────────────────────────────
  {
    id: 'followup-whatsapp',
    name: 'Relance douce — WhatsApp',
    channel: 'whatsapp',
    category: 'followup',
    body: `Bonjour {firstName},

Je me permets de revenir vers vous concernant Academia Helm pour {schoolName}.

Avez-vous eu le temps de réfléchir à ma proposition de démo gratuite ?

Je suis disponible cette semaine si vous avez 30 minutes à accorder.

Cordialement,
{adminName}`,
  },
  {
    id: 'followup-email',
    name: 'Relance douce — Email',
    channel: 'email',
    category: 'followup',
    subject: 'Une nouvelle pour {schoolName} ?',
    body: `Bonjour {firstName},

Je me permets de revenir vers vous concernant Academia Helm pour {schoolName}.

Avez-vous eu le temps de réfléchir à ma proposition de démo gratuite ?

Je suis disponible cette semaine si vous avez 30 minutes à accorder. Répondez simplement à cet email avec un créneau qui vous convient.

Cordialement,
{adminName}
Academia Helm`,
  },
];

/**
 * Remplace les variables {firstName}, {schoolName}, {city}, {adminName}
 * par leurs valeurs dans un template.
 */
export function fillTemplate(
  body: string,
  vars: { firstName: string; schoolName: string; city: string; adminName: string },
): string {
  return body
    .replace(/\{firstName\}/g, vars.firstName || '')
    .replace(/\{schoolName\}/g, vars.schoolName || '')
    .replace(/\{city\}/g, vars.city || '')
    .replace(/\{adminName\}/g, vars.adminName || '');
}

/**
 * Génère l'URL WhatsApp avec le message pré-rempli.
 * Le numéro doit être au format international sans '+' ni espaces.
 */
export function buildWhatsAppUrl(phoneNumber: string, message: string): string {
  const cleaned = phoneNumber.replace(/[^\d]/g, '');
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${cleaned}?text=${encoded}`;
}

/**
 * Génère l'URL mailto avec sujet et corps pré-remplis.
 */
export function buildMailtoUrl(
  email: string,
  subject: string,
  body: string,
): string {
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  return `mailto:${email}?subject=${encodedSubject}&body=${encodedBody}`;
}
