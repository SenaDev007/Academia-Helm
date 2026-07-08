/**
 * ============================================================================
 * MODAL DOCUMENTATION COMPTABILITÉ
 * ============================================================================
 *
 * Modal intégré dans l'application qui affiche toute la documentation
 * sur l'intégration comptable d'Academia Helm (FEC, OHADA, CSV universel).
 *
 * Accessible depuis Paramètres > Finance > Export comptable automatique
 * via un lien cliquable « Voir la documentation ».
 *
 * Contenu structuré en sections navigables :
 *   1. Standards supportés (FEC, OHADA, CSV)
 *   2. Plan comptable OHADA pré-mappé
 *   3. Journaux comptables
 *   4. Workflow d'export
 *   5. Compatibilité par logiciel
 *   6. Mapping des comptes
 *   7. Exemple de fichier FEC
 * ============================================================================
 */
'use client';

import { useState } from 'react';
import { X, BookOpen, FileText, Database, Workflow, CheckCircle2, Code, ChevronDown, ChevronRight } from 'lucide-react';

interface DocSection {
  id: string;
  title: string;
  icon: any;
  content: React.ReactNode;
}

const SECTIONS: DocSection[] = [
  {
    id: 'standards',
    title: 'Standards d\'export supportés',
    icon: FileText,
    content: (
      <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
        <div>
          <h4 className="font-semibold text-slate-900 mb-2">1. FEC (Fichier d'Écritures Comptables) — France</h4>
          <p className="mb-2">Le <strong>FEC</strong> est le format normalisé imposé par l'administration fiscale française depuis 2014 (article A.47 A-1 du LPF). Tout logiciel comptable doit pouvoir générer un FEC pour un contrôle fiscal. Academia Helm peut générer un <strong>FEC directement exportable</strong> vers :</p>
          <ul className="list-disc list-inside ml-4 space-y-1 text-slate-600">
            <li>Sage 100 / Sage 1000</li>
            <li>Ciel Compta / Ciel Compta Evolution</li>
            <li>EBP Compta</li>
            <li>QuickBooks</li>
            <li>Pennylane</li>
            <li>Yooz</li>
            <li>Dex</li>
            <li>Odoo (module account_fec_import)</li>
          </ul>
          <p className="mt-2 text-xs text-slate-500"><strong>Format</strong> : fichier <code className="bg-slate-100 px-1 rounded">.txt</code> encodé en UTF-8, séparateur <code className="bg-slate-100 px-1 rounded">|</code>, 18 colonnes obligatoires.</p>
        </div>
        <div>
          <h4 className="font-semibold text-slate-900 mb-2">2. Référentiel OHADA — Bénin et Afrique francophone</h4>
          <p className="mb-2">Le Bénin applique le <strong>SYSCOHADA</strong> (Système Comptable OHADA), qui définit le plan comptable OHADA et le format des états financiers annuels. Academia Helm utilise nativement ce référentiel :</p>
          <ul className="list-disc list-inside ml-4 space-y-1 text-slate-600">
            <li>Plan comptable OHADA (classes 1 à 8)</li>
            <li>Journal comptable normalisé</li>
            <li>Balance des comptes</li>
            <li>Compte de résultat</li>
            <li>Bilan</li>
          </ul>
          <p className="mt-2 text-xs text-slate-500"><strong>Export OHADA</strong> : fichier <code className="bg-slate-100 px-1 rounded">.csv</code> ou <code className="bg-slate-100 px-1 rounded">.xlsx</code> conforme au format SYSCOHADA, séparateur <code className="bg-slate-100 px-1 rounded">;</code>.</p>
        </div>
        <div>
          <h4 className="font-semibold text-slate-900 mb-2">3. Format universel CSV/Excel</h4>
          <p>Pour les logiciels qui ne supportent ni FEC ni OHADA, Academia Helm propose un <strong>export CSV universel</strong> avec mapping de colonnes configurable. L'utilisateur peut télécharger le modèle d'import de son logiciel comptable, puis mapper les colonnes Academia Helm vers les colonnes attendues.</p>
        </div>
      </div>
    ),
  },
  {
    id: 'plan-comptable',
    title: 'Plan comptable OHADA pré-mappé',
    icon: Database,
    content: (
      <div className="space-y-3 text-sm text-slate-700">
        <p>Academia Helm propose un <strong>plan comptable OHADA pré-mappé</strong> par défaut pour les écoles :</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Classe</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Compte</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Libellé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr><td className="px-3 py-1.5">4</td><td className="px-3 py-1.5 font-mono">411000</td><td className="px-3 py-1.5">Élèves — Créances scolaires</td></tr>
              <tr><td className="px-3 py-1.5">4</td><td className="px-3 py-1.5 font-mono">419000</td><td className="px-3 py-1.5">Élèves — Avances reçues</td></tr>
              <tr><td className="px-3 py-1.5">4</td><td className="px-3 py-1.5 font-mono">401000</td><td className="px-3 py-1.5">Fournisseurs</td></tr>
              <tr><td className="px-3 py-1.5">5</td><td className="px-3 py-1.5 font-mono">521000</td><td className="px-3 py-1.5">Banque — Compte courant</td></tr>
              <tr><td className="px-3 py-1.5">5</td><td className="px-3 py-1.5 font-mono">571000</td><td className="px-3 py-1.5">Caisse principale</td></tr>
              <tr><td className="px-3 py-1.5">5</td><td className="px-3 py-1.5 font-mono">572000</td><td className="px-3 py-1.5">Caisse secondaire</td></tr>
              <tr><td className="px-3 py-1.5">6</td><td className="px-3 py-1.5 font-mono">601000</td><td className="px-3 py-1.5">Achats de fournitures scolaires</td></tr>
              <tr><td className="px-3 py-1.5">6</td><td className="px-3 py-1.5 font-mono">605000</td><td className="px-3 py-1.5">Achats de matériel pédagogique</td></tr>
              <tr><td className="px-3 py-1.5">6</td><td className="px-3 py-1.5 font-mono">613000</td><td className="px-3 py-1.5">Loyers payés</td></tr>
              <tr><td className="px-3 py-1.5">6</td><td className="px-3 py-1.5 font-mono">614000</td><td className="px-3 py-1.5">Entretien et réparations</td></tr>
              <tr><td className="px-3 py-1.5">6</td><td className="px-3 py-1.5 font-mono">615000</td><td className="px-3 py-1.5">Frais de conservation (eau, électricité)</td></tr>
              <tr><td className="px-3 py-1.5">6</td><td className="px-3 py-1.5 font-mono">621000</td><td className="px-3 py-1.5">Transport du personnel</td></tr>
              <tr><td className="px-3 py-1.5">6</td><td className="px-3 py-1.5 font-mono">625000</td><td className="px-3 py-1.5">Frais de réception</td></tr>
              <tr><td className="px-3 py-1.5">6</td><td className="px-3 py-1.5 font-mono">631000</td><td className="px-3 py-1.5">Frais financiers (commissions Fedapay)</td></tr>
              <tr><td className="px-3 py-1.5">6</td><td className="px-3 py-1.5 font-mono">641000</td><td className="px-3 py-1.5">Rémunérations du personnel</td></tr>
              <tr><td className="px-3 py-1.5">6</td><td className="px-3 py-1.5 font-mono">645000</td><td className="px-3 py-1.5">Charges sociales</td></tr>
              <tr><td className="px-3 py-1.5">7</td><td className="px-3 py-1.5 font-mono">706100</td><td className="px-3 py-1.5">Scolarité — Frais d'inscription</td></tr>
              <tr><td className="px-3 py-1.5">7</td><td className="px-3 py-1.5 font-mono">706200</td><td className="px-3 py-1.5">Scolarité — Frais de scolarité</td></tr>
              <tr><td className="px-3 py-1.5">7</td><td className="px-3 py-1.5 font-mono">706300</td><td className="px-3 py-1.5">Scolarité — Frais d'examen</td></tr>
              <tr><td className="px-3 py-1.5">7</td><td className="px-3 py-1.5 font-mono">706400</td><td className="px-3 py-1.5">Cantine scolaire</td></tr>
              <tr><td className="px-3 py-1.5">7</td><td className="px-3 py-1.5 font-mono">706500</td><td className="px-3 py-1.5">Transport scolaire</td></tr>
              <tr><td className="px-3 py-1.5">7</td><td className="px-3 py-1.5 font-mono">706600</td><td className="px-3 py-1.5">Activités parascolaires</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-2">Chaque catégorie de dépense dans Academia Helm peut être <strong>mappée à un compte OHADA précis</strong> dans le paramétrage (Onglet Dépenses → Catégories → Modifier → Compte OHADA).</p>
      </div>
    ),
  },
  {
    id: 'journaux',
    title: 'Journaux comptables',
    icon: BookOpen,
    content: (
      <div className="space-y-3 text-sm text-slate-700">
        <p>Academia Helm génère <strong>4 journaux comptables distincts</strong> :</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="font-semibold text-blue-900">JVT — Journal des ventes</p>
            <p className="text-xs text-blue-700 mt-1">Tous les encaissements de frais scolaires</p>
          </div>
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
            <p className="font-semibold text-rose-900">JAC — Journal des achats</p>
            <p className="text-xs text-rose-700 mt-1">Toutes les dépenses approuvées</p>
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="font-semibold text-emerald-900">JQC — Journal de caisse</p>
            <p className="text-xs text-emerald-700 mt-1">Mouvements d'espèces (multi-caisses)</p>
          </div>
          <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
            <p className="font-semibold text-violet-900">JQB — Journal de banque</p>
            <p className="text-xs text-violet-700 mt-1">Mouvements Mobile Money, Fedapay, virements</p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">Chaque écriture porte le numéro de pièce, la date, le code journal, le compte général OHADA, le compte tiers, le libellé et les montants débit/crédit.</p>
      </div>
    ),
  },
  {
    id: 'workflow',
    title: "Workflow d'export",
    icon: Workflow,
    content: (
      <div className="space-y-4 text-sm text-slate-700">
        <div>
          <h4 className="font-semibold text-slate-900 mb-2">Export manuel (à la demande)</h4>
          <ol className="list-decimal list-inside ml-4 space-y-1 text-slate-600">
            <li>Allez dans <strong>Finance → Rapports financiers → Bilan périodique</strong></li>
            <li>Sélectionnez la période (date de début + date de fin)</li>
            <li>Cliquez sur <strong>« Export comptable »</strong> (bouton violet)</li>
            <li>Choisissez le format : FEC, OHADA ou CSV universel</li>
            <li>Le fichier se télécharge automatiquement</li>
            <li>Importez-le dans votre logiciel comptable via « Importer un FEC » ou « Importer des écritures »</li>
          </ol>
        </div>
        <div>
          <h4 className="font-semibold text-slate-900 mb-2">Export automatique mensuel</h4>
          <p className="mb-2">Configurable dans <strong>Paramètres → Finance → Export comptable automatique</strong> :</p>
          <ul className="list-disc list-inside ml-4 space-y-1 text-slate-600">
            <li>Activation de l'export automatique mensuel</li>
            <li>Choix du format (FEC, OHADA, CSV)</li>
            <li>Choix du jour du mois (ex : le 5 du mois suivant)</li>
            <li>Choix du destinataire (email du comptable)</li>
          </ul>
          <p className="mt-2 text-xs text-slate-500">L'export automatique envoie le fichier à l'expert-comptable sans intervention manuelle, le jour configuré chaque mois.</p>
        </div>
        <div>
          <h4 className="font-semibold text-slate-900 mb-2">API REST (pour intégration sur-mesure)</h4>
          <p className="mb-2">Pour les établissements qui ont un système comptable maison :</p>
          <div className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-xs overflow-x-auto">
            <div>GET /api/finance/exports/compta/fec?dateFrom=...&dateTo=...</div>
            <div>GET /api/finance/exports/compta/ohada?dateFrom=...&dateTo=...</div>
            <div>GET /api/finance/exports/compta/csv?dateFrom=...&dateTo=...</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'compatibilite',
    title: 'Compatibilité par logiciel',
    icon: CheckCircle2,
    content: (
      <div className="space-y-3 text-sm text-slate-700">
        <p>Tableau de compatibilité des principaux logiciels comptables :</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Logiciel</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Format d'import</th>
                <th className="px-3 py-2 text-center font-semibold text-slate-700">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr><td className="px-3 py-1.5 font-medium">Sage 100 (France)</td><td className="px-3 py-1.5">FEC, CSV</td><td className="px-3 py-1.5 text-center text-emerald-600">✅ Natif</td></tr>
              <tr><td className="px-3 py-1.5 font-medium">Sage OHADA (Bénin)</td><td className="px-3 py-1.5">CSV OHADA</td><td className="px-3 py-1.5 text-center text-emerald-600">✅ Natif</td></tr>
              <tr><td className="px-3 py-1.5 font-medium">Ciel Compta</td><td className="px-3 py-1.5">FEC, CSV</td><td className="px-3 py-1.5 text-center text-emerald-600">✅ Natif</td></tr>
              <tr><td className="px-3 py-1.5 font-medium">EBP Compta</td><td className="px-3 py-1.5">FEC, CSV</td><td className="px-3 py-1.5 text-center text-emerald-600">✅ Natif</td></tr>
              <tr><td className="px-3 py-1.5 font-medium">QuickBooks</td><td className="px-3 py-1.5">CSV, Excel</td><td className="px-3 py-1.5 text-center text-emerald-600">✅ Via mapping</td></tr>
              <tr><td className="px-3 py-1.5 font-medium">Pennylane</td><td className="px-3 py-1.5">FEC, CSV</td><td className="px-3 py-1.5 text-center text-emerald-600">✅ Natif</td></tr>
              <tr><td className="px-3 py-1.5 font-medium">Yooz</td><td className="px-3 py-1.5">CSV, FEC</td><td className="px-3 py-1.5 text-center text-emerald-600">✅ Natif</td></tr>
              <tr><td className="px-3 py-1.5 font-medium">Odoo</td><td className="px-3 py-1.5">CSV, FEC (module)</td><td className="px-3 py-1.5 text-center text-emerald-600">✅ Natif</td></tr>
              <tr><td className="px-3 py-1.5 font-medium">Dex</td><td className="px-3 py-1.5">FEC</td><td className="px-3 py-1.5 text-center text-emerald-600">✅ Natif</td></tr>
              <tr><td className="px-3 py-1.5 font-medium">Compta Bénin</td><td className="px-3 py-1.5">CSV</td><td className="px-3 py-1.5 text-center text-emerald-600">✅ Via mapping</td></tr>
              <tr><td className="px-3 py-1.5 font-medium">Xero</td><td className="px-3 py-1.5">CSV</td><td className="px-3 py-1.5 text-center text-emerald-600">✅ Via mapping</td></tr>
              <tr><td className="px-3 py-1.5 font-medium">Free Acomba</td><td className="px-3 py-1.5">CSV</td><td className="px-3 py-1.5 text-center text-emerald-600">✅ Via mapping</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  {
    id: 'mapping',
    title: 'Mapping des comptes',
    icon: Database,
    content: (
      <div className="space-y-3 text-sm text-slate-700">
        <p>Le mapping entre les catégories d'Academia Helm et les comptes OHADA est configurable par établissement dans <strong>Dépenses → Catégories → Modifier → Compte OHADA</strong>.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Transaction Academia Helm</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Débit (compte OHADA)</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Crédit (compte OHADA)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-3 py-1.5">Encaissement espèces (scolarité)</td>
                <td className="px-3 py-1.5 font-mono">571 — Caisse</td>
                <td className="px-3 py-1.5 font-mono">7061 — Scolarité</td>
              </tr>
              <tr>
                <td className="px-3 py-1.5">Encaissement Mobile Money</td>
                <td className="px-3 py-1.5 font-mono">521 — Banque</td>
                <td className="px-3 py-1.5 font-mono">7061 — Scolarité</td>
              </tr>
              <tr>
                <td className="px-3 py-1.5">Encaissement Fedapay (avec commission)</td>
                <td className="px-3 py-1.5 font-mono">521 — Banque (net)<br/>631 — Frais financiers</td>
                <td className="px-3 py-1.5 font-mono">7061 — Scolarité (brut)</td>
              </tr>
              <tr>
                <td className="px-3 py-1.5">Annulation (reversal)</td>
                <td className="px-3 py-1.5 font-mono">7061 — Scolarité</td>
                <td className="px-3 py-1.5 font-mono">571 — Caisse (ou 521)</td>
              </tr>
              <tr>
                <td className="px-3 py-1.5">Dépense approuvée (facture fournisseur)</td>
                <td className="px-3 py-1.5 font-mono">60x — Achat (selon catégorie)</td>
                <td className="px-3 py-1.5 font-mono">401 — Fournisseur</td>
              </tr>
              <tr>
                <td className="px-3 py-1.5">Paiement fournisseur</td>
                <td className="px-3 py-1.5 font-mono">401 — Fournisseur</td>
                <td className="px-3 py-1.5 font-mono">521 — Banque (ou 571)</td>
              </tr>
              <tr>
                <td className="px-3 py-1.5">Transfert inter-caisses</td>
                <td className="px-3 py-1.5 font-mono">572 — Caisse secondaire</td>
                <td className="px-3 py-1.5 font-mono">571 — Caisse principale</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  {
    id: 'exemple-fec',
    title: 'Exemple de fichier FEC',
    icon: Code,
    content: (
      <div className="space-y-3 text-sm text-slate-700">
        <p>Exemple de fichier FEC généré par Academia Helm (extrait) :</p>
        <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-xs overflow-x-auto whitespace-pre">
{`JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|CompAuxNum|CompAuxLib|PieceRef|PieceDate|EcritureLib|Debit|Credit|EcritureLet|DateLet|ValidDate|Montantdevise|Idevise
JQC|Journal de caisse|00000001|20260105|571000|Caisse principale|||REC-2026-0001|20260105|Encaissement - Marie AKOVI|75000,00|0,00|||20260105|0,00|XOF
JQC|Journal de caisse|00000002|20260105|411000|Élèves - Créances|ELE-001|Marie AKOVI|REC-2026-0001|20260105|Scolarité - Marie AKOVI|0,00|75000,00|||20260105|0,00|XOF
JAC|Journal des achats|00000003|20260108|605000|Achats matériel pédagogique|||FAC-FOURN-001|20260108|Achat 50 cahiers|25000,00|0,00|||20260108|0,00|XOF
JAC|Journal des achats|00000004|20260108|401000|Fournisseurs|FOU-001|Librairie Central|FAC-FOURN-001|20260108|Achat 50 cahiers|0,00|25000,00|||20260108|0,00|XOF`}
        </div>
        <p className="text-xs text-slate-500">Chaque opération génère <strong>2 lignes d'écriture</strong> (débit + crédit) — double entrée conforme au plan comptable.</p>
      </div>
    ),
  },
];

interface DocComptabiliteModalProps {
  open: boolean;
  onClose: () => void;
}

export default function DocComptabiliteModal({ open, onClose }: DocComptabiliteModalProps) {
  const [activeSection, setActiveSection] = useState<string>('standards');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!open) return null;

  const activeContent = SECTIONS.find((s) => s.id === activeSection);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Documentation — Intégration comptable</h2>
              <p className="text-xs text-violet-100">FEC, OHADA, CSV universel — Compatible Sage, Ciel, EBP, QuickBooks, Pennylane, Odoo…</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-2 transition-colors"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps : sidebar + contenu */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar navigation (desktop) */}
          <aside className="hidden md:block w-64 border-r border-slate-200 bg-slate-50 overflow-y-auto">
            <nav className="p-3 space-y-1">
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                      isActive
                        ? 'bg-violet-100 text-violet-700 border border-violet-200'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="text-left leading-tight">{section.title}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Mobile : menu déroulant */}
          <div className="md:hidden border-b border-slate-200 bg-slate-50">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700"
            >
              <span className="flex items-center gap-2">
                {activeContent && <activeContent.icon className="w-4 h-4" />}
                {activeContent?.title}
              </span>
              {mobileMenuOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {mobileMenuOpen && (
              <div className="border-t border-slate-200 py-2">
                {SECTIONS.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => {
                        setActiveSection(section.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-left ${
                        isActive ? 'text-violet-700 bg-violet-50' : 'text-slate-600'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {section.title}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Contenu principal */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeContent && (
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <activeContent.icon className="w-5 h-5 text-violet-600" />
                  {activeContent.title}
                </h3>
                {activeContent.content}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Academia Helm — Intégration comptable</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
