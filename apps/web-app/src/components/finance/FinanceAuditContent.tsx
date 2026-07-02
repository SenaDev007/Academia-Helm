/**
 * Extension — Contrôle & Audit : alertes ORION, anomalies, historique audit
 *
 * Ce composant est utilisé directement par FinanceModulePage.
 * Il NE contient PAS de SubModuleNavigation (géré par ModuleContainer).
 */
'use client';

import { useState, useEffect } from 'react';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { financeService } from '@/services/finance.service';

export default function FinanceAuditContent() {
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      financeService.getAnomalies(30).catch(() => []),
      financeService.getAuditLogs(30).catch(() => []),
    ]).then(([a, l]) => {
      setAnomalies(Array.isArray(a) ? a : []);
      setAuditLogs(Array.isArray(l) ? l : []);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <ModuleContentArea
        layout="custom"
        toolbar={
          <p className="text-sm text-slate-600">
            Alertes ORION, anomalies financières, historique des actions.
          </p>
        }
      >
        <div className="rounded-lg border bg-amber-50/50 border-amber-200 p-4 mb-6">
          <h3 className="font-medium text-amber-900">ORION — Audit financier</h3>
          <p className="text-sm text-amber-800 mt-1">
            Synthèse des alertes : dépassements budget, écarts caisse, annulations, clôtures
            tardives. Brancher les indicateurs ORION sur les anomalies ci-dessous.
          </p>
        </div>

        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-slate-900">Anomalies détectées</h3>
          </div>
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
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500">
                    Chargement…
                  </TableCell>
                </TableRow>
              ) : anomalies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500">
                    Aucune anomalie.
                  </TableCell>
                </TableRow>
              ) : (
                anomalies.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.type}</TableCell>
                    <TableCell>
                      <Badge variant={a.severity === 'HIGH' ? 'destructive' : 'outline'}>
                        {a.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{a.referenceId}</TableCell>
                    <TableCell>
                      {a.detectedAt ? new Date(a.detectedAt).toLocaleString('fr-FR') : '—'}
                    </TableCell>
                    <TableCell>{a.resolved ? '✅ Oui' : '⏳ Non'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-slate-900">Historique audit</h3>
          </div>
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
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-500">
                    Aucun log.
                  </TableCell>
                </TableRow>
              ) : (
                auditLogs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <span className="font-medium">{l.entityType}</span>{' '}
                      <span className="text-xs text-slate-500">{l.entityId?.slice(0, 8)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{l.action}</Badge>
                    </TableCell>
                    <TableCell>
                      {l.performer
                        ? [l.performer.firstName, l.performer.lastName]
                            .filter(Boolean)
                            .join(' ')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {l.performedAt ? new Date(l.performedAt).toLocaleString('fr-FR') : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ModuleContentArea>
    </div>
  );
}
