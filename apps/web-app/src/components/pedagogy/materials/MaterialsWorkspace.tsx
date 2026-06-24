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
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
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
  ChevronRight,
  FileText,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FormModal, 
  ConfirmModal 
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { pedagogyService } from '@/services/pedagogy.service';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

// --- Types ---

interface Material {
  id: string;
  name: string;
  code: string;
  category: 'BOOK' | 'TEACHER_GUIDE' | 'OFFICIAL_DOCUMENT' | 'DIDACTIC_SUPPORT' | 'LAB_MATERIAL' | 'OTHER';
  description?: string;
  isActive: boolean;
  subject?: { name: string };
  stocks: any[];
  assignments?: any[];
  movements?: any[];
}

interface MaterialStock {
  id: string;
  quantity: number;
  location?: string;
  condition: 'NEW' | 'GOOD' | 'DAMAGED' | 'LOST';
}

const CATEGORIES = [
  { id: 'BOOK', label: 'Manuels Scolaires', icon: BookOpen, color: 'text-indigo-600 bg-indigo-50' },
  { id: 'TEACHER_GUIDE', label: 'Guides Pédagogiques', icon: BookOpen, color: 'text-rose-600 bg-rose-50' },
  { id: 'OFFICIAL_DOCUMENT', label: 'Documents Officiels', icon: FileText, color: 'text-blue-600 bg-blue-50' },
  { id: 'DIDACTIC_SUPPORT', label: 'Supports Didactiques', icon: Monitor, color: 'text-emerald-600 bg-emerald-50' },
  { id: 'LAB_MATERIAL', label: 'Matériel de Labo', icon: FlaskConical, color: 'text-amber-600 bg-amber-50' },
];

