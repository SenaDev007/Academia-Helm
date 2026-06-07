/**
 * FederisExamClassesPage Component
 * 
 * Recensement National des Classes d'Examen
 * Module 4 de l'infrastructure Academia Federis
 */

'use client';

import { useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface ExamClass {
  id: string;
  schoolName: string;
  level: string;
  studentCount: number;
  status: 'VERIFIED' | 'PENDING';
}

export default function FederisExamClassesPage() {
  const [classes, setClasses] = useState<ExamClass[]>([
    { id: '1', schoolName: 'Lycée Technique', level: 'BAC D', studentCount: 124, status: 'VERIFIED' },
    { id: '2', schoolName: 'Collège Notre Dame', level: 'BEPC', studentCount: 85, status: 'PENDING' },
    { id: '3', schoolName: 'Lycée de l\'Excellence', level: 'BAC C', studentCount: 62, status: 'VERIFIED' },
  ]);

  return (
    <div className="space-y-8">
      {/* Header Exam Classes */}
      <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16" />
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-4">
             <div className="w-10 h-10 bg-blue-900 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
                <AppIcon name="classes" size="dashboard" className="text-white" />
             </div>
             <h1 className="text-3xl font-black text-gray-900 italic tracking-tighter">Classes d'Examen</h1>
          </div>
          <p className="text-gray-500 font-medium max-w-xl">
            Recensement national des effectifs par classe d'examen. Ces données servent de base à la planification logistique et aux impressions sécurisées.
          </p>
        </div>

        <div className="flex items-center space-x-4 shrink-0">
          <button className="px-6 py-3 bg-blue-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all">
            Lancer le Recensement
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
         <div className="p-8 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Registre des Effectifs 2024</h3>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">271 classes recensées</div>
         </div>
         
         <div className="divide-y divide-gray-50">
            {classes.map(cls => (
              <div key={cls.id} className="p-8 flex items-center justify-between hover:bg-gray-50 transition-all group">
                 <div className="flex items-center space-x-6">
                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center font-black text-blue-900 text-lg group-hover:bg-blue-900 group-hover:text-white transition-all shadow-sm">
                       {cls.level[0]}
                    </div>
                    <div>
                       <h4 className="text-lg font-black text-gray-900">{cls.schoolName}</h4>
                       <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                          Niveau: <span className="text-blue-600">{cls.level}</span> • Effectif: {cls.studentCount} élèves
                       </p>
                    </div>
                 </div>

                 <div className="flex items-center space-x-6">
                    <div className={cn(
                      "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest",
                      cls.status === 'VERIFIED' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    )}>
                       {cls.status === 'VERIFIED' ? 'Vérifié' : 'En Attente'}
                    </div>
                    <button className="p-4 bg-gray-50 rounded-2xl text-gray-400 hover:text-blue-900 transition-all">
                       <AppIcon name="edit" size="submenu" />
                    </button>
                 </div>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
}
