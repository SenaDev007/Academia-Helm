/**
 * ============================================================================
 * MEDICAL RECORDS TAB
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance — <Input>/<Button>
 * shadcn, <Table> shadcn, Cards rounded-xl, plus de font-black uppercase
 * tracking-widest, plus de bg-navy-900 sur boutons.
 *
 * NOTE : endpoint non disponible en mode liste — garder le mock en attendant
 * un endpoint GET infirmary/medical-records (global). Le backend expose
 * uniquement GET infirmary/medical-records/:studentId (par élève).
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import {
  Search,
  Filter,
  Heart,
  ShieldAlert,
  ChevronRight,
  MoreVertical,
  Plus,
  Download,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function MedicalRecords() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Rechercher un élève par nom, matricule..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Filtres
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau Dossier
          </Button>
        </div>
      </div>

      {/* Records Table */}
      <Card className="shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Élève</TableHead>
              <TableHead>Groupe Sanguin</TableHead>
              <TableHead>Vigilance</TableHead>
              <TableHead>Dernière Visite</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              { name: 'Jean Dupont', id: 'MAT-2024-001', class: '6ème A', blood: 'A+', alerts: ['Allergie Arachide'], lastVisit: '12/05/2024', status: 'CRITICAL' },
              { name: 'Marie Kassa', id: 'MAT-2024-045', class: 'CM2 B', blood: 'O+', alerts: [], lastVisit: '10/04/2024', status: 'STABLE' },
              { name: 'Koffi Mensah', id: 'MAT-2023-112', class: 'Terminal D', blood: 'B-', alerts: ['Asthme'], lastVisit: '02/05/2024', status: 'MODERATE' },
              { name: 'Sarah Lawson', id: 'MAT-2024-089', class: '3ème B', blood: 'AB+', alerts: [], lastVisit: '20/05/2024', status: 'STABLE' },
              { name: 'Marc Yao', id: 'MAT-2024-121', class: 'CE1', blood: 'A-', alerts: ['Allergie Latex'], lastVisit: 'Jamais', status: 'STABLE' },
            ].map((record, i) => (
              <TableRow
                key={i}
                className="hover:bg-slate-50 transition-colors group cursor-pointer"
              >
                <TableCell className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                      {record.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-navy-900 group-hover:text-blue-600 transition-colors">{record.name}</p>
                      <p className="text-xs text-slate-500">{record.class} • {record.id}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-6 py-4">
                  <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-100">
                    <Heart className="w-3 h-3 mr-1 fill-rose-500" />
                    {record.blood}
                  </Badge>
                </TableCell>
                <TableCell className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {record.alerts.length > 0 ? record.alerts.map((alert, j) => (
                      <Badge key={j} variant="outline" className="bg-amber-50 text-amber-700 border-amber-100">
                        <ShieldAlert className="w-3 h-3 mr-1" />
                        {alert}
                      </Badge>
                    )) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="px-6 py-4 text-sm text-slate-600 font-medium">
                  {record.lastVisit}
                </TableCell>
                <TableCell className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100" title="Télécharger le dossier">
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
        <p className="text-sm text-slate-500">
          Affichage de <span className="font-bold text-navy-900">5</span> sur <span className="font-bold text-navy-900">128</span> dossiers
        </p>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" disabled>Précédent</Button>
          <Button variant="outline" size="sm">Suivant</Button>
        </div>
      </div>
    </div>
  );
}
