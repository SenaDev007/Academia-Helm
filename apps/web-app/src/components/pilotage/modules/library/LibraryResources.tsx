/**
 * ============================================================================
 * LIBRARY RESOURCES & COPIES (Standardisé)
 * ============================================================================
 *
 * TODO: endpoint non disponible — garder mock. Aucun endpoint GET library/resources
 * n'est exposé par le backend modules-complementaires. Les exemplaires sont
 * actuellement gérés via library/books (et ses copies imbriquées).
 * ============================================================================
 */

'use client';

import { Book, MoreHorizontal, Plus, Download, Barcode } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function LibraryResources() {
  const copies = [
    { id: 'BC-0012', title: 'Le Petit Prince', copy: 'EX-001', barcode: '892311', status: 'AVAILABLE', condition: 'NEW', location: 'Rayon A1-4' },
    { id: 'BC-0013', title: 'Le Petit Prince', copy: 'EX-002', barcode: '892312', status: 'LOANED', condition: 'GOOD', location: 'Rayon A1-4' },
    { id: 'BC-0024', title: 'L\'Enfant Noir', copy: 'EX-001', barcode: '445210', status: 'RESERVED', condition: 'AVERAGE', location: 'Rayon B2-1' },
    { id: 'BC-0045', title: 'Physique 3ème', copy: 'EX-005', barcode: '112093', status: 'AVAILABLE', condition: 'DAMAGED', location: 'Rayon S-09' },
    { id: 'BC-0056', title: 'Dictionnaire Anglais', copy: 'EX-001', barcode: '778341', status: 'REPAIR', condition: 'UNUSABLE', location: 'Atelier' },
  ];

  const getStatusVariant = (status: string): 'outline' | 'secondary' | 'destructive' => {
    switch (status) {
      case 'AVAILABLE': return 'outline';
      case 'LOANED':
      case 'RESERVED': return 'secondary';
      case 'REPAIR':
      case 'LOST': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-900">Gestion des Exemplaires</h3>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" /> Exporter Inventaire
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" /> Ajouter Ressources
          </Button>
        </div>
      </div>

      <Card className="shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="px-6 py-4">Titre & Exemplaire</TableHead>
              <TableHead className="px-6 py-4">Code-Barres</TableHead>
              <TableHead className="px-6 py-4">Emplacement</TableHead>
              <TableHead className="px-6 py-4">État</TableHead>
              <TableHead className="px-6 py-4">Statut</TableHead>
              <TableHead className="px-6 py-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {copies.map((copy) => (
              <TableRow key={copy.id} className="hover:bg-slate-50">
                <TableCell className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-slate-100 rounded-lg">
                      <Book className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 leading-tight">{copy.title}</p>
                      <p className="text-xs text-slate-400">{copy.copy}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-6 py-4">
                  <div className="flex items-center text-xs font-semibold text-slate-600 bg-slate-50 w-fit px-3 py-1.5 rounded-lg border border-slate-100">
                    <Barcode className="w-4 h-4 mr-2 text-slate-400" />
                    {copy.barcode}
                  </div>
                </TableCell>
                <TableCell className="px-6 py-4 text-sm font-medium text-slate-600">{copy.location}</TableCell>
                <TableCell className="px-6 py-4">
                  <Badge variant="outline" className={
                    copy.condition === 'NEW' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                    copy.condition === 'DAMAGED' ? 'bg-rose-50 text-rose-600 border-rose-100' : ''
                  }>
                    {copy.condition}
                  </Badge>
                </TableCell>
                <TableCell className="px-6 py-4">
                  <Badge variant={getStatusVariant(copy.status)}>
                    {copy.status}
                  </Badge>
                </TableCell>
                <TableCell className="px-6 py-4 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="w-5 h-5 text-slate-400" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
