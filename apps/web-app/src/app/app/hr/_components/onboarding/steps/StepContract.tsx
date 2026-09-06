'use client';

import { FileText, DollarSign, Building2, Landmark, Smartphone, Handshake, CalendarClock, Info, AlertTriangle, History } from 'lucide-react';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:outline-none focus:border-[#1d4fa5] focus:ring-2 focus:ring-[#1d4fa5]/10 transition';

const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5';

interface FiscalHints {
  smig?: number | null;
  aibAvecIfu?: number | null;
  aibSansIfu?: number | null;
  cnssSalarial?: number | null;
  categoryRules?: Record<string, any> | null;
}

/** Paramétrage RH de l'école (GET hr/contracts/settings — CDC §9). */
interface HrContractSettings {
  cddMotifs: string[];
  cddDureeMaxMois: number;
  cddRenouvellementsMax: number;
  indemniteFinContratPct: number;
}

/** Chaîne CDD du personnel (GET hr/contracts/staff/:id/cdd-chain — champs calculés). */
interface CddChainInfo {
  activeChain: { renouvellements: number; dureeCumuleeMois: number } | null;
  seuilMois: number;
  depasseSeuil: boolean;
}

interface StepContractProps {
  contract: {
    contractType: string;
    templateId: string;
    startDate: string;
    endDate: string;
    baseSalary: string;
    paymentMode: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    mobileMoneyNumber: string;
    mobileMoneyOperator: string;
    cnssNumber: string;
    ifuNumber: string;
    prestationPaymentMode: 'FORFAIT' | 'HORAIRE';
    prestationAmount: string;
    prestationDescription: string;
    prestationCalendrier: string;
    prestationRenouvelable: boolean;
    prestationConfidentialite: boolean;
    prestationPropriete: boolean;
    cddMotif: string;
    periodeEssaiMois: string;
    justificationStatut: string;
  };
  /** ⭐ Statut contractuel choisi à l'étape 2 (bloquant) */
  statutContractuel: string;
  /** Catégorie du personnel (roleType — période d'essai suggérée selon barème) */
  roleType?: string;
  /** Barème en vigueur (payroll_fiscal_rates — jamais codé en dur côté front) */
  fiscalHints?: FiscalHints | null;
  /** Paramétrage de l'école (motifs CDD, seuils — CDC §9) */
  hrSettings?: HrContractSettings | null;
  /** Chaîne CDD existante du personnel (compteur + durée cumulée — §4.3) */
  cddChain?: CddChainInfo | null;
  onUpdate: (field: string, value: any) => void;
}

export function StepContract({ contract, statutContractuel, roleType, fiscalHints, hrSettings, cddChain, onUpdate }: StepContractProps) {
  const showBankFields = contract.paymentMode === 'BANK';
  const showMobileMoneyFields = contract.paymentMode === 'MOBILE_MONEY';
  const isPrestation = statutContractuel === 'PRESTATAIRE_SERVICE';
  const isDeclare = statutContractuel === 'SALARIE_DECLARE';
  const isSalarie = statutContractuel === 'SALARIE_DECLARE' || statutContractuel === 'SALARIE_NON_DECLARE';
  const isCDD = isSalarie && contract.contractType === 'CDD';
  const isCDI = isSalarie && contract.contractType === 'CDI';

  const smig = fiscalHints?.smig ?? 52000;
  const fmt = (n?: number | null) => (n == null ? '' : Number(n).toLocaleString('fr-FR'));
  const smigInferieur = isSalarie && contract.baseSalary !== '' && Number(contract.baseSalary) > 0 && Number(contract.baseSalary) < smig;
  const tauxAibApplique = contract.ifuNumber
    ? (fiscalHints?.aibAvecIfu ?? 3)
    : (fiscalHints?.aibSansIfu ?? 5);

  // ── Période d'essai CDI : valeur par défaut suggérée selon la catégorie
  //    professionnelle (payroll_fiscal_rates.categoryRules — barème, pas en dur)
  const categoryKey: Record<string, string> = { DIRECTOR: 'CADRE', TEACHER: 'ENSEIGNANT', ADMIN: 'AGENT_MAITRISE', SUPPORT: 'OUVRIER_EMPLOYE' };
  const essaiSuggere = (cat?: string): number => {
    const rules = fiscalHints?.categoryRules as any;
    const rule = rules?.[categoryKey[cat || 'TEACHER'] || 'OUVRIER_EMPLOYE'];
    const m = rule?.essai?.match(/(\d+)/);
    return m ? Number(m[1]) : 1;
  };

  // ── Chaîne CDD : durée cumulée projetée avec le contrat en cours de saisie (§4.3/§8.2)
  const dureeSaisieMois = contract.startDate && contract.endDate
    ? Math.max(0, (new Date(contract.endDate).getTime() - new Date(contract.startDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
    : 0;
  const cumulExistant = cddChain?.activeChain?.dureeCumuleeMois ?? 0;
  const cumulProjete = isCDD ? Math.round((cumulExistant + dureeSaisieMois) * 10) / 10 : 0;
  const seuil = hrSettings?.cddDureeMaxMois ?? 24;
  const depasseSeuil = isCDD && cumulProjete > seuil;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
          <FileText className="h-4 w-4" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-800">
            {isPrestation ? 'Contrat de Prestation de Services' : 'Contrat de Travail'}
          </h4>
          <p className="text-[11px] text-slate-400">
            {isPrestation
              ? 'Prestation indépendante — état de paiement, retenue AIB'
              : isDeclare
              ? 'Salarié déclaré — fiche de paie, CNSS + ITS'
              : statutContractuel
              ? 'Salarié non déclaré — fiche de paie, ITS uniquement'
              : 'Paramètres du contrat et rémunération'}
          </p>
        </div>
      </div>

      {/* ═══ Prestataire de services ═══ */}
      {isPrestation && (
        <>
          <div className="p-3 rounded-xl bg-[#1d4fa5]/5 border border-[#1d4fa5]/20 text-[11px] text-slate-600 leading-relaxed">
            <Handshake className="h-3.5 w-3.5 inline-block mr-1 -mt-0.5 text-[#1d4fa5]" />
            Le prestataire signe un <strong>contrat de prestation de services</strong> (pas un contrat de
            travail) : absence de lien de subordination, paiement sur facture ou relevé d&apos;heures,
            retenue AIB à la source de <strong>{tauxAibApplique} %</strong> (IFU {contract.ifuNumber ? 'renseigné → taux réduit' : 'absent → taux plein'})
            {fiscalHints?.aibAvecIfu != null ? '' : ' (taux indicatif)'}.
          </div>

          {/* ⭐ CDC §4.3 — rappel visuel de cohérence (informatif, non bloquant) */}
          <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/70 text-[10.5px] text-amber-800 leading-relaxed flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              <strong>Rappel de cohérence :</strong> aucun horaire ni instruction d&apos;exécution ne doit être
              imposé à ce profil — le contrat de prestation repose précisément sur l&apos;absence de lien de
              subordination (critère légal de distinction).
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Mode de rémunération *</label>
              <select
                className={inputClass}
                value={contract.prestationPaymentMode}
                onChange={(e) => onUpdate('prestationPaymentMode', e.target.value)}
              >
                <option value="FORFAIT">Forfait (montant global)</option>
                <option value="HORAIRE">Taux horaire (relevé d&apos;heures)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>
                {contract.prestationPaymentMode === 'HORAIRE' ? 'Taux horaire (FCFA) *' : 'Montant du forfait (FCFA) *'}
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  required
                  type="number"
                  min="0"
                  className={inputClass + ' pl-9'}
                  placeholder={contract.prestationPaymentMode === 'HORAIRE' ? 'Ex : 5000' : 'Ex : 300000'}
                  value={contract.prestationAmount}
                  onChange={(e) => onUpdate('prestationAmount', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Objet de la prestation *</label>
            <textarea
              required
              className={inputClass + ' min-h-[80px]'}
              placeholder="Ex : Animation des séances de renforcement en mathématiques pour les classes de 3e, préparation aux examens…"
              value={contract.prestationDescription}
              onChange={(e) => onUpdate('prestationDescription', e.target.value)}
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Soyez précis : une description générique fragilise la clause d&apos;absence de subordination.
            </p>
          </div>

          <div>
            <label className={labelClass}>Calendrier des interventions *</label>
            <div className="relative">
              <CalendarClock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                required
                type="text"
                className={inputClass + ' pl-9'}
                placeholder="Ex : plages indicatives de 15h à 17h, mardis et jeudis, d'octobre à juin"
                value={contract.prestationCalendrier}
                onChange={(e) => onUpdate('prestationCalendrier', e.target.value)}
            />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Formulez des <em>plages indicatives</em> convenues d&apos;un commun accord — jamais des horaires imposés.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>N&deg; IFU (Identifiant Fiscal Unique)</label>
              <input
                type="text"
                placeholder="Numéro IFU du prestataire"
                className={inputClass}
                value={contract.ifuNumber}
                onChange={(e) => onUpdate('ifuNumber', e.target.value)}
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Laisser vide si le prestataire n&apos;a pas d&apos;IFU — la retenue AIB passe au taux de{' '}
                {fmt(fiscalHints?.aibSansIfu ?? 5)} %.
              </p>
            </div>
            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contract.prestationRenouvelable}
                  onChange={(e) => onUpdate('prestationRenouvelable', e.target.checked)}
                  className="w-4 h-4 accent-[#1d4fa5] rounded"
                />
                <span className="text-xs font-semibold text-slate-700">Contrat renouvelable par accord exprès</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contract.prestationConfidentialite}
                  onChange={(e) => onUpdate('prestationConfidentialite', e.target.checked)}
                  className="w-4 h-4 accent-[#1d4fa5] rounded"
                />
                <span className="text-xs font-semibold text-slate-700">Clause de confidentialité</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contract.prestationPropriete}
                  onChange={(e) => onUpdate('prestationPropriete', e.target.checked)}
                  className="w-4 h-4 accent-[#1d4fa5] rounded"
                />
                <span className="text-xs font-semibold text-slate-700">Cession des contenus produits</span>
              </label>
            </div>
          </div>
        </>
      )}

      {/* ═══ Salariés (déclarés ou non déclarés) — CDC §4 : CDI/CDD uniquement ═══ */}
      {isSalarie && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Type de contrat *</label>
              <select className={inputClass} value={contract.contractType} onChange={(e) => onUpdate('contractType', e.target.value)}>
                <option value="CDD">Contrat &agrave; Dur&eacute;e D&eacute;termin&eacute;e (CDD)</option>
                <option value="CDI">Contrat &agrave; Dur&eacute;e Ind&eacute;termin&eacute;e (CDI)</option>
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                Seuls le CDI et le CDD existent en droit du travail. « Vacataire » n&apos;est pas un statut légal,
                et le stage relève du flux dédié « Stagiaires » (convention, Décret n°2018-196).
              </p>
            </div>
            <div>
              <label className={labelClass}>Salaire de Base (Mensuel) *</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input required type="number" min="0" className={inputClass + ' pl-9'} value={contract.baseSalary} onChange={(e) => onUpdate('baseSalary', e.target.value)} />
              </div>
              {smigInferieur ? (
                <p className="text-[10px] text-red-600 mt-1 font-semibold">
                  Inférieur au SMIG ({fmt(smig)} FCFA/mois) — le serveur refusera la création du contrat.
                </p>
              ) : (
                <p className="text-[10px] text-slate-400 mt-1">
                  Plancher légal : SMIG = {fmt(smig)} FCFA/mois{fiscalHints?.smig == null ? ' (valeur indicative — barème serveur indisponible)' : ''}.
                </p>
              )}
            </div>
          </div>

          {/* ⭐ CDC §4.3 — champs conditionnels CDD */}
          {isCDD && (
            <div className="space-y-4 p-4 bg-blue-50/40 rounded-xl border border-blue-100">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-[#1d4fa5]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#1d4fa5]">Durée déterminée — art. 34 Code du travail</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Date de début *</label>
                  <input required type="date" className={inputClass} value={contract.startDate} onChange={(e) => onUpdate('startDate', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Date de fin *</label>
                  <input
                    required
                    type="date"
                    className={inputClass}
                    min={contract.startDate || undefined}
                    value={contract.endDate}
                    onChange={(e) => onUpdate('endDate', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Motif du recours au CDD *</label>
                <input
                  required
                  type="text"
                  list="cdd-motifs-suggestions"
                  className={inputClass}
                  placeholder="Ex : Remplacement d'un salarié en congé maternité…"
                  value={contract.cddMotif}
                  onChange={(e) => onUpdate('cddMotif', e.target.value)}
                />
                <datalist id="cdd-motifs-suggestions">
                  {(hrSettings?.cddMotifs ?? []).map((m, i) => (
                    <option key={i} value={m} />
                  ))}
                </datalist>
                <p className="text-[10px] text-slate-400 mt-1">
                  Texte libre ou suggestion de votre école (paramétrable). Le motif figure dans le contrat
                  généré — un CDD ne peut être conclu sans motif précis.
                </p>
              </div>

              {/* Chaîne de renouvellements — champs CALCULÉS, jamais saisis */}
              {(cddChain?.activeChain || cumulProjete > 0) && (
                <div className={'p-3 rounded-lg text-[11px] leading-relaxed ' + (depasseSeuil ? 'bg-rose-50/70 border border-rose-200 text-rose-800' : 'bg-slate-50 border border-slate-200 text-slate-600')}>
                  <div className="flex items-start gap-1.5">
                    {depasseSeuil ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <History className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" />}
                    <div>
                      <strong>Chaîne CDD de ce personnel :</strong> {cddChain?.activeChain?.renouvellements ?? 0} renouvellement(s)
                      enregistré(s), durée cumulée {cumulExistant ? Math.round(cumulExistant) : 0} mois
                      {dureeSaisieMois > 0 && <> + contrat en cours ≈ {Math.round(dureeSaisieMois)} mois</>} →{' '}
                      <strong>cumul projeté {cumulProjete} mois</strong> (seuil : {seuil} mois).
                      {depasseSeuil && (
                        <> Au-delà du seuil, la relation est réputée à durée indéterminée : une transformation
                        en CDI doit être envisagée. Le contrat sera créé, mais une alerte de conformité restera visible.</>
                      )}
                      {!depasseSeuil && ' La durée cumulée (contrat initial + renouvellements) est recalculée automatiquement.'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ⭐ CDC §4.3 — champs CDI : pas de date de fin, période d'essai */}
          {isCDI && (
            <div className="space-y-4 p-4 bg-emerald-50/40 rounded-xl border border-emerald-100">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-emerald-700" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Durée indéterminée</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Date de prise d&apos;effet *</label>
                  <input required type="date" className={inputClass} value={contract.startDate} onChange={(e) => onUpdate('startDate', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Période d&apos;essai (mois)</label>
                  <input
                    type="number"
                    min="0"
                    max="12"
                    className={inputClass}
                    placeholder={`Suggéré : ${essaiSuggere(roleType)} mois`}
                    value={contract.periodeEssaiMois}
                    onChange={(e) => onUpdate('periodeEssaiMois', e.target.value)}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    La durée varie selon la catégorie professionnelle (barème fiscal). Laisser vide
                    applique la valeur du barème ; un CDI n&apos;a pas de date de fin.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Dates — prestataire uniquement (salariés gérés dans les blocs CDD/CDI) */}
      {isPrestation && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Date de prise d&apos;effet *</label>
            <input required type="date" className={inputClass} value={contract.startDate} onChange={(e) => onUpdate('startDate', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Date de fin *</label>
            <input required type="date" className={inputClass} min={contract.startDate || undefined} value={contract.endDate} onChange={(e) => onUpdate('endDate', e.target.value)} />
          </div>
        </div>
      )}

      {/* ⭐ CDC §4.4 — justification du statut (traçabilité, optionnelle) */}
      <div>
        <label className={labelClass}>
          Justification du choix du statut <span className="normal-case font-normal text-slate-400">(recommandé — traçabilité en cas de contrôle)</span>
        </label>
        <textarea
          className={inputClass + ' min-h-[60px]'}
          placeholder="Ex : Interventions ponctuelles à la demande, organise librement son travail, possède un IFU → prestataire. / Enseigne selon l'emploi du temps de l'école, sous l'autorité du coordonnateur → salarié."
          value={contract.justificationStatut}
          onChange={(e) => onUpdate('justificationStatut', e.target.value)}
        />
        <p className="text-[10px] text-slate-400 mt-1">
          Cette note explique pourquoi ce statut plutôt qu&apos;un autre pour ce poste. Elle reste interne
          (jamais imprimée sur le contrat) et aide le gestionnaire RH en cas de contrôle ou de litige.
        </p>
      </div>

      {/* ═══ CNSS (salarié déclaré uniquement) ═══ */}
      {isDeclare && (
        <div className="space-y-3 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-emerald-700" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Déclaration CNSS (obligatoire)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>N&deg; CNSS *</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  required
                  type="text"
                  placeholder="Numéro d'immatriculation CNSS"
                  className={inputClass + ' pl-9'}
                  value={contract.cnssNumber}
                  onChange={(e) => onUpdate('cnssNumber', e.target.value)}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Le contrat ne peut pas être signé sans ce numéro. Cotisation salariale :{' '}
                {fiscalHints?.cnssSalarial != null ? `${fmt(fiscalHints.cnssSalarial)} % du brut (précompte)` : 'selon le barème en vigueur'}.
              </p>
            </div>
            <div className="flex items-start gap-2 text-[11px] text-slate-600 leading-relaxed">
              <Info className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <p>
                La date de déclaration CNSS est renseignée automatiquement. La part patronale est
                provisionnée pour la déclaration CNSS (mensuelle si effectif déclaré ≥ 20, trimestrielle sinon).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Note salarié non déclaré — bandeau visible (CDC §8.3 : jamais masquer le risque) */}
      {statutContractuel === 'SALARIE_NON_DECLARE' && (
        <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-[11px] text-amber-800 leading-relaxed">
          <AlertTriangle className="h-3.5 w-3.5 inline-block mr-1 -mt-0.5" />
          <strong>Non-déclaration CNSS :</strong> ce salarié percevra une fiche de paie avec ITS, sans
          cotisations CNSS. Ce bandeau restera visible sur sa fiche et en paie tant que la régularisation
          n&apos;aura pas été faite (procédure tracée de changement de statut). L&apos;usage reste possible —
          le risque, lui, reste affiché.
        </div>
      )}

      {/* Mode de paiement (tous statuts) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Mode de paiement *</label>
          <select className={inputClass} value={contract.paymentMode} onChange={(e) => onUpdate('paymentMode', e.target.value)}>
            <option value="BANK">Virement Bancaire</option>
            <option value="CASH">Esp&egrave;ces</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
          </select>
        </div>
        {!isPrestation && !isDeclare && (
          <div>
            <label className={labelClass}>N&deg; CNSS (optionnel)</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Num&eacute;ro CNSS" className={inputClass + ' pl-9'} value={contract.cnssNumber} onChange={(e) => onUpdate('cnssNumber', e.target.value)} />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Si ce numéro est renseigné maintenant, le personnel pourra être régularisé plus facilement.
            </p>
          </div>
        )}
      </div>

      {/* Bank details (conditional) */}
      {showBankFields && (
        <div className="space-y-4 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <Landmark className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Coordonn&eacute;es bancaires</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Banque</label>
              <input type="text" placeholder="Nom de la banque" className={inputClass} value={contract.bankName} onChange={(e) => onUpdate('bankName', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>N&deg; Compte</label>
              <input type="text" placeholder="Numéro de compte" className={inputClass} value={contract.accountNumber} onChange={(e) => onUpdate('accountNumber', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Titulaire</label>
              <input type="text" placeholder="Nom du titulaire" className={inputClass} value={contract.accountHolder} onChange={(e) => onUpdate('accountHolder', e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Money details (conditional) — for salary payment */}
      {showMobileMoneyFields && (
        <div className="space-y-4 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
          <div className="flex items-center gap-2 mb-1">
            <Smartphone className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Coordonn&eacute;es Mobile Money</span>
          </div>
          <p className="text-[11px] text-slate-500 -mt-1 mb-2">
            {isPrestation
              ? 'Numéro et opérateur utilisés pour le versement des prestations.'
              : 'Num&eacute;ro et op&eacute;rateur utilis&eacute;s pour le paiement des salaires via FedaPay.'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Num&eacute;ro Mobile Money *</label>
              <input
                type="tel"
                placeholder="Ex: 2290167000000"
                className={inputClass}
                value={contract.mobileMoneyNumber}
                onChange={(e) => onUpdate('mobileMoneyNumber', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Op&eacute;rateur *</label>
              <select
                className={inputClass}
                value={contract.mobileMoneyOperator}
                onChange={(e) => onUpdate('mobileMoneyOperator', e.target.value)}
              >
                <option value="">— S&eacute;lectionner —</option>
                <option value="MTN">MTN</option>
                <option value="MOOV">MOOV</option>
                <option value="CELTIIS">CELTIIS</option>
                <option value="CORIS">CORIS</option>
                <option value="ORANGE">ORANGE</option>
                <option value="WAVE">WAVE</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
