/**
 * ============================================================================
 * LABORATORIES LIST
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { 
  Beaker, 
  MapPin, 
  Users, 
  User, 
  ShieldCheck, 
  ChevronRight,
  MoreVertical,
  Plus
} from 'lucide-react';

export default function LabsList() {
  const labs = [
    { id: 'LAB-PH-01', name: 'Laboratoire de Physique', type: 'Physique', building: 'Bâtiment A', floor: '1er Étage', capacity: 30, manager: 'M. Saliou', status: 'ACTIVE' },
    { id: 'LAB-CH-01', name: 'Laboratoire de Chimie', type: 'Chimie', building: 'Bâtiment A', floor: '2ème Étage', capacity: 25, manager: 'Mme. Koffi', status: 'MAINTENANCE' },
    { id: 'LAB-SVT-01', name: 'Laboratoire SVT', type: 'SVT', building: 'Bâtiment B', floor: 'RDC', capacity: 30, manager: 'M. Lawson', status: 'ACTIVE' },
    { id: 'LAB-INF-01', name: 'Lab Informatique Alpha', type: 'Informatique', building: 'Bâtiment C', floor: '1er Étage', capacity: 40, manager: 'Mme. Goussi', status: 'ACTIVE' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Nos Espaces Laboratoires</h3>
        <button className="flex items-center space-x-2 px-4 py-2 bg-navy-900 text-white rounded-xl hover:bg-navy-800 transition-all font-bold text-sm">
          <Plus className="w-4 h-4" />
          <span>Nouveau Laboratoire</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {labs.map((lab, i) => (
          <motion.div
            key={lab.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4">
              <button className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <MoreVertical className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="flex items-start gap-6">
              <div className="p-5 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                <Beaker className="w-10 h-10" />
              </div>
              <div className="space-y-4 flex-1">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="text-xl font-black text-slate-900">{lab.name}</h4>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${
                      lab.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {lab.status}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{lab.id} • {lab.type}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center text-slate-500 text-sm">
                    <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                    <span>{lab.building}, {lab.floor}</span>
                  </div>
                  <div className="flex items-center text-slate-500 text-sm">
                    <Users className="w-4 h-4 mr-2 text-slate-400" />
                    <span>Capacité: {lab.capacity}</span>
                  </div>
                  <div className="flex items-center text-slate-500 text-sm">
                    <User className="w-4 h-4 mr-2 text-slate-400" />
                    <span>Resp: {lab.manager}</span>
                  </div>
                  <div className="flex items-center text-slate-500 text-sm">
                    <ShieldCheck className="w-4 h-4 mr-2 text-emerald-500" />
                    <span>QHSE Certifié</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map((_, j) => (
                      <div key={j} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white" />
                    ))}
                    <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500">+12</div>
                  </div>
                  <button className="flex items-center text-blue-600 font-black text-xs uppercase tracking-widest hover:translate-x-2 transition-transform">
                    Détails & Équipements
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
