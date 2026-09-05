'use client';

import { Briefcase, GraduationCap, Calendar, Plus, X, ShieldCheck, FileText, Handshake, Lock } from 'lucide-react';
import { useState, useEffect } from 'react';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:outline-none focus:border-[#1d4fa5] focus:ring-2 focus:ring-[#1d4fa5]/10 transition';

const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5';

interface StepEmploymentProps {
  employment: {
    position: string;
    department: string;
    roleType: string;
    hireDate: string;
    qualifications: string;
    statutContractuel: string;
    secondaryPosition: string;
    isAlsoTeacher: boolean;
  };
  onUpdate: (field: string, value: any) => void;
}

const STATUT_OPTIONS = [
  {
    value: 'SALARIE_DECLARE',
    label: 'Salarié déclaré (CNSS)',
    icon: ShieldCheck,
    color: '#0b7a5a',
    description: 'Contrat de travail + fiche de paie. Cotisations CNSS (part salariale + part patronale) et ITS. Le numéro CNSS est obligatoire avant la signature.',
  },
  {
    value: 'SALARIE_NON_DECLARE',
    label: 'Salarié non déclaré',
    icon: FileText,
    color: '#b45309',
    description: 'Contrat de travail + fiche de paie. ITS uniquement, sans cotisations CNSS — la régularisation CNSS reste due (encart interne au back-office).',
  },
  {
    value: 'PRESTATAIRE_SERVICE',
    label: 'Prestataire de services',
    icon: Handshake,
    color: '#1d4fa5',
    description: 'Contrat de prestation de services (sans lien de subordination) + état de paiement. Retenue AIB à la source (3 % avec IFU, 5 % sans), pas de CNSS ni d’ITS.',
  },
] as const;

export function StepEmployment({ employment, onUpdate }: StepEmploymentProps) {
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingPositions, setLoadingPositions] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [deptRes, posRes] = await Promise.all([
          fetch('/api/departments', { credentials: 'include', cache: 'no-store' }),
          fetch('/api/positions', { credentials: 'include', cache: 'no-store' }),
        ]);
        if (deptRes.ok) {
          const data = await deptRes.json();
          setDepartments(Array.isArray(data) ? data : (data?.departments || []));
        }
        if (posRes.ok) {
          const data = await posRes.json();
          setPositions(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        // Silencieux
      } finally {
        setLoadingDepts(false);
        setLoadingPositions(false);
      }
    })();
  }, []);

  const positionsByCategory = positions.reduce((acc, pos) => {
    const cat = pos.category || 'AUTRE';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(pos);
    return acc;
  }, {} as Record<string, any[]>);

  const categoryLabels: Record<string, string> = {
    TEACHER: 'Corps Enseignant',
    ADMIN: 'Administration',
    SUPPORT: 'Personnel d\'appui',
    DIRECTOR: 'Direction',
    AUTRE: 'Autres',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
          <Briefcase className="h-4 w-4" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-800">Classification &amp; Emploi</h4>
          <p className="text-[11px] text-slate-400">D&eacute;finissez le poste et la cat&eacute;gorie du collaborateur</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Poste occup&eacute; *</label>
          {positions.length > 0 ? (
            <select className={inputClass} value={employment.position} onChange={(e) => onUpdate('position', e.target.value)}>
              <option value="">— S&eacute;lectionner un poste —</option>
              {Object.entries(positionsByCategory).map(([cat, items]) => (
                <optgroup key={cat} label={categoryLabels[cat] || cat}>
                  {items.map((pos) => (
                    <option key={pos.id} value={pos.name}>{pos.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          ) : (
            <input required type="text" placeholder={loadingPositions ? 'Chargement des postes…' : 'Saisissez un poste…'} className={inputClass} value={employment.position} onChange={(e) => onUpdate('position', e.target.value)} />
          )}
          <p className="text-[10px] text-slate-400 mt-1">Configurez vos postes dans Param&egrave;tres &rarr; D&eacute;partements.</p>
        </div>
        <div>
          <label className={labelClass}>D&eacute;partement</label>
          {departments.length > 0 ? (
            <select className={inputClass} value={employment.department} onChange={(e) => onUpdate('department', e.target.value)}>
              <option value="">— S&eacute;lectionner —</option>
              {departments.map((dept) => (<option key={dept.id} value={dept.name}>{dept.name}</option>))}
            </select>
          ) : (
            <input type="text" placeholder={loadingDepts ? 'Chargement…' : 'Saisissez librement…'} className={inputClass} value={employment.department} onChange={(e) => onUpdate('department', e.target.value)} />
          )}
          <p className="text-[10px] text-slate-400 mt-1">Configurez vos d&eacute;partements dans Param&egrave;tres.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Cat&eacute;gorie du personnel *</label>
          <select className={inputClass} value={employment.roleType} onChange={(e) => onUpdate('roleType', e.target.value)}>
            <option value="TEACHER">Corps Enseignant</option>
            <option value="ADMIN">Administration</option>
            <option value="SUPPORT">Personnel d&apos;appui</option>
            <option value="DIRECTOR">Direction</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Date d&apos;embauche *</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input required type="date" className={inputClass + ' pl-9'} value={employment.hireDate} onChange={(e) => onUpdate('hireDate', e.target.value)} />
          </div>
        </div>
      </div>

      {/* ⭐ Statut contractuel RH Bénin — choix BLOQUANT, avant tout champ financier */}
      <div className="border-t border-slate-100 pt-4 mt-2">
        <div className="flex items-center gap-2 mb-1">
          <Lock className="h-4 w-4 text-blue-500" />
          <h5 className="text-sm font-bold text-slate-800">Statut contractuel *</h5>
        </div>
        <p className="text-[11px] text-slate-400 mb-3">
          Ce choix conditionne le contrat généré, le document de paie (fiche de paie ou état de paiement)
          et le calcul des retenues. Il est <strong>verrouillé après la création du profil</strong> : tout
          changement ultérieur passe par une procédure tracée (date d&apos;effet + justification).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {STATUT_OPTIONS.map((opt) => {
            const selected = employment.statutContractuel === opt.value;
            const Icon = opt.icon;
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => onUpdate('statutContractuel', opt.value)}
                className={
                  'text-left p-3 rounded-xl border-2 transition-all ' +
                  (selected
                    ? 'border-[#1d4fa5] bg-[#1d4fa5]/5 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300')
                }
                style={selected ? { borderColor: opt.color } : undefined}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={
                      'inline-flex items-center justify-center w-5 h-5 rounded-full border-2 shrink-0 ' +
                      (selected ? 'bg-[#1d4fa5] border-[#1d4fa5]' : 'border-slate-300 bg-white')
                    }
                    style={selected ? { backgroundColor: opt.color, borderColor: opt.color } : undefined}
                  >
                    {selected && (
                      <svg viewBox="0 0 12 12" className="w-3 h-3 text-white" fill="none">
                        <path d="M2.5 6.5L5 9l4.5-5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <Icon className="h-4 w-4 shrink-0" style={{ color: selected ? opt.color : '#94a3b8' }} />
                  <span className={'text-xs font-bold leading-tight ' + (selected ? 'text-slate-900' : 'text-slate-600')}>
                    {opt.label}
                  </span>
                </div>
                <p className="text-[10.5px] leading-relaxed text-slate-500">{opt.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ⭐ Multi-poste : permet de préciser un poste enseignant supplémentaire */}
      <div className="border-t border-slate-100 pt-4 mt-2">
        <div className="flex items-center gap-2 mb-3">
          <GraduationCap className="h-4 w-4 text-blue-500" />
          <h5 className="text-sm font-bold text-slate-800">Multi-poste (optionnel)</h5>
        </div>
        <p className="text-[11px] text-slate-400 mb-3">
          Ce personnel occupe-t-il aussi un poste d&apos;enseignant en plus de son poste principal ?
          Le contrat reflétera les deux postes.
        </p>
        <label className="flex items-center gap-2 cursor-pointer mb-3">
          <input
            type="checkbox"
            checked={employment.isAlsoTeacher}
            onChange={(e) => onUpdate('isAlsoTeacher', e.target.checked)}
            className="w-4 h-4 accent-[#1d4fa5] rounded"
          />
          <span className="text-sm font-semibold text-slate-700">
            Ce personnel enseigne aussi une matière
          </span>
        </label>
        {employment.isAlsoTeacher && (
          <div>
            <label className={labelClass}>Poste / Matière enseignée</label>
            <input
              type="text"
              placeholder="Ex: Professeur d'Anglais, Instituteur(trice) du Primaire..."
              className={inputClass}
              value={employment.secondaryPosition}
              onChange={(e) => onUpdate('secondaryPosition', e.target.value)}
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Précisez la matière ou le poste enseignant. Cette information apparaîtra dans le contrat.
            </p>
          </div>
        )}
      </div>

      <div>
        <label className={labelClass}>Dipl&ocirc;mes &amp; Qualifications</label>
        <div className="relative">
          <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <textarea placeholder="Dipl&ocirc;mes, certifications, comp&eacute;tences cl&eacute;s…" className={inputClass + ' pl-9 min-h-[80px]'} value={employment.qualifications} onChange={(e) => onUpdate('qualifications', e.target.value)} />
        </div>
      </div>
    </div>
  );
}
