/**
 * ============================================================================
 * MATERIALS WORKSPACE - MODULE 2 (Matériel Pédagogique)
 * ============================================================================
 * 
 * Gestion des ressources institutionnelles :
 * 1. Catalogue du matériel (Livres, Kits, Tablettes, Labo)
 * 2. Suivi des stocks par année académique
 * 3. Affectations aux enseignants et aux classes
 * 4. Historique des mouvements et maintenance
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Package, 
  Search, 
  Plus, 
  Filter, 
  ArrowUpRight, 
  ArrowDownLeft, 
  BookOpen, 
  Monitor, 
  FlaskConical, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  User,
  Layers,
  MoreVertical,
  History,
  Trash2,
  Edit,
  ClipboardCheck,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FormModal, 
  ConfirmModal 
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { cn } from '@/lib/utils';

// --- Types ---

interface Material {
  id: string;
  name: string;
  code: string;
  category: 'BOOK' | 'KIT' | 'EQUIPMENT' | 'TECH' | 'OTHER';
  description?: string;
  isActive: boolean;
  subject?: { name: string };
  stocks: any[];
}

interface MaterialStock {
  id: string;
  quantity: number;
  location?: string;
  condition: 'NEW' | 'GOOD' | 'DAMAGED' | 'LOST';
}

const CATEGORIES = [
  { id: 'BOOK', label: 'Manuels Scolaires', icon: BookOpen, color: 'text-indigo-600 bg-indigo-50' },
  { id: 'KIT', label: 'Kits Pédagogiques', icon: FlaskConical, color: 'text-rose-600 bg-rose-50' },
  { id: 'TECH', label: 'Matériel Tech', icon: Monitor, color: 'text-emerald-600 bg-emerald-50' },
  { id: 'EQUIPMENT', label: 'Équipement Sport/Art', icon: Package, color: 'text-amber-600 bg-amber-50' },
];

export default function MaterialsWorkspace() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [loading, setLoading] = useState(false);
  
  // Data
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  
  // Search
  const [search, setSearch] = useState('');

  // Modals
  const [modal, setModal] = useState<'none' | 'create-material' | 'add-stock' | 'assign'>('none');

  // --- Loaders ---

  const loadMaterials = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const data = await pedagogyFetch<any>(`/api/pedagogy/pedagogical-materials?academicYearId=${academicYear.id}`);
      // Note: Backend might return paginated response { data, total }
      setMaterials(Array.isArray(data) ? data : data.data || []);
      if (data.length > 0 && !selectedMaterialId) setSelectedMaterialId(data[0].id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id, selectedMaterialId]);

  useEffect(() => { loadMaterials(); }, [loadMaterials]);

  // --- Actions ---

  const handleCreateMaterial = async (data: any) => {
    try {
      await pedagogyFetch('/api/pedagogy/pedagogical-materials', {
        method: 'POST',
        body: data
      });
      loadMaterials();
      setModal('none');
    } catch (e) {
      console.error(e);
    }
  };

  const selectedMaterial = materials.find(m => m.id === selectedMaterialId);
  const filteredMaterials = materials.filter(m => {
    const matchCat = activeCategory === 'ALL' || m.category === activeCategory;
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) || m.code.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-6 overflow-hidden">
      {/* Catalogue & Filtres (Gauche) */}
      <div className="w-1/3 bg-white rounded-3xl border border-gray-100 flex flex-col shadow-sm">
        <div className="p-6 border-b border-gray-50 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-6 h-6 text-indigo-600" />
              Catalogue Ressources
            </h2>
            <button 
              onClick={() => setModal('create-material')}
              className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Chercher une ressource..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button 
              onClick={() => setActiveCategory('ALL')}
              className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", activeCategory === 'ALL' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-gray-50 text-gray-400 hover:bg-gray-100")}
            >Tout</button>
            {CATEGORIES.map(cat => (
              <button 
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap", activeCategory === cat.id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-gray-50 text-gray-400 hover:bg-gray-100")}
              >{cat.label}</button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredMaterials.map(m => {
            const cat = CATEGORIES.find(c => c.id === m.category);
            const Icon = cat?.icon || Package;
            
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMaterialId(m.id)}
                className={cn(
                  "w-full text-left p-4 rounded-3xl transition-all group border",
                  selectedMaterialId === m.id ? "bg-white border-indigo-100 shadow-xl shadow-indigo-50 scale-[1.02] z-10" : "hover:bg-gray-50 border-transparent text-gray-700"
                )}
              >
                <div className="flex items-center gap-4">
                   <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-all", selectedMaterialId === m.id ? "bg-indigo-600 text-white" : cat?.color || "bg-gray-100 text-gray-400")}>
                      <Icon className="w-6 h-6" />
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={cn("font-bold text-sm truncate", selectedMaterialId === m.id ? "text-indigo-900" : "text-gray-900")}>
                          {m.name}
                        </p>
                        <ChevronRight className={cn("w-4 h-4 transition-transform", selectedMaterialId === m.id ? "text-indigo-600 translate-x-1" : "text-gray-200")} />
                      </div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">
                        Code: {m.code}
                      </p>
                   </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Détails & Mouvements (Droite) */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        <AnimatePresence mode="wait">
          {selectedMaterial ? (
            <motion.div 
              key={selectedMaterial.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col gap-6"
            >
              {/* Header Détails */}
              <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                   <Package className="w-40 h-40" />
                </div>
                <div className="relative flex items-start justify-between">
                   <div className="flex gap-6">
                      <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600">
                         {(() => {
                           const Icon = CATEGORIES.find(c => c.id === selectedMaterial.category)?.icon || Package;
                           return <Icon className="w-10 h-10" />;
                         })()}
                      </div>
                      <div>
                         <h3 className="text-3xl font-black text-gray-900 tracking-tight">{selectedMaterial.name}</h3>
                         <div className="flex items-center gap-4 mt-2">
                            <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                              {CATEGORIES.find(c => c.id === selectedMaterial.category)?.label}
                            </span>
                            <div className="w-1 h-1 rounded-full bg-gray-300" />
                            <span className="text-xs font-bold text-gray-400">ID: {selectedMaterial.code}</span>
                         </div>
                      </div>
                   </div>
                   <div className="flex gap-2">
                      <button className="p-3 bg-white border border-gray-100 text-gray-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm">
                        <Edit className="w-5 h-5" />
                      </button>
                      <button className="p-3 bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white rounded-2xl transition-all shadow-sm">
                        <Trash2 className="w-5 h-5" />
                      </button>
                   </div>
                </div>

                <div className="grid grid-cols-4 gap-6 mt-10">
                   <div className="p-4 bg-gray-50 rounded-3xl border border-gray-100 text-center">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Stock</p>
                      <p className="text-2xl font-black text-gray-900">42</p>
                   </div>
                   <div className="p-4 bg-gray-50 rounded-3xl border border-gray-100 text-center">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Affectés</p>
                      <p className="text-2xl font-black text-indigo-600">18</p>
                   </div>
                   <div className="p-4 bg-gray-50 rounded-3xl border border-gray-100 text-center">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Disponible</p>
                      <p className="text-2xl font-black text-emerald-600">24</p>
                   </div>
                   <div className="p-4 bg-gray-50 rounded-3xl border border-gray-100 text-center">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">État Moyen</p>
                      <p className="text-sm font-black text-amber-600 flex items-center justify-center gap-1 mt-2">
                        <AlertCircle className="w-4 h-4" /> BON
                      </p>
                   </div>
                </div>
              </div>

              {/* Mouvements & Affectations */}
              <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
                 <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                       <h4 className="text-lg font-black text-gray-900 flex items-center gap-2">
                         <History className="w-5 h-5 text-indigo-600" />
                         Derniers Mouvements
                       </h4>
                       <button className="text-[10px] font-black text-indigo-600 hover:underline">VOIR TOUT</button>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                       {[
                         { type: 'IN', qty: 10, user: 'Admin', date: '2024-05-01', reason: 'Achat' },
                         { type: 'OUT', qty: 2, user: 'Prof. DUPONT', date: '2024-05-02', reason: 'Prêt Classe' },
                         { type: 'IN', qty: 2, user: 'Prof. DUPONT', date: '2024-05-09', reason: 'Retour' },
                       ].map((m, i) => (
                         <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="flex items-center gap-3">
                               <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", m.type === 'IN' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600")}>
                                  {m.type === 'IN' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                               </div>
                               <div>
                                  <p className="text-xs font-black text-gray-900">{m.reason}</p>
                                  <p className="text-[10px] text-gray-400 font-bold">{m.user} • {m.date}</p>
                               </div>
                            </div>
                            <span className={cn("font-black text-sm", m.type === 'IN' ? "text-emerald-600" : "text-amber-600")}>
                               {m.type === 'IN' ? '+' : '-'}{m.qty}
                            </span>
                         </div>
                       ))}
                    </div>
                 </div>

                 <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                       <h4 className="text-lg font-black text-gray-900 flex items-center gap-2">
                         <ClipboardCheck className="w-5 h-5 text-indigo-600" />
                         Affectations Actives
                       </h4>
                       <button 
                        onClick={() => setModal('assign')}
                        className="bg-indigo-50 text-indigo-600 p-2 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"
                       >
                          <Plus className="w-4 h-4" />
                       </button>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                       {[
                         { target: 'Maternelle 1 A', qty: 15, date: '2024-01-10' },
                         { target: 'Maternelle 2 B', qty: 15, date: '2024-01-12' },
                         { target: 'Prof. SINSIN', qty: 1, date: '2024-02-15' },
                       ].map((a, i) => (
                         <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="flex items-center gap-3">
                               <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-indigo-600 border border-gray-100">
                                  {a.target.startsWith('Prof') ? <User className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                               </div>
                               <div>
                                  <p className="text-xs font-black text-gray-900">{a.target}</p>
                                  <p className="text-[10px] text-gray-400 font-bold">Affecté le {a.date}</p>
                               </div>
                            </div>
                            <span className="font-black text-sm text-indigo-600">x{a.qty}</span>
                         </div>
                       ))}
                    </div>
                 </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-[2.5rem] border border-gray-100 border-dashed text-gray-300">
               <Package className="w-20 h-20 mb-4 opacity-20" />
               <p className="font-bold">Sélectionnez une ressource pour voir les détails</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal New Material */}
      <FormModal
        isOpen={modal === 'create-material'}
        onClose={() => setModal('none')}
        title="Ajouter une Ressource"
        onSave={handleCreateMaterial}
        fields={[
          { name: 'name', label: 'Nom de la ressource', type: 'text', placeholder: 'Ex: Tablettes Samsung Galaxy' },
          { name: 'code', label: 'Code Inventaire', type: 'text', placeholder: 'Ex: TAB-001' },
          { 
            name: 'category', 
            label: 'Catégorie', 
            type: 'select', 
            options: CATEGORIES.map(c => ({ value: c.id, label: c.label })) 
          },
          { name: 'description', label: 'Description / Spécifications', type: 'textarea' }
        ]}
      />
    </div>
  );
}
