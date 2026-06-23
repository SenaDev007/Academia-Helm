'use client';

import { FileText, DollarSign, Building2, Landmark, Smartphone } from 'lucide-react';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:outline-none focus:border-[#1d4fa5] focus:ring-2 focus:ring-[#1d4fa5]/10 transition';

const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5';

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
  };
  onUpdate: (field: string, value: any) => void;
}

export function StepContract({ contract, onUpdate }: StepContractProps) {
  const showBankFields = contract.paymentMode === 'BANK';
  const showMobileMoneyFields = contract.paymentMode === 'MOBILE_MONEY';
  const showEndDate = contract.contractType !== 'CDI';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
          <FileText className="h-4 w-4" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-800">Contrat de Travail</h4>
          <p className="text-[11px] text-slate-400">Param&egrave;tres du contrat et r&eacute;mun&eacute;ration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Type de contrat *</label>
          <select className={inputClass} value={contract.contractType} onChange={(e) => onUpdate('contractType', e.target.value)}>
            <option value="CDD">Contrat &agrave; Dur&eacute;e D&eacute;termin&eacute;e (CDD)</option>
            <option value="CDI">Contrat &agrave; Dur&eacute;e Ind&eacute;termin&eacute;e (CDI)</option>
            <option value="VACATAIRE">Vacataire</option>
            <option value="STAGE">Stage</option>
            <option value="CONSULTANT">Consultant</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Salaire de Base (Mensuel) *</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input required type="number" min="0" className={inputClass + ' pl-9'} value={contract.baseSalary} onChange={(e) => onUpdate('baseSalary', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Date de prise d&apos;effet *</label>
          <input required type="date" className={inputClass} value={contract.startDate} onChange={(e) => onUpdate('startDate', e.target.value)} />
        </div>
        {showEndDate && (
          <div>
            <label className={labelClass}>Date de fin de contrat *</label>
            <input type="date" className={inputClass} value={contract.endDate} onChange={(e) => onUpdate('endDate', e.target.value)} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Mode de paiement *</label>
          <select className={inputClass} value={contract.paymentMode} onChange={(e) => onUpdate('paymentMode', e.target.value)}>
            <option value="BANK">Virement Bancaire</option>
            <option value="CASH">Esp&egrave;ces</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>N&deg; CNSS</label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Num&eacute;ro CNSS" className={inputClass + ' pl-9'} value={contract.cnssNumber} onChange={(e) => onUpdate('cnssNumber', e.target.value)} />
          </div>
        </div>
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
              <input type="text" placeholder="Num&eacute;ro de compte" className={inputClass} value={contract.accountNumber} onChange={(e) => onUpdate('accountNumber', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Titulaire</label>
              <input type="text" placeholder="Nom du titulaire" className={inputClass} value={contract.accountHolder} onChange={(e) => onUpdate('accountHolder', e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Money details (conditional) — for salary payment via FeexPay */}
      {showMobileMoneyFields && (
        <div className="space-y-4 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
          <div className="flex items-center gap-2 mb-1">
            <Smartphone className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Coordonn&eacute;es Mobile Money</span>
          </div>
          <p className="text-[11px] text-slate-500 -mt-1 mb-2">
            Num&eacute;ro et op&eacute;rateur utilis&eacute;s pour le paiement des salaires via FeexPay.
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

      <div>
        <label className={labelClass}>N&deg; IFU (Identifiant Fiscal Unique)</label>
        <input type="text" placeholder="Num&eacute;ro IFU (optionnel)" className={inputClass} value={contract.ifuNumber} onChange={(e) => onUpdate('ifuNumber', e.target.value)} />
      </div>
    </div>
  );
}
