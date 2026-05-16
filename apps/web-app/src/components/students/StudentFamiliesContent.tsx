'use client';

import { useState, useEffect } from 'react';
import { Users, Plus, Search, Filter, Mail, Phone, MapPin, Shield, Star, Heart, Loader2, User } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingState } from '@/components/ui/feedback/LoadingState';

interface StudentWithGuardians {
  id: string;
  firstName: string;
  lastName: string;
  matricule?: string;
  studentGuardians: Array<{
    id: string;
    relationship: string;
    isPrimary: boolean;
    guardian: {
      firstName: string;
      lastName: string;
      phone?: string;
      email?: string;
    };
  }>;
}

export default function StudentFamiliesContent() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [students, setStudents] = useState<StudentWithGuardians[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (academicYear && schoolLevel) loadData();
  }, [academicYear, schoolLevel]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        academicYearId: academicYear?.id || '',
        schoolLevelId: schoolLevel?.id || '',
        includeGuardians: 'true',
      });
      const res = await fetch(`/api/students?${params}`);
      if (res.ok) {
        setStudents(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStudents = students.filter(s => 
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.studentGuardians.some(sg => `${sg.guardian.firstName} ${sg.guardian.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading) return <LoadingState message="Recherche des liens familiaux..." />;

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500">
      {/* Header Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Familles', value: students.length, icon: <Users className="text-blue-600" />, color: 'bg-blue-50' },
          { label: 'Fratries Détectées', value: '...', icon: <Heart className="text-rose-600" />, color: 'bg-rose-50' },
          { label: 'Responsables Principaux', value: students.filter(s => s.studentGuardians.some(sg => sg.isPrimary)).length, icon: <Star className="text-amber-600" />, color: 'bg-amber-50' },
        ].map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={i} 
            className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4"
          >
            <div className={`p-3 rounded-lg ${stat.color}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <p className="text-xl font-bold text-slate-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher une famille ou un parent..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold shadow-md shadow-blue-200 transition-all active:scale-95">
            <Plus className="w-4 h-4" />
            Nouvelle Famille
          </button>
        </div>
      </div>

      {/* Grid of Family Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredStudents.map((student, idx) => (
            <motion.div 
              key={student.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col"
            >
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 rounded-lg text-blue-600">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">Famille {student.lastName}</span>
                </div>
                <button className="p-1.5 hover:bg-white rounded-lg text-slate-400">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-4 flex-1 space-y-4">
                {/* Parents Section */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responsables Légaux</p>
                  {student.studentGuardians.map(sg => (
                    <div key={sg.id} className="flex items-start gap-3 p-2 rounded-xl bg-slate-50/50 border border-slate-100">
                      <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-400">
                        {sg.guardian.firstName[0]}{sg.guardian.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{sg.guardian.firstName} {sg.guardian.lastName}</p>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-[9px] font-medium text-slate-400 flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> {sg.guardian.phone || '...'}</span>
                           {sg.isPrimary && <span className="text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-bold">Principal</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {student.studentGuardians.length === 0 && (
                     <p className="text-xs text-slate-400 italic">Aucun responsable lié</p>
                  )}
                </div>

                {/* Children Section */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enfants Scolarisés</p>
                  <div className="flex items-center gap-2 p-2 rounded-xl border border-blue-50 bg-blue-50/30">
                    <div className="w-8 h-8 rounded-full bg-white border border-blue-100 flex items-center justify-center text-blue-600">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-blue-900 truncate">{student.firstName} {student.lastName}</p>
                      <p className="text-[9px] font-medium text-blue-400">{student.matricule || 'Sans matricule'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50/50 border-t border-slate-100 flex justify-end">
                <button className="text-[10px] font-bold text-blue-600 hover:underline px-2 py-1">Gérer la fratrie</button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {!isLoading && filteredStudents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
           <Users className="w-12 h-12 mb-3 opacity-20" />
           <p className="text-sm">Aucune famille trouvée</p>
        </div>
      )}
    </div>
  );
}
