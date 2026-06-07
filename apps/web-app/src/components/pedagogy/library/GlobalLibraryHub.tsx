'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Filter, 
  Book, 
  Video, 
  FileText, 
  Headphones, 
  Link as LinkIcon, 
  Eye, 
  Download, 
  MoreVertical,
  X,
  MessageSquare,
  History,
  Star,
  ChevronRight,
  Info
} from 'lucide-react';
import { globalLibraryClient, GlobalPedagogicalResource } from '@/lib/pedagogy/global-library-client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { GlobalLibraryAdmin } from './GlobalLibraryAdmin';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

const RESOURCE_ICONS: Record<string, any> = {
  PDF: FileText,
  VIDEO: Video,
  AUDIO: Headphones,
  DOC: Book,
  LINK: LinkIcon,
};

const RESOURCE_COLORS: Record<string, string> = {
  PDF: 'text-red-500 bg-red-50',
  VIDEO: 'text-purple-500 bg-purple-50',
  AUDIO: 'text-blue-500 bg-blue-50',
  DOC: 'text-blue-600 bg-blue-50',
  LINK: 'text-emerald-500 bg-emerald-50',
};

export function GlobalLibraryHub() {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const { user } = useAuth();
  const [resources, setResources] = useState<GlobalPedagogicalResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedResource, setSelectedResource] = useState<GlobalPedagogicalResource | null>(null);
  const [currentAnnotation, setCurrentAnnotation] = useState('');
  const [filters, setFilters] = useState({
    level: '',
    classLevel: '',
    subject: '',
    resourceType: '',
  });

  useEffect(() => {
    fetchResources();
  }, [filters]);

  const fetchResources = async () => {
    setLoading(true);
    try {
      const data = await globalLibraryClient.findAll({ ...filters, search }) as GlobalPedagogicalResource[];
      setResources(data);
      // Cache for offline
      if (typeof window !== 'undefined') {
        localStorage.setItem('cached_library_resources', JSON.stringify(data));
      }
    } catch (error) {
      console.error('Error fetching resources:', error);
      // Fallback to cache
      const cached = localStorage.getItem('cached_library_resources');
      if (cached) {
        setResources(JSON.parse(cached));
        toast({ title: 'Mode Hors-ligne', description: 'Affichage des ressources mises en cache.' });
      } else {
        toast({ title: 'Erreur', description: 'Impossible de charger la bibliothèque.', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchResources();
  };

  const openResource = async (resource: GlobalPedagogicalResource) => {
    setSelectedResource(resource);
    // Log usage
    if (user?.staffId) {
      try {
        globalLibraryClient.logUsage(resource.id, user.staffId);
        // Load annotation
        const annotation = await globalLibraryClient.getAnnotation(resource.id, user.staffId);
        setCurrentAnnotation(annotation?.note || '');
      } catch (e) {
        console.warn('Could not log usage or load annotation', e);
        // Check local storage for offline annotation
        const local = localStorage.getItem('local_annotations');
        if (local) {
          const annots = JSON.parse(local);
          setCurrentAnnotation(annots[`${resource.id}_${user.staffId}`]?.note || '');
        }
      }
    }
  };

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header section with Premium feel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-br from-blue-900 to-indigo-900 rounded-2xl p-8 text-white shadow-xl">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Bibliothèque Globale Academia</h1>
          <p className="text-blue-100 opacity-90 text-lg">Hub pédagogique intelligent & ressources institutionnelles</p>
        </div>
        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20">
          <div className="text-center px-4 border-r border-white/20">
            <div className="text-2xl font-bold">{resources.length}</div>
            <div className="text-xs uppercase tracking-wider opacity-70">Ressources</div>
          </div>
          <div className="text-center px-4">
            <div className="text-2xl font-bold">ORION</div>
            <div className="text-xs uppercase tracking-wider opacity-70">Intelligence</div>
          </div>
        </div>
      </div>

      {/* Admin management section */}
      {(user?.role === 'PLATFORM_OWNER' || user?.role === 'PLATFORM_ADMIN') && (
        <div className="flex justify-end">
          <GlobalLibraryAdmin onResourceCreated={fetchResources} />
        </div>
      )}

      {/* Search and Filters */}
      <Card className="p-4 border-none shadow-md bg-white/80 backdrop-blur-sm sticky top-4 z-10">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Recherche intelligente (matière, titre, thématique...)" 
              className="pl-10 h-11 bg-slate-50 border-slate-200 focus:bg-white transition-all"
            />
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <select 
              className="h-11 px-3 rounded-md border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.level}
              onChange={(e) => setFilters({...filters, level: e.target.value})}
            >
              <option value="">Niveau</option>
              <option value="MATERNELLE">Maternelle</option>
              <option value="PRIMAIRE">Primaire</option>
              <option value="SECONDAIRE">Secondaire</option>
            </select>

            <select 
              className="h-11 px-3 rounded-md border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.resourceType}
              onChange={(e) => setFilters({...filters, resourceType: e.target.value})}
            >
              <option value="">Type</option>
              <option value="PDF">PDF</option>
              <option value="VIDEO">Vidéo</option>
              <option value="AUDIO">Audio</option>
              <option value="LINK">Lien externe</option>
            </select>

            <Button type="submit" className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
              Rechercher
            </Button>
          </div>
        </form>
      </Card>

      {/* ORION Insights section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 p-6 bg-indigo-50 border-indigo-100 flex items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-200">
            <Star className="w-8 h-8 text-white fill-white" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
              Suggestions ORION Pédagogique
            </h3>
            <p className="text-indigo-700 opacity-80">
              ORION a détecté que les ressources de <strong>Didactique des Mathématiques</strong> sont sous-exploitées ce trimestre.
            </p>
          </div>
        </Card>
        <Card className="p-6 bg-amber-50 border-amber-100 flex flex-col justify-center">
          <div className="text-amber-800 font-bold flex items-center gap-2 mb-2">
            <Info className="w-5 h-5" />
            <span>Le saviez-vous ?</span>
          </div>
          <p className="text-sm text-amber-700 leading-relaxed">
            Les enseignants utilisant la bibliothèque augmentent la performance de leurs classes de 12% en moyenne.
          </p>
        </Card>
      </div>

      {/* Resources Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-48 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : resources.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resources.map((resource) => {
            const Icon = RESOURCE_ICONS[resource.resourceType] || FileText;
            return (
              <motion.div
                key={resource.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -5 }}
                transition={{ duration: 0.3 }}
              >
                <Card 
                  className="group relative overflow-hidden border-none shadow-sm hover:shadow-xl transition-all cursor-pointer bg-white"
                  onClick={() => openResource(resource)}
                >
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className={`p-3 rounded-xl ${RESOURCE_COLORS[resource.resourceType]}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                        v{resource.version}
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      <h3 className="font-bold text-lg text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {resource.title}
                      </h3>
                      <p className="text-slate-500 text-sm line-clamp-2 min-h-[40px]">
                        {resource.description || "Aucune description fournie."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {resource.level && <Badge className="bg-blue-50 text-blue-700 border-none">{resource.level}</Badge>}
                      {resource.subject && <Badge className="bg-indigo-50 text-indigo-700 border-none">{resource.subject}</Badge>}
                      {resource.language && <Badge className="bg-amber-50 text-amber-700 border-none font-medium">{resource.language}</Badge>}
                    </div>

                    <div className="pt-4 flex items-center justify-between border-t border-slate-50">
                      <div className="flex items-center text-xs text-slate-400 gap-1">
                        <Eye className="w-3 h-3" />
                        <span>{resource._count?.usages || 0} vues</span>
                      </div>
                      <div className="flex items-center text-blue-600 text-sm font-semibold group-hover:translate-x-1 transition-transform">
                        Consulter <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
            <Book className="w-10 h-10 text-slate-300" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-semibold text-slate-900">Aucune ressource trouvée</h3>
            <p className="text-slate-500">Essayez de modifier vos filtres ou votre recherche.</p>
          </div>
        </div>
      )}

      {/* Reader Overlay */}
      <AnimatePresence>
        {selectedResource && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full h-full max-w-6xl rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Reader Header */}
              <div className="p-4 md:px-8 md:py-6 border-b flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${RESOURCE_COLORS[selectedResource.resourceType]}`}>
                    {React.createElement(RESOURCE_ICONS[selectedResource.resourceType] || FileText, { className: 'w-5 h-5' })}
                  </div>
                  <div>
                    <h2 className="font-bold text-lg text-slate-900 leading-tight">{selectedResource.title}</h2>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span>Version {selectedResource.version}</span>
                      <span>•</span>
                      <span>{selectedResource.language}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedResource(null)} className="rounded-full w-10 h-10 p-0 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Reader Content */}
              <div className="flex-1 flex overflow-hidden">
                {/* Main Viewport */}
                <div className="flex-1 bg-slate-800 relative flex items-center justify-center overflow-hidden">
                  {selectedResource.resourceType === 'PDF' && selectedResource.fileUrl && (
                    <iframe 
                      src={selectedResource.fileUrl} 
                      className="w-full h-full border-none shadow-2xl" 
                      title={selectedResource.title}
                    />
                  )}
                  {selectedResource.resourceType === 'VIDEO' && (
                    <div className="w-full max-w-4xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
                      <video src={selectedResource.fileUrl || ''} controls className="w-full h-full" />
                    </div>
                  )}
                  {selectedResource.resourceType === 'LINK' && (
                    <div className="flex flex-col items-center text-center space-y-6 text-white p-8">
                      <div className="p-6 rounded-full bg-white/10 backdrop-blur-md">
                        <LinkIcon className="w-16 h-16 text-blue-400" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-bold">Lien externe validé</h3>
                        <p className="text-slate-300 max-w-md mx-auto">Cette ressource est consultable sur une plateforme externe sécurisée.</p>
                      </div>
                      <a 
                        href={selectedResource.externalUrl || selectedResource.fileUrl || '#'} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={cn(
                          buttonVariants({ size: 'lg' }), 
                          "bg-blue-500 hover:bg-blue-600 text-white px-10 rounded-full font-bold shadow-lg shadow-blue-500/20 h-12"
                        )}
                      >
                        Accéder à la ressource <ChevronRight className="ml-2 w-5 h-5" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Sidebar - Annotations & Info */}
                <div className="w-80 border-l bg-white hidden lg:flex flex-col overflow-y-auto">
                  <div className="p-6 space-y-8">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-indigo-600 font-bold">
                        <Star className="w-5 h-5" />
                        <span>Notes personnelles</span>
                      </div>
                      <textarea 
                        className="w-full h-40 p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                        placeholder="Ajoutez vos annotations pédagogiques ici... (privé)"
                        value={currentAnnotation}
                        onChange={(e) => setCurrentAnnotation(e.target.value)}
                        onBlur={async (e) => {
                          if (user?.staffId && selectedResource) {
                            await globalLibraryClient.saveLocalAnnotation(selectedResource.id, user.staffId, e.target.value);
                            toast({ title: 'Note sauvegardée', description: 'Votre annotation a été enregistrée.' });
                          }
                        }}
                      />
                      <p className="text-[10px] text-slate-400 italic text-center">
                        Synchronisation automatique activée.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-blue-600 font-bold">
                        <Info className="w-5 h-5" />
                        <span>Détails & ORION</span>
                      </div>
                      <div className="space-y-3">
                        <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 space-y-1">
                          <div className="text-xs font-bold text-blue-800 uppercase tracking-widest flex items-center gap-1">
                            <Star className="w-3 h-3 fill-blue-800" /> Suggestion ORION
                          </div>
                          <p className="text-xs text-blue-900 leading-relaxed">
                            Cette ressource est particulièrement efficace pour les classes de {selectedResource.classLevel || 'votre niveau'}.
                          </p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500 uppercase font-bold tracking-wider">Auteur</span>
                            <span className="text-slate-900 font-medium">Academia Helm</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500 uppercase font-bold tracking-wider">Consultations</span>
                            <span className="text-slate-900 font-medium">{selectedResource._count?.usages || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
