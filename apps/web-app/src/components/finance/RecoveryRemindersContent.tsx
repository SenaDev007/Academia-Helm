'use client';

import { useState, useEffect } from 'react';
import { Send, Unlock, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  ModuleHeader,
  SubModuleNavigation,
  ModuleContentArea,
} from '@/components/modules/blueprint';
import { FINANCE_SUBMODULE_TABS } from '@/components/finance/finance-tabs';
import { useModuleContext } from '@/hooks/useModuleContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function RecoveryRemindersContent() {
  const { academicYear } = useModuleContext();
  const [reminders, setReminders] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState('');
  const [manualModal, setManualModal] = useState(false);
  const [manualAccountId, setManualAccountId] = useState('');
  const [manualLevel, setManualLevel] = useState('WARNING');
  const [runNightlyLoading, setRunNightlyLoading] = useState(false);

  const loadReminders = async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/recovery-reminders?academicYearId=${academicYear.id}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setReminders(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
  }, [academicYear?.id]);

  useEffect(() => {
    if (!academicYear?.id) return;
    fetch(`/api/finance/student-accounts?academicYearId=${academicYear.id}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setAccounts(Array.isArray(d) ? d : []));
  }, [academicYear?.id]);

  const handleSendManual = async () => {
    if (!manualAccountId) return;
    try {
      const res = await fetch('/api/finance/recovery-reminders/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ studentAccountId: manualAccountId, level: manualLevel, channel: 'SMS' }),
      });
      if (res.ok) {
        setManualModal(false);
        loadReminders();
      } else {
        const err = await res.json();
        alert(err?.message || err?.error || 'Erreur');
      }
    } catch {
      alert('Erreur réseau');
    }
  };

  const handleRunNightly = async () => {
    setRunNightlyLoading(true);
    try {
      const res = await fetch('/api/finance/recovery-reminders/run-nightly', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Traitement : ${data.processed} comptes, ${data.created?.length ?? 0} rappels créés.`);
        loadReminders();
      }
    } catch {
      alert('Erreur');
    } finally {
      setRunNightlyLoading(false);
    }
  };

  const formatXOF = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);
  const subModuleTabs = FINANCE_SUBMODULE_TABS.map((t) => ({ id: t.id, label: t.label, path: t.path, icon: <t.icon className="w-4 h-4" /> }));

  const levelBadge = (level: string) => {
    const v = level === 'FINAL_NOTICE' ? 'destructive' : level === 'URGENT' ? 'default' : 'secondary';
    return <Badge variant={v}>{level}</Badge>;
  };

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Recouvrement"
        description="Relances automatiques (WARNING J+3, URGENT J+7, FINAL_NOTICE J+15) et blocage selon seuil."
        icon="finance"
        actions={
          <>
            <Button variant="outline" onClick={() => setManualModal(true)}>
              <Send className="w-4 h-4 mr-2" />
              Envoyer rappel manuel
            </Button>
            <Button variant="outline" onClick={handleRunNightly} disabled={runNightlyLoading}>
              <Play className="w-4 h-4 mr-2" />
              {runNightlyLoading ? 'Traitement...' : 'Lancer détection'}
            </Button>
          </>
        }
      />
      <SubModuleNavigation tabs={subModuleTabs} currentPath="/app/finance/collection" />

      <ModuleContentArea layout="custom">
        <div className="mb-4 flex flex-wrap gap-4 items-center">
          <span className="text-sm text-gray-600">Année : {academicYear?.label ?? '—'}</span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Élève</TableHead>
              <TableHead>Solde</TableHead>
              <TableHead>Niveau</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-gray-500">Chargement...</TableCell></TableRow>
            ) : reminders.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-gray-500">Aucune relance.</TableCell></TableRow>
            ) : (
              reminders.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.studentAccount?.student ? `${r.studentAccount.student.lastName} ${r.studentAccount.student.firstName}` : r.studentAccountId}
                  </TableCell>
                  <TableCell>{formatXOF(Number(r.amountDue))}</TableCell>
                  <TableCell>{levelBadge(r.reminderLevel)}</TableCell>
                  <TableCell>{r.sentVia}</TableCell>
                  <TableCell>{r.sentAt ? new Date(r.sentAt).toLocaleDateString('fr-FR') : '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ModuleContentArea>

      {manualModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="bg-white rounded-xl p-6 max-w-md border border-blue-100 shadow-2xl"
          >
            <h3 className="text-lg font-semibold mb-4">Rappel manuel</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Compte élève</label>
                <Select value={manualAccountId} onValueChange={setManualAccountId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {accounts.filter((a) => Number(a.balance) > 0).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.student ? `${a.student.lastName} ${a.student.firstName}` : a.id} — {formatXOF(Number(a.balance))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Niveau</label>
                <Select value={manualLevel} onValueChange={setManualLevel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WARNING">WARNING</SelectItem>
                    <SelectItem value="URGENT">URGENT</SelectItem>
                    <SelectItem value="FINAL_NOTICE">FINAL_NOTICE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setManualModal(false)}>Annuler</Button>
                <Button onClick={handleSendManual} disabled={!manualAccountId}>Envoyer</Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
