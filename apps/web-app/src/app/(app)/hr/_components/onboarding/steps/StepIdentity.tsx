'use client';

import { User, Globe, Heart, CreditCard } from 'lucide-react';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:outline-none focus:border-[#1d4fa5] focus:ring-2 focus:ring-[#1d4fa5]/10 transition';

const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5';

interface StepIdentityProps {
  identity: {
    firstName: string;
    lastName: string;
    gender: string;
    birthDate: string;
    nationality: string;
    maritalStatus: string;
    numberOfChildren: number;
    nationalId: string;
    email: string;
    phone: string;
    address: string;
  };
  onUpdate: (field: string, value: any) => void;
}

export function StepIdentity({ identity, onUpdate }: StepIdentityProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
          <User className="h-4 w-4" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-800">Informations Personnelles</h4>
          <p className="text-[11px] text-slate-400">Renseignez l&apos;identit&eacute; compl&egrave;te du collaborateur</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Pr&eacute;nom *</label>
          <input required type="text" placeholder="Ex : Kouadio" className={inputClass} value={identity.firstName} onChange={(e) => onUpdate('firstName', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Nom de famille *</label>
          <input required type="text" placeholder="Ex : Koffi" className={inputClass} value={identity.lastName} onChange={(e) => onUpdate('lastName', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Email professionnel *</label>
          <input required type="email" placeholder="prenom.nom@ecole.ci" className={inputClass} value={identity.email} onChange={(e) => onUpdate('email', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>T&eacute;l&eacute;phone *</label>
          <input required type="tel" placeholder="+229 90 00 00 00" className={inputClass} value={identity.phone} onChange={(e) => onUpdate('phone', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Genre *</label>
          <select className={inputClass} value={identity.gender} onChange={(e) => onUpdate('gender', e.target.value)}>
            <option value="MALE">Masculin</option>
            <option value="FEMALE">F&eacute;minin</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Date de naissance *</label>
          <input required type="date" className={inputClass} value={identity.birthDate} onChange={(e) => onUpdate('birthDate', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Nationalit&eacute;</label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Ex : B&eacute;ninoise" className={inputClass + ' pl-9'} value={identity.nationality} onChange={(e) => onUpdate('nationality', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Situation matrimoniale</label>
          <div className="relative">
            <Heart className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <select className={inputClass + ' pl-9'} value={identity.maritalStatus} onChange={(e) => onUpdate('maritalStatus', e.target.value)}>
              <option value="SINGLE">C&eacute;libataire</option>
              <option value="MARRIED">Mari&eacute;(e)</option>
              <option value="DIVORCED">Divorc&eacute;(e)</option>
              <option value="WIDOWED">Veuf(ve)</option>
              <option value="SEPARATED">S&eacute;par&eacute;(e)</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>Nombre d&apos;enfants</label>
          <input type="number" min="0" className={inputClass} value={identity.numberOfChildren} onChange={(e) => onUpdate('numberOfChildren', parseInt(e.target.value) || 0)} />
        </div>
        <div>
          <label className={labelClass}>N&deg; CNI / Passeport *</label>
          <div className="relative">
            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input required type="text" placeholder="N&deg; pi&egrave;ce d&apos;identit&eacute;" className={inputClass + ' pl-9'} value={identity.nationalId} onChange={(e) => onUpdate('nationalId', e.target.value)} />
          </div>
        </div>
      </div>

      <div>
        <label className={labelClass}>Adresse</label>
        <textarea placeholder="Adresse compl&egrave;te du collaborateur" className={inputClass + ' min-h-[60px]'} value={identity.address} onChange={(e) => onUpdate('address', e.target.value)} />
      </div>
    </div>
  );
}
