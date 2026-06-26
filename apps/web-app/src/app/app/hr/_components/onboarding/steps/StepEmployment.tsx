'use client';

import { Briefcase, GraduationCap, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:outline-none focus:border-[#1d4fa5] focus:ring-2 focus:ring-[#1d4fa5]/10 transition';

const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5';

// Postes suggérés par défaut (suggestions libres, l'utilisateur peut aussi saisir un poste personnalisé)
const DEFAULT_POSITIONS = [
  'Directeur',
  'Directeur Adjoint',
  'Censeur',
  'Secrétaire',
  'Secrétaire Comptable',
  'Comptable',
  'Économe',
  'Responsable Scolarité',
  'Surveillant Général',
  'Professeur Principal',
  'Professeur de Mathématiques',
  'Professeur de Français',
  'Professeur d\'Anglais',
  'Professeur de SVT',
  'Professeur de Physique-Chimie',
  'Professeur d\'Histoire-Géographie',
  'Professeur d\'EPS',
  'Professeur de Philosophie',
  'Professeur d\'Informatique',
  'Instituteur',
  'Éducateur',
  'Animateur',
  'Agent d\'entretien',
  'Agent de sécurité',
  'Chauffeur',
  'Cuisinier',
  'Infirmier',
  'Bibliothécaire',
  'Responsable informatique',
  'Responsable communication',
];

interface StepEmploymentProps {
  employment: {
    position: string;
    department: string;
    roleType: string;
    hireDate: string;
    qualifications: string;
  };
  onUpdate: (field: string, value: any) => void;
}

export function StepEmployment({ employment, onUpdate }: StepEmploymentProps) {
  const [departments, setDepartments] = useState<any[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);

  // Charger les départements depuis l'API
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/departments', { credentials: 'include', cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setDepartments(Array.isArray(data) ? data : (data?.departments || []));
        }
      } catch (e) {
        // Silencieux — fallback sur input libre
      } finally {
        setLoadingDepts(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
          <Briefcase className="h-4 w-4" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-800">Classification &amp; Emploi</h4>
          <p className="text-[11px] text-slate-400">Définissez le poste et la catégorie du collaborateur</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Poste — datalist avec suggestions (l'utilisateur peut aussi saisir librement) */}
        <div>
          <label className={labelClass}>Poste occupé *</label>
          <div className="relative">
            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              required
              type="text"
              list="positions-list"
              placeholder="Choisissez ou saisissez un poste…"
              className={inputClass + ' pl-9'}
              value={employment.position}
              onChange={(e) => onUpdate('position', e.target.value)}
            />
            <datalist id="positions-list">
              {DEFAULT_POSITIONS.map((pos) => (
                <option key={pos} value={pos} />
              ))}
            </datalist>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Sélectionnez une suggestion ou tapez un poste personnalisé.</p>
        </div>

        {/* Département — select alimenté par /api/departments */}
        <div>
          <label className={labelClass}>Département</label>
          {departments.length > 0 ? (
            <select
              className={inputClass}
              value={employment.department}
              onChange={(e) => onUpdate('department', e.target.value)}
            >
              <option value="">— Sélectionner —</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.name}>
                  {dept.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder={loadingDepts ? 'Chargement des départements…' : 'Aucun département configuré. Saisissez librement…'}
              className={inputClass}
              value={employment.department}
              onChange={(e) => onUpdate('department', e.target.value)}
            />
          )}
          <p className="text-[10px] text-slate-400 mt-1">
            Configurez vos départements dans Paramètres → Départements.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Catégorie du personnel *</label>
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

      <div>
        <label className={labelClass}>Diplômes &amp; Qualifications</label>
        <div className="relative">
          <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <textarea placeholder="Diplômes, certifications, compétences clés…" className={inputClass + ' pl-9 min-h-[80px]'} value={employment.qualifications} onChange={(e) => onUpdate('qualifications', e.target.value)} />
        </div>
      </div>
    </div>
  );
}
