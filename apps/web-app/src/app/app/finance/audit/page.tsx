/**
 * Extension — Contrôle & Audit : alertes ORION, anomalies, historique audit
 */
'use client';

import { useState, useEffect } from 'react';
import { ModuleHeader, SubModuleNavigation, ModuleContentArea } from '@/components/modules/blueprint';
import { FINANCE_SUBMODULE_TABS } from '@/components/finance/finance-tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function FinanceAuditPage() {
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/finance/anomalies?limit=30', { credentials: 'include' }).then((r) => (r.ok ? r.json() : [])),
      fetch('/api/finance/audit-logs?limit=30', { credentials: 'include' }).then((r) => (r.ok ? r.json() : [])),
    ]).then(([a, l]) => {
      setAnomalies(Array.isArray(a) ? a : []);
      setAuditLogs(Array.isArray(l) ? l : []);
    }).finally(() => setLoading(false));
  }, []);

  const subModuleTabs = FINANCE_SUBMODULE_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    path: t.path,
    icon: <t.icon className="w-4 h-4" />,
  }));

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Contrôle & Audit"
        description="Alertes ORION, anomalies financières, historique des actions."
        icon="finance"
      />
      <SubModuleNavigation tabs={subModuleTabs} currentPath="/app/finance/audit" />
      <ModuleContentArea layout="custom">
        <div className="rounded-lg border bg-amber-50/50 border-amber-200 p-4 mb-6">
          <h3 className="font-medium text-amber-900">ORION — Audit financier</h3>
          <p className="text-sm text-amber-800 mt-1">Synthèse des alertes : dépassements budget, écarts caisse, annulations, clôtures tardives. Brancher les indicateurs ORION sur les anomalies ci-dessous.</p>
        </div>
        <h3 className="font-medium mb-2">Anomalies détectées</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Gravité</TableHead>
              <TableHead>Référence</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Résolu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-gray-500">Chargement…</TableCell></TableRow>
            ) : anomalies.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-gray-500">Aucune anomalie.</TableCell></TableRow>
            ) : (
              anomalies.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.type}</TableCell>
                  <TableCell><Badge variant={a.severity === 'HIGH' ? 'destructive' : 'outline'}>{a.severity}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{a.referenceId}</TableCell>
                  <TableCell>{a.detectedAt ? new Date(a.detectedAt).toLocaleString('fr-FR') : '—'}</TableCell>
                  <TableCell>{a.resolved ? 'Oui' : 'Non'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <h3 className="font-medium mb-2 mt-8">Historique audit</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entité</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Par</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditLogs.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-gray-500">Aucun log.</TableCell></TableRow>
            ) : (
              auditLogs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.entityType} {l.entityId?.slice(0, 8)}</TableCell>
                  <TableCell>{l.action}</TableCell>
                  <TableCell>{l.performer ? [l.performer.firstName, l.performer.lastName].filter(Boolean).join(' ') : '—'}</TableCell>
                  <TableCell>{l.performedAt ? new Date(l.performedAt).toLocaleString('fr-FR') : '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ModuleContentArea>
    </div>
  );
}
