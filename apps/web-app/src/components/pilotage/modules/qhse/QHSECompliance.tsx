/**
 * ============================================================================
 * QHSE REGULATORY COMPLIANCE (Standardisé)
 * ============================================================================
 */

'use client';

import { Scale, Clock, FileCheck, Shield, ExternalLink, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface ComplianceItem {
  id: string | number;
  requirement?: string;
  title?: string;
  name?: string;
  authority?: string;
  issuer?: string;
  dueDate?: string;
  deadline?: string;
  status?: string;
  progress?: number;
}

export default function QHSECompliance() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: complianceItems, loading, error } = useModulesList<ComplianceItem>('qhse', 'compliance', academicYear?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des exigences réglementaires...</span>
      </div>
    );
  }

  const overall = complianceItems.length > 0
    ? Math.round(complianceItems.reduce((acc, x) => acc + (x.progress ?? (x.status === 'CONFORME' ? 100 : 0)), 0) / complianceItems.length)
    : 0;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      {/* Compliance Header */}
      <div className="bg-emerald-600 rounded-xl p-8 text-white relative overflow-hidden shadow-xl">
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl">
                <Scale className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-semibold">Statut de Conformité</h3>
            </div>
            <p className="text-emerald-50 text-base leading-relaxed">
              Votre établissement est actuellement conforme à <span className="font-bold text-white underline">{overall}%</span> des exigences réglementaires QHSE.
            </p>
            <div className="flex items-center gap-4">
              <Button
                variant="secondary"
                className="bg-white text-emerald-600 hover:bg-emerald-50"
                onClick={() => toast({ title: 'Information', description: 'Certificat — fonctionnalité à venir.' })}
              >
                Télécharger Certificat
              </Button>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/10 flex flex-col justify-center">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-semibold">Progression Globale</span>
              <span className="text-2xl font-semibold">{overall}%</span>
            </div>
            <div className="w-full h-4 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-white transition-all duration-1000" style={{ width: `${overall}%` }} />
            </div>
            <p className="text-xs text-white/50 mt-4">
              Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>
        <div className="absolute -bottom-10 -right-10 opacity-10">
          <Shield className="w-64 h-64" />
        </div>
      </div>

      {complianceItems.length === 0 ? (
        <Card className="text-center py-16 text-slate-500 shadow-sm">
          Aucune exigence de conformité enregistrée pour cette année scolaire.
        </Card>
      ) : (
        /* Requirement List */
        <Card className="shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="px-6 py-4">Exigence / Obligation</TableHead>
                <TableHead className="px-6 py-4">Autorité</TableHead>
                <TableHead className="px-6 py-4">Date Échéance</TableHead>
                <TableHead className="px-6 py-4">Statut</TableHead>
                <TableHead className="px-6 py-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {complianceItems.map((item, i) => {
                const requirement = item.requirement || item.title || item.name || 'Exigence';
                const authority = item.authority || item.issuer || '—';
                const dueDate = item.dueDate || item.deadline || '—';
                const status = item.status || 'EN_ATTENTE';
                return (
                  <TableRow key={item.id ?? i} className="hover:bg-slate-50 cursor-pointer">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-2.5 rounded-lg ${
                          status === 'CONFORME' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          <FileCheck className="w-5 h-5" />
                        </div>
                        <p className="font-semibold text-slate-900">{requirement}</p>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-xs font-semibold text-slate-600">{authority}</TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                        <Clock className="w-4 h-4 text-slate-400" /> {dueDate}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <Badge variant="outline" className={
                        status === 'CONFORME' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        status === 'ALERTE' ? 'bg-rose-50 text-rose-600 border-rose-100' : ''
                      }>
                        {status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-600">
                        <ExternalLink className="w-5 h-5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