export default function MaterialsWorkspace() {
  const confirmDialog = useConfirmDialog();
  const { academicYear, schoolLevel } = useModuleContext();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  // Data
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  
  // Search
  const [search, setSearch] = useState('');

  // Extra Data for modals
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  // Modals
  const [modal, setModal] = useState<'none' | 'create-material' | 'edit-material' | 'add-stock' | 'assign'>('none');

  // Load Extra Data (Teachers and Classes)
  useEffect(() => {
    const loadExtraData = async () => {
      if (!academicYear?.id) return;
      try {
        const [teachersData, classesData] = await Promise.all([
          pedagogyService.getTeachers(),
          pedagogyService.getAcademicClasses(academicYear.id)
        ]);
        setTeachers(teachersData || []);
        setClasses(classesData || []);
      } catch (e) {
        console.error("Error loading extra data for materials:", e);
      }
    };
    loadExtraData();
  }, [academicYear?.id]);

  // --- Loaders ---

  const loadMaterials = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const data = await pedagogyService.getPedagogicalMaterials(academicYear.id);
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
      await pedagogyService.createPedagogicalMaterial({
        ...data,
        academicYearId: academicYear?.id,
        schoolLevelId: schoolLevel?.id || "default-level",
        isActive: true
      });
      toast({
        title: "Succès",
        description: "La ressource a été ajoutée au catalogue.",
      });
      loadMaterials();
      setModal('none');
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erreur",
        description: e.message || "Impossible d'ajouter la ressource.",
        variant: "destructive"
      });
    }
  };

  const handleEditMaterial = async (data: any) => {
    if (!selectedMaterialId) return;
    try {
      await pedagogyService.updatePedagogicalMaterial(selectedMaterialId, data);
      toast({
        title: "Succès",
        description: "La ressource a été mise à jour.",
      });
      loadMaterials();
      setModal('none');
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erreur",
        description: e.message || "Impossible de modifier la ressource.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    const ok = await confirmDialog.danger('Cette ressource sera définitivement supprimée du catalogue.', 'Supprimer la ressource');
    if (!ok) return;
    try {
      await pedagogyService.deletePedagogicalMaterial(id);
      toast({
        title: "Succès",
        description: "La ressource a été supprimée.",
      });
      setSelectedMaterialId(null);
      loadMaterials();
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erreur",
        description: e.message || "Impossible de supprimer la ressource.",
        variant: "destructive"
      });
    }
  };

  const handleAddStock = async (data: any) => {
    if (!selectedMaterialId || !academicYear?.id) return;
    try {
      await pedagogyService.addMaterialStock({
        ...data,
        materialId: selectedMaterialId,
        academicYearId: academicYear.id,
        schoolLevelId: schoolLevel?.id || "default-level",
        quantity: parseInt(data.quantity)
      });
      toast({
        title: "Succès",
        description: "Le stock a été mis à jour.",
      });
      loadMaterials();
      setModal('none');
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erreur",
        description: e.message || "Impossible de mettre à jour le stock.",
        variant: "destructive"
      });
    }
  };

  const handleCreateAssignment = async (data: any) => {
    if (!selectedMaterialId || !academicYear?.id) return;
    try {
      const selectedClass = classes.find(c => c.id === data.classId);
      const schoolLevelId = selectedClass?.schoolLevelId || schoolLevel?.id || "default-level";
      
      await pedagogyService.createMaterialAssignment({
        ...data,
        materialId: selectedMaterialId,
        academicYearId: academicYear.id,
        schoolLevelId,
        quantity: parseInt(data.quantity)
      });
      toast({
        title: "Succès",
        description: "L'affectation a été enregistrée.",
      });
      loadMaterials();
      setModal('none');
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erreur",
        description: e.message || "Impossible de réaliser l'affectation.",
        variant: "destructive"
      });
    }
  };

  const selectedMaterial = materials.find(m => m.id === selectedMaterialId);
  const filteredMaterials = materials.filter(m => {
    const matchCat = activeCategory === 'ALL' || m.category === activeCategory;
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) || m.code.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <>
    {confirmDialog.dialog}
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
                      <button 
                        onClick={() => setModal('edit-material')}
                        className="p-3 bg-white border border-gray-100 text-gray-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteMaterial(selectedMaterial.id)}
                        className="p-3 bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white rounded-2xl transition-all shadow-sm"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                   </div>
                </div>

                <div className="grid grid-cols-4 gap-6 mt-10">
                   <div className="p-4 bg-gray-50 rounded-3xl border border-gray-100 text-center">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Stock</p>
                      <p className="text-2xl font-black text-gray-900">
                        {selectedMaterial.stocks?.reduce((acc: number, s: any) => acc + (s.quantityTotal || 0), 0) || 0}
                      </p>
                   </div>
                   <div className="p-4 bg-gray-50 rounded-3xl border border-gray-100 text-center">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Affectés</p>
                      <p className="text-2xl font-black text-indigo-600">
                        {selectedMaterial.assignments?.reduce((acc: number, a: any) => acc + (a.quantity || 0), 0) || 0}
                      </p>
                   </div>
                   <div className="p-4 bg-gray-50 rounded-3xl border border-gray-100 text-center">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Disponible</p>
                      <p className="text-2xl font-black text-emerald-600">
                        {selectedMaterial.stocks?.reduce((acc: number, s: any) => acc + (s.quantityAvailable || 0), 0) || 
                         ((selectedMaterial.stocks?.reduce((acc: number, s: any) => acc + (s.quantityTotal || 0), 0) || 0) - 
                          (selectedMaterial.assignments?.reduce((acc: number, a: any) => acc + (a.quantity || 0), 0) || 0))}
                      </p>
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
                       <button 
                         onClick={() => setModal('add-stock')}
                         className="bg-indigo-50 text-indigo-600 p-2 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                       >
                         <Plus className="w-4 h-4" />
                       </button>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                       {selectedMaterial.movements && selectedMaterial.movements.length > 0 ? (
                         selectedMaterial.movements.map((m: any, i: number) => (
                           <div key={m.id || i} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                              <div className="flex items-center gap-3">
                                 <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", m.movementType === 'IN' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600")}>
                                    {m.movementType === 'IN' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                                 </div>
                                 <div>
                                    <p className="text-xs font-black text-gray-900">{m.notes || m.reference || (m.movementType === 'IN' ? 'Entrée de stock' : 'Sortie de stock')}</p>
                                    <p className="text-[10px] text-gray-400 font-bold">Effectué le {new Date(m.createdAt).toLocaleDateString()}</p>
                                 </div>
                              </div>
                              <span className={cn("font-black text-sm", m.movementType === 'IN' ? "text-emerald-600" : "text-amber-600")}>
                                 {m.movementType === 'IN' ? '+' : '-'}{m.quantity}
                              </span>
                           </div>
                         ))
                       ) : (
                         <div className="flex flex-col items-center justify-center h-full text-gray-300 py-6">
                           <History className="w-8 h-8 mb-2 opacity-20" />
                           <p className="text-xs font-bold">Aucun mouvement enregistré</p>
                         </div>
                       )}
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
                        className="bg-indigo-50 text-indigo-600 p-2 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                       >
                          <Plus className="w-4 h-4" />
                       </button>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                       {selectedMaterial.assignments && selectedMaterial.assignments.length > 0 ? (
                         selectedMaterial.assignments.map((a: any, i: number) => {
                           const targetName = a.class ? a.class.name : a.teacher ? `${a.teacher.firstName} ${a.teacher.lastName}` : "Inconnu";
                           return (
                             <div key={a.id || i} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-indigo-600 border border-gray-100">
                                      {a.classId ? <Layers className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                   </div>
                                   <div>
                                      <p className="text-xs font-black text-gray-900">{targetName}</p>
                                      <p className="text-[10px] text-gray-400 font-bold">Affecté le {new Date(a.createdAt).toLocaleDateString()}</p>
                                   </div>
                                </div>
                                <span className="font-black text-sm text-indigo-600">x{a.quantity}</span>
                             </div>
                           );
                         })
                       ) : (
                         <div className="flex flex-col items-center justify-center h-full text-gray-300 py-6">
                           <ClipboardCheck className="w-8 h-8 mb-2 opacity-20" />
                           <p className="text-xs font-bold">Aucune affectation active</p>
                         </div>
                       )}
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

      {/* Modal Edit Material */}
      <FormModal
        isOpen={modal === 'edit-material'}
        onClose={() => setModal('none')}
        title="Modifier la Ressource"
        initialData={selectedMaterial}
        onSave={handleEditMaterial}
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

      {/* Modal Add Stock */}
      <FormModal
        isOpen={modal === 'add-stock'}
        onClose={() => setModal('none')}
        title="Ajouter du Stock"
        onSave={handleAddStock}
        fields={[
          { name: 'quantity', label: 'Quantité', type: 'number', placeholder: 'Ex: 10' },
          { name: 'location', label: 'Emplacement / Salle', type: 'text', placeholder: 'Ex: Bibliothèque, Armoire B' },
          { 
            name: 'condition', 
            label: 'État', 
            type: 'select', 
            options: [
              { value: 'NEW', label: 'Neuf' },
              { value: 'GOOD', label: 'Bon' },
              { value: 'DAMAGED', label: 'Endommagé' },
              { value: 'LOST', label: 'Perdu' }
            ] 
          }
        ]}
      />

      {/* Modal Assign Material */}
      <FormModal
        isOpen={modal === 'assign'}
        onClose={() => setModal('none')}
        title="Affecter une Ressource"
        onSave={handleCreateAssignment}
        fields={[
          { name: 'teacherId', label: 'Enseignant', type: 'select', options: teachers.map(t => ({ value: t.id, label: `${t.firstName} ${t.lastName}` })) },
          { name: 'classId', label: 'Classe (Optionnel)', type: 'select', options: [{ value: '', label: 'Aucune' }, ...classes.map(c => ({ value: c.id, label: c.name }))] },
          { name: 'quantity', label: 'Quantité', type: 'number', placeholder: 'Ex: 1' },
          { name: 'conditionAtIssue', label: 'État à la remise', type: 'select', options: [
              { value: 'NEW', label: 'Neuf' },
              { value: 'GOOD', label: 'Bon état' },
              { value: 'DAMAGED', label: 'Endommagé' },
              { value: 'LOST', label: 'Perdu' }
            ]
          },
          { name: 'notes', label: 'Notes / Remarques', type: 'textarea' }
        ]}
      />
    </div>
    </>
  );
}
