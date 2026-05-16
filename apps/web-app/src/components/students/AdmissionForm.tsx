'use client';

import { useState, useEffect } from 'react';
import { User, MapPin, GraduationCap, Users, Shield, BookOpen, Globe, School } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';

interface AdmissionFormProps {
  initialData?: any;
  onSubmit: (data: any) => Promise<void>;
}

export default function AdmissionForm({ initialData, onSubmit }: AdmissionFormProps) {
  const { academicYear, schoolLevel, tenantId } = useModuleContext();
  const [levels, setLevels] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [isLoadingLevels, setIsLoadingLevels] = useState(false);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);

  const [formData, setFormData] = useState({
    academicYearId: academicYear?.id || '',
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    gender: initialData?.gender || '',
    birthDate: initialData?.birthDate ? new Date(initialData.birthDate).toISOString().split('T')[0] : '',
    birthPlace: initialData?.birthPlace || '',
    nationality: initialData?.nationality || 'Béninoise',
    address: initialData?.address || '',
    requestedLevelId: initialData?.requestedLevelId || schoolLevel?.id || '',
    requestedClassId: initialData?.requestedClassId || '',
    requestedSeriesId: initialData?.requestedSeriesId || '',
    wantsBilingual: initialData?.wantsBilingual || false,
    previousSchool: initialData?.previousSchool || '',
    mainGuardianName: initialData?.mainGuardianName || '',
    mainGuardianPhone: initialData?.mainGuardianPhone || '',
    mainGuardianEmail: initialData?.mainGuardianEmail || '',
  });

  useEffect(() => {
    loadLevels();
  }, []);

  useEffect(() => {
    if (formData.requestedLevelId) {
      loadClasses(formData.requestedLevelId);
    }
  }, [formData.requestedLevelId]);

  const loadLevels = async () => {
    setIsLoadingLevels(true);
    try {
      const res = await fetch('/api/settings/school-levels');
      if (res.ok) {
        const data = await res.json();
        setLevels(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingLevels(false);
    }
  };

  const loadClasses = async (levelId: string) => {
    setIsLoadingClasses(true);
    try {
      const res = await fetch(`/api/classes?schoolLevelId=${levelId}`);
      if (res.ok) {
        const data = await res.json();
        setClasses(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingClasses(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  return (
    <form className="space-y-8 py-2">
      {/* Section 1: Identité */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <div className="p-1.5 bg-blue-50 rounded-lg">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Identité du Candidat</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Nom</label>
            <input
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
              placeholder="Ex: KOFFI"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Prénom(s)</label>
            <input
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
              placeholder="Ex: Jean-Marie"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Sexe</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
            >
              <option value="">Sélectionner</option>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Date de Naissance</label>
            <input
              type="date"
              name="birthDate"
              value={formData.birthDate}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Lieu de Naissance</label>
            <input
              name="birthPlace"
              value={formData.birthPlace}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
              placeholder="Ex: Cotonou"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Voeux Académiques */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <div className="p-1.5 bg-indigo-50 rounded-lg">
            <GraduationCap className="w-4 h-4 text-indigo-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Vœux Académiques</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Niveau Souhaité</label>
            <select
              name="requestedLevelId"
              value={formData.requestedLevelId}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
              required
            >
              <option value="">Sélectionner un niveau</option>
              {levels.map(l => (
                <option key={l.id} value={l.id}>{l.label || l.code}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Classe Souhaitée (Optionnel)</label>
            <select
              name="requestedClassId"
              value={formData.requestedClassId}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
            >
              <option value="">Aucune préférence</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.code}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <input
            type="checkbox"
            id="wantsBilingual"
            name="wantsBilingual"
            checked={formData.wantsBilingual}
            onChange={handleInputChange}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <label htmlFor="wantsBilingual" className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Globe className="w-4 h-4 text-slate-400" />
            Candidature pour le cursus bilingue (Français/Anglais)
          </label>
        </div>
      </div>

      {/* Section 3: Responsable Légal */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <div className="p-1.5 bg-amber-50 rounded-lg">
            <Users className="w-4 h-4 text-amber-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Responsable Légal Principal</h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Nom complet du responsable</label>
            <input
              name="mainGuardianName"
              value={formData.mainGuardianName}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
              placeholder="Ex: M. KOFFI Emmanuel"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Téléphone</label>
              <input
                name="mainGuardianPhone"
                value={formData.mainGuardianPhone}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                placeholder="Ex: +229 90000000"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">E-mail</label>
              <input
                type="email"
                name="mainGuardianEmail"
                value={formData.mainGuardianEmail}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                placeholder="Ex: emmanuel.koffi@email.com"
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Hidden field for academic year */}
      <input type="hidden" name="academicYearId" value={formData.academicYearId} />

      {/* Submit button wrapper - can be handled by FormModal but good to have a backup or trigger */}
      <div className="hidden">
        <button type="submit" id="admission-form-submit">Submit</button>
      </div>
    </form>
  );
}
