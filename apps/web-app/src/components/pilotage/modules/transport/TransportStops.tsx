'use client';

import { MapPin, Plus, Search, Navigation, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useToast } from '@/components/ui/use-toast';

interface RouteStop {
  id?: string;
  name?: string;
  label?: string;
  zone?: string;
  zoneName?: string;
  students?: number;
  studentCount?: number;
  arrivalTime?: string;
  estimatedTime?: string;
  type?: string;
  stopType?: string;
  [key: string]: any;
}

interface RouteItem {
  id: string;
  name?: string;
  stops?: RouteStop[] | number;
  stopsList?: RouteStop[];
  [key: string]: any;
}

export default function TransportStops() {
  const { academicYear } = useModuleContext();
  const { data, loading, error } = useModulesList<RouteItem>('transport', 'routes', academicYear?.id);
  const { toast } = useToast();

  // Les arrêts sont imbriqués dans les routes — on les aplatit
  const routes = data ?? [];
  const stops: (RouteStop & { routeId?: string; routeName?: string })[] = routes.flatMap((route) => {
    const stopList: RouteStop[] = Array.isArray(route.stops) ? route.stops : (route.stopsList ?? []);
    return stopList.map((s, idx) => ({
      ...s,
      id: s.id ?? `${route.id}-${idx}`,
      routeId: route.id,
      routeName: route.name,
    }));
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement...</span>
      </div>
    );
  }

  const handleNotImplemented = () => {
    toast({
      title: 'Action non disponible',
      description: "L'ajout d'arrêt se fait via l'onglet Itinéraires (bouton « Gérer les arrêts »).",
    });
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Rechercher un arrêt..."
            className="pl-10"
          />
        </div>
        <Button onClick={handleNotImplemented}>
          <Plus className="w-4 h-4" /> Nouvel Arrêt
        </Button>
      </div>

      {stops.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          Aucune donnée disponible pour cette année scolaire.
        </div>
      ) : (
        <Card className="shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="px-4 py-3">Point d'arrêt</TableHead>
                  <TableHead className="px-4 py-3">Zone</TableHead>
                  <TableHead className="px-4 py-3">Type</TableHead>
                  <TableHead className="px-4 py-3 text-center">Élèves</TableHead>
                  <TableHead className="px-4 py-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stops.map((stop) => {
                  const name = stop.name || stop.label || `Arrêt ${stop.id}`;
                  const zone = stop.zone || stop.zoneName || stop.routeName || '—';
                  const students = stop.students ?? stop.studentCount ?? 0;
                  const arrivalTime = stop.arrivalTime || stop.estimatedTime || '—';
                  const type = stop.type || stop.stopType || 'QUARTIER';
                  return (
                    <TableRow key={stop.id} className="hover:bg-slate-50">
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-xl bg-indigo-50 text-indigo-700">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{name}</p>
                            <p className="text-xs text-gray-500">Heure estimée: {arrivalTime}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-700">{zone}</span>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge variant="outline">{type}</Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center">
                        <Badge variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50">
                          {students}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm">
                          <Navigation className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
