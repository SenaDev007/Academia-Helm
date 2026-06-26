'use client';

import { Briefcase, GraduationCap, Calendar } from 'lucide-react';
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
  };
  onUpdate: (field: string, value: any) => void;
}

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
