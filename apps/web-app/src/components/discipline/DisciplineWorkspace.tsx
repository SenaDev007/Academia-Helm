'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, Plus, Trash2, AlertTriangle, CheckCircle2, Loader2,
  Gavel, BookOpen, Settings, X, Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';
import { cn } from '@/lib/utils';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface DisciplineRule {
  id: string;
  name: string;
  description?: string;
  hours_penalty: number;
  points_deducted: number;
  severity: string;
  isActive: boolean;
}

interface Sanction {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  fault_name: string;
  hours_attributed: number;
  points_deducted: number;
  sanction_date: string;
  status: string;
  comment?: string;
}

interface ConductLedger {
  studentId: string;
  studentName: string;
  className: string;
  conduct_reference: number;
  total_points_deducted: number;
  conduct_final: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  MINOR: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  MODERATE: 'bg-orange-100 text-orange-800 border-orange-300',
  MAJOR: 'bg-red-100 text-red-800 border-red-300',
  CRITICAL: 'bg-red-200 text-red-900 border-red-400',
};

const SEVERITY_LABELS: Record<string, string> = {
  MINOR: 'Mineure',
  MODERATE: 'Modérée',
  MAJOR: 'Grave',
  CRITICAL: 'Critique',
};

export default function DisciplineWorkspace({
  tenant,
  academicYear,
  schoolLevelId,
}: {
  tenant?: any;
  academicYear?: any;
  schoolLevelId?: string;
}) {
  const [activeTab, setActiveTab] = useState<'sanctions' | 'conduct' | 'rules'>('sanctions');
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<DisciplineRule[]>([]);
  const [sanctions, setSanctions] = useState<Sanction[]>([]);
  const [conductLedger, setConductLedger] = useState<ConductLedger[]>([]);
  const [showSanctionModal, setShowSanctionModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    if (!academicYear?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const authHeaders = getClientAuthorizationHeader();
      const params = new URLSearchParams({ academicYearId: academicYear.id });
      if (schoolLevelId) params.set('schoolLevelId', schoolLevelId);

      const [rulesRes, sanctionsRes, conductRes] = await Promise.all([
        fetch(`/api/discipline/rules?${params}`, { headers: { ...authHeaders }, credentials: 'include' }).catch(() => null),
        fetch(`/api/discipline/sanctions?${params}`, { headers: { ...authHeaders }, credentials: 'include' }).catch(() => null),
        fetch(`/api/discipline/conduct?${params}`, { headers: { ...authHeaders }, credentials: 'include' }).catch(() => null),
      ]);

      if (rulesRes?.ok) { const d = await rulesRes.json(); setRules(Array.isArray(d) ? d : []); }
      if (sanctionsRes?.ok) { const d = await sanctionsRes.json(); setSanctions(Array.isArray(d) ? d : []); }
      if (conductRes?.ok) { const d = await conductRes.json(); setConductLedger(Array.isArray(d) ? d : []); }
    } catch (err) { console.error('Discipline load error:', err); }
    finally { setLoading(false); }
  }, [academicYear?.id, schoolLevelId]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredSanctions = sanctions.filter(s =>
    !searchQuery || s.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) || s.fault_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredConduct = conductLedger.filter(c =>
    !searchQuery || c.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) || c.className?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" /> Discipline & Vie Scolaire
          </h2>
          <p className="text-sm text-gray-600 mt-1">Gestion des sanctions, compteur de conduite et présences</p>
        </div>
        <Button onClick={() => setShowSanctionModal(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> Nouvelle sanction
        </Button>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: 'sanctions', label: 'Sanctions', icon: Gavel },
          { id: 'conduct', label: 'Compteur de conduite', icon: BookOpen },
          { id: 'rules', label: 'Barème des fautes', icon: Settings },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
              activeTab === tab.id ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab !== 'rules' && (
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher..." className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : activeTab === 'sanctions' ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="bg-gray-50">
              <TableHead className="whitespace-nowrap">Élève</TableHead>
              <TableHead className="whitespace-nowrap">Classe</TableHead>
              <TableHead className="whitespace-nowrap">Faute</TableHead>
              <TableHead className="text-right whitespace-nowrap">Heures</TableHead>
              <TableHead className="text-right whitespace-nowrap">Points</TableHead>
              <TableHead className="whitespace-nowrap">Date</TableHead>
              <TableHead className="text-center whitespace-nowrap">Statut</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filteredSanctions.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-500 py-8">Aucune sanction.</TableCell></TableRow>
              ) : filteredSanctions.map(s => (
                <TableRow key={s.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium whitespace-nowrap">{s.studentName}</TableCell>
                  <TableCell className="whitespace-nowrap">{s.className || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap">{s.fault_name}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{s.hours_attributed}h</TableCell>
                  <TableCell className="text-right font-bold text-red-600 whitespace-nowrap">-{s.points_deducted}</TableCell>
                  <TableCell className="whitespace-nowrap">{new Date(s.sanction_date).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {s.status === 'ACTIVE' ? <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">Active</span>
                    : <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">Annulée</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : activeTab === 'conduct' ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="bg-gray-50">
              <TableHead className="whitespace-nowrap">Élève</TableHead>
              <TableHead className="whitespace-nowrap">Classe</TableHead>
              <TableHead className="text-right whitespace-nowrap">Référence</TableHead>
              <TableHead className="text-right whitespace-nowrap">Déduits</TableHead>
              <TableHead className="text-right whitespace-nowrap">Conduite</TableHead>
              <TableHead className="text-center whitespace-nowrap">Statut</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filteredConduct.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-gray-500 py-8">Aucune donnée. Les données apparaîtront après la première sanction.</TableCell></TableRow>
              ) : filteredConduct.map((c, i) => {
                const isCritical = c.conduct_final <= 5;
                const isWarning = c.conduct_final <= 10 && c.conduct_final > 5;
                return (
                  <TableRow key={i} className="hover:bg-slate-50">
                    <TableCell className="font-medium whitespace-nowrap">{c.studentName}</TableCell>
                    <TableCell className="whitespace-nowrap">{c.className || '—'}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{c.conduct_reference}</TableCell>
                    <TableCell className="text-right font-bold text-red-600 whitespace-nowrap">-{c.total_points_deducted}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <span className={cn('font-bold px-2 py-0.5 rounded',
                        isCritical ? 'bg-red-100 text-red-700' : isWarning ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700')}>
                        {c.conduct_final}
                      </span>
                    </TableCell>
                    <TableCell className="text-center whitespace-nowrap">
                      {isCritical ? <span className="text-red-600 text-xs font-bold flex items-center justify-center gap-1"><AlertTriangle className="w-3 h-3" /> Critique</span>
                      : isWarning ? <span className="text-orange-600 text-xs font-bold">Attention</span>
                      : <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="bg-gray-50">
              <TableHead className="whitespace-nowrap">Faute</TableHead>
              <TableHead className="whitespace-nowrap">Description</TableHead>
              <TableHead className="text-right whitespace-nowrap">Heures</TableHead>
              <TableHead className="text-right whitespace-nowrap">Points</TableHead>
              <TableHead className="text-center whitespace-nowrap">Gravité</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-500 py-8">Aucune règle configurée.</TableCell></TableRow>
              ) : rules.map(r => (
                <TableRow key={r.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium whitespace-nowrap">{r.name}</TableCell>
                  <TableCell className="text-sm text-gray-600 whitespace-nowrap">{r.description || '—'}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{r.hours_penalty}h</TableCell>
                  <TableCell className="text-right font-bold text-red-600 whitespace-nowrap">-{r.points_deducted}</TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold border', SEVERITY_COLORS[r.severity])}>
                      {SEVERITY_LABELS[r.severity] || r.severity}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {showSanctionModal && (
        <SanctionModal onClose={() => setShowSanctionModal(false)} onSuccess={() => { loadData(); setShowSanctionModal(false); }}
          rules={rules} academicYearId={academicYear?.id} schoolLevelId={schoolLevelId} />
      )}
    </div>
  );
}

function SanctionModal({ onClose, onSuccess, rules, academicYearId, schoolLevelId }: {
  onClose: () => void; onSuccess: () => void; rules: DisciplineRule[]; academicYearId?: string; schoolLevelId?: string;
}) {
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedRuleId, setSelectedRuleId] = useState('');
  const [customFaultName, setCustomFaultName] = useState('');
  const [hours, setHours] = useState(0);
  const [points, setPoints] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const { toast } = useToast();

  const searchStudents = async (query: string) => {
    if (query.length < 2) { setSearchResults([]); return; }
    try {
      const authHeaders = getClientAuthorizationHeader();
      const res = await fetch(`/api/students?search=${encodeURIComponent(query)}&limit=10`, { headers: { ...authHeaders }, credentials: 'include' });
      if (res.ok) { const data = await res.json(); setSearchResults(Array.isArray(data?.students) ? data.students : Array.isArray(data) ? data : []); }
    } catch {}
  };

  const handleRuleSelect = (ruleId: string) => {
    setSelectedRuleId(ruleId);
    const rule = rules.find(r => r.id === ruleId);
    if (rule) { setCustomFaultName(rule.name); setHours(rule.hours_penalty); setPoints(rule.points_deducted); }
  };

  const handleSave = async () => {
    if (!selectedStudent || !academicYearId) { toast({ title: 'Erreur', description: 'Sélectionnez un élève', variant: 'destructive' }); return; }
    if (!customFaultName.trim()) { toast({ title: 'Erreur', description: 'Nommez la faute', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const authHeaders = getClientAuthorizationHeader();
      const res = await fetch('/api/discipline/sanctions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, credentials: 'include',
        body: JSON.stringify({ studentId: selectedStudent.id, ruleId: selectedRuleId || null, faultName: customFaultName,
          hoursAttributed: hours, pointsDeducted: points, academicYearId, schoolLevelId: schoolLevelId || null, comment: comment || null }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: '✅ Sanction enregistrée', description: `${points} points déduits` });
      onSuccess();
    } catch (err: any) { toast({ title: 'Erreur', description: err.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-bold">Nouvelle sanction</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Élève</label>
            {selectedStudent ? (
              <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                <span className="text-sm font-medium">{selectedStudent.lastName} {selectedStudent.firstName}</span>
                <button onClick={() => { setSelectedStudent(null); setStudentSearch(''); }} className="text-xs text-red-500">Changer</button>
              </div>
            ) : (
              <>
                <input type="text" value={studentSearch} onChange={(e) => { setStudentSearch(e.target.value); searchStudents(e.target.value); }}
                  placeholder="Nom de l'élève..." className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
                {searchResults.length > 0 && (
                  <div className="mt-1 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                    {searchResults.map(s => (
                      <button key={s.id} onClick={() => { setSelectedStudent(s); setSearchResults([]); setStudentSearch(''); }}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm">{s.lastName} {s.firstName} — {s.className || ''}</button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Faute (barème)</label>
            <select value={selectedRuleId} onChange={(e) => handleRuleSelect(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
              <option value="">— Personnalisée —</option>
              {rules.map(r => <option key={r.id} value={r.id}>{r.name} ({r.hours_penalty}h, -{r.points_deducted}pts)</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nom de la faute</label>
            <input type="text" value={customFaultName} onChange={(e) => setCustomFaultName(e.target.value)} placeholder="Ex: Retard, Bavardage..." className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Heures de punition</label>
              <input type="number" value={hours} onChange={(e) => setHours(Number(e.target.value) || 0)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Points déduits</label>
              <input type="number" step="0.5" value={points} onChange={(e) => setPoints(Number(e.target.value) || 0)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Commentaire (optionnel)</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving || !selectedStudent}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Gavel className="w-4 h-4 mr-2" />} Enregistrer
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
