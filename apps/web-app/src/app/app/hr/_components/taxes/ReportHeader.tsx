'use client';

import { useState, useEffect } from 'react';
import { Loader2, Save, FileText, Building2, Users, CheckSquare } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';

export function ReportHeader({ initialSection }: { initialSection?: 'garde' | 'r1' | 'r2' | 'r3' | 'r4' }) {
  const { tenant, academicYear } = useModuleContext();
  const { currentYear } = useAcademicYear();
  // Use currentYear from useAcademicYear OR academicYear from useModuleContext as fallback
  const activeYearId = currentYear?.id || academicYear?.id;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'garde' | 'r1' | 'r2' | 'r3' | 'r4'>(initialSection || 'garde');

  // Update when initialSection changes
  useEffect(() => {
    if (initialSection) setActiveSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    if (!tenant?.id || !activeYearId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await hrFetch<any>(hrUrl('taxes/report-header', { tenantId: tenant.id, academicYearId: activeYearId }));
        setData(res);
      } catch (e: any) {
        console.error('ReportHeader load error:', e);
      } finally { setLoading(false); }
    })();
  }, [tenant?.id, activeYearId]);

  const handleSave = async () => {
    if (!tenant?.id || !activeYearId) return;
    setSaving(true);
    try {
      await hrFetch(hrUrl('taxes/report-header', { tenantId: tenant.id }), { method: 'PUT', body: { academicYearId: activeYearId, data } });
      toast({ variant: 'success', title: 'Enregistré' });
    } catch (e: any) {
      toast({ variant: 'error', title: 'Erreur', description: e.message });
    } finally { setSaving(false); }
  };

  const update = (field: string, value: any) => setData((prev: any) => ({ ...prev, [field]: value }));

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;
  if (!data) {
    // Initialize empty data structure if API returned null
    setData({
      pageGarde: { schoolName: '', address: '', city: '', country: '', phone: '', email: '', website: '', academicYear: '' },
      r1: { businessName: '', legalForm: '', capital: '', address: '', principalActivity: '',ifu: '', rccm: '', socialHeadquarters: '' },
      r2: { activityType: '', mainActivity: '', secondaryActivities: '', staffCount: '', revenue: '' },
      r3: { directors: [] },
      r4: { notes: [] },
    });
  }

  const sections = [
    { id: 'garde', label: 'Page de garde', icon: FileText },
    { id: 'r1', label: 'Fiche R1 — Identification', icon: Building2 },
    { id: 'r2', label: 'Fiche R2 — Activité', icon: Building2 },
    { id: 'r3', label: 'Fiche R3 — Dirigeants', icon: Users },
    { id: 'r4', label: 'Fiche R4 — Notes applicables', icon: CheckSquare },
  ] as const;

  const inputClass = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6]";
  const labelClass = "block text-xs font-semibold text-slate-600 mb-1.5";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">Fiches de renseignements</h3>
          <p className="text-xs text-slate-500 mt-0.5">Page de garde + Fiches R1 à R4 (SYSCOHADA)</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg bg-[#1A2BA6] hover:opacity-90 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
        </button>
      </div>

      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {sections.map(s => {
          const Icon = s.icon;
          return (
            <button key={s.id} onClick={() => setActiveSection(s.id)} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition ${activeSection === s.id ? 'border-[#1A2BA6] text-[#1A2BA6]' : 'border-transparent text-slate-500'}`}>
              <Icon className="h-3.5 w-3.5" /> {s.label}
            </button>
          );
        })}
      </div>

      {activeSection === 'garde' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h4 className="text-sm font-bold text-slate-900">Page de garde — États financiers normalisés</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelClass}>Centre de dépôt</label><input className={inputClass} value={data.centreDepot || ''} onChange={e => update('centreDepot', e.target.value)} /></div>
            <div><label className={labelClass}>Dénomination sociale</label><input className={inputClass} value={data.denominationSociale || ''} onChange={e => update('denominationSociale', e.target.value)} /></div>
            <div><label className={labelClass}>Sigle usuel</label><input className={inputClass} value={data.sigleUsuel || ''} onChange={e => update('sigleUsuel', e.target.value)} /></div>
            <div><label className={labelClass}>Exercice clos le</label><input className={inputClass} value={data.exerciceClosLe || ''} onChange={e => update('exerciceClosLe', e.target.value)} placeholder="31 décembre 2026" /></div>
            <div><label className={labelClass}>Durée exercice (mois)</label><input type="number" className={inputClass} value={data.dureeExerciceMois || 12} onChange={e => update('dureeExerciceMois', parseInt(e.target.value))} /></div>
          </div>
        </div>
      )}

      {activeSection === 'r1' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h4 className="text-sm font-bold text-slate-900">Fiche R1 — Identification de l'entité</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelClass}>Adresse</label><input className={inputClass} value={data.adresse || ''} onChange={e => update('adresse', e.target.value)} /></div>
            <div><label className={labelClass}>N° d'identification fiscale (IFU)</label><input className={inputClass} value={data.numeroIF || ''} onChange={e => update('numeroIF', e.target.value)} /></div>
            <div><label className={labelClass}>Greffe</label><input className={inputClass} value={data.greffe || ''} onChange={e => update('greffe', e.target.value)} /></div>
            <div><label className={labelClass}>N° Registre du commerce (RC)</label><input className={inputClass} value={data.numeroRC || ''} onChange={e => update('numeroRC', e.target.value)} /></div>
            <div><label className={labelClass}>N° Caisse sociale (CCSS)</label><input className={inputClass} value={data.numeroCCSS || ''} onChange={e => update('numeroCCSS', e.target.value)} /></div>
            <div><label className={labelClass}>N° Téléphone</label><input className={inputClass} value={data.numeroTelephone || ''} onChange={e => update('numeroTelephone', e.target.value)} /></div>
            <div className="sm:col-span-2"><label className={labelClass}>Adresse géographique complète</label><input className={inputClass} value={data.adresseGeoComplete || ''} onChange={e => update('adresseGeoComplete', e.target.value)} /></div>
            <div><label className={labelClass}>Forme juridique</label><input className={inputClass} value={data.formeJuridique || ''} onChange={e => update('formeJuridique', e.target.value)} /></div>
            <div><label className={labelClass}>Capital social</label><input className={inputClass} value={data.capitalSocial || ''} onChange={e => update('capitalSocial', e.target.value)} /></div>
            <div><label className={labelClass}>Nombre d'employés</label><input type="number" className={inputClass} value={data.nombreEmployes || 0} onChange={e => update('nombreEmployes', parseInt(e.target.value))} /></div>
            <div><label className={labelClass}>Référentiel bancaire</label><input className={inputClass} value={data.referentielBancaire || ''} onChange={e => update('referentielBancaire', e.target.value)} /></div>
          </div>
        </div>
      )}

      {activeSection === 'r2' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h4 className="text-sm font-bold text-slate-900">Fiche R2 — Activité de l'entité</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelClass}>Régime fiscal</label><input className={inputClass} value={data.regimeFiscal || ''} onChange={e => update('regimeFiscal', e.target.value)} /></div>
            <div><label className={labelClass}>Pays du siège social</label><input className={inputClass} value={data.paysSiegeSocial || ''} onChange={e => update('paysSiegeSocial', e.target.value)} /></div>
            <div><label className={labelClass}>Nb établissements dans le pays</label><input type="number" className={inputClass} value={data.nbEtablissementsPays || 0} onChange={e => update('nbEtablissementsPays', parseInt(e.target.value))} /></div>
            <div><label className={labelClass}>Nb établissements hors pays</label><input type="number" className={inputClass} value={data.nbEtablissementsHorsPays || 0} onChange={e => update('nbEtablissementsHorsPays', parseInt(e.target.value))} /></div>
            <div><label className={labelClass}>1ère année d'exercice</label><input className={inputClass} value={data.premiereAnneeExercice || ''} onChange={e => update('premiereAnneeExercice', e.target.value)} /></div>
            <div><label className={labelClass}>Désignation de l'activité</label><input className={inputClass} value={data.activiteDesignation || ''} onChange={e => update('activiteDesignation', e.target.value)} /></div>
            <div className="sm:col-span-2"><label className={labelClass}>Localisation de l'activité</label><input className={inputClass} value={data.activiteLocalisation || ''} onChange={e => update('activiteLocalisation', e.target.value)} /></div>
            <div><label className={labelClass}>Nombre de salariés</label><input type="number" className={inputClass} value={data.nbSalaries || 0} onChange={e => update('nbSalaries', parseInt(e.target.value))} /></div>
            <div><label className={labelClass}>Chiffre d'affaires</label><input type="number" className={inputClass} value={data.chiffreAffaires || 0} onChange={e => update('chiffreAffaires', parseFloat(e.target.value))} /></div>
            <div><label className={labelClass}>Parts de marché</label><input className={inputClass} value={data.partsMarche || ''} onChange={e => update('partsMarche', e.target.value)} /></div>
            <div><label className={labelClass}>Exportations</label><input className={inputClass} value={data.exportations || ''} onChange={e => update('exportations', e.target.value)} /></div>
          </div>
        </div>
      )}

      {activeSection === 'r3' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h4 className="text-sm font-bold text-slate-900">Fiche R3 — Dirigeants et Conseil d'Administration</h4>
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Dirigeants (JSON: nom, prénoms, qualité, N° IF, adresse)</label>
              <textarea className={inputClass + ' font-mono text-xs'} rows={4} value={JSON.stringify(data.dirigeants || [], null, 2)} onChange={e => { try { update('dirigeants', JSON.parse(e.target.value)); } catch {} }} />
            </div>
            <div>
              <label className={labelClass}>Membres du Conseil d'Administration</label>
              <textarea className={inputClass + ' font-mono text-xs'} rows={4} value={JSON.stringify(data.membresConseil || [], null, 2)} onChange={e => { try { update('membresConseil', JSON.parse(e.target.value)); } catch {} }} />
            </div>
            <div>
              <label className={labelClass}>Commissaires aux comptes</label>
              <textarea className={inputClass + ' font-mono text-xs'} rows={4} value={JSON.stringify(data.commissairesComptes || [], null, 2)} onChange={e => { try { update('commissairesComptes', JSON.parse(e.target.value)); } catch {} }} />
            </div>
          </div>
        </div>
      )}

      {activeSection === 'r4' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h4 className="text-sm font-bold text-slate-900">Fiche R4 — Notes applicables</h4>
          <p className="text-xs text-slate-500">Cochez les notes applicables à votre entité.</p>
          <textarea className={inputClass + ' font-mono text-xs'} rows={8} value={JSON.stringify(data.notesApplicables || [], null, 2)} onChange={e => { try { update('notesApplicables', JSON.parse(e.target.value)); } catch {} }} />
        </div>
      )}
    </div>
  );
}
