/**
 * FederisConnectDocuments Component
 * 
 * Bibliothèque de documents partagés et ressources institutionnelles
 */

'use client';

import { useState, useEffect } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface SharedDoc {
  id: string;
  name: string;
  type: 'PDF' | 'DOCX' | 'XLSX' | 'IMAGE';
  size: string;
  sender: string;
  sharedAt: string;
  category: string;
}

export default function FederisConnectDocuments() {
  const [docs, setDocs] = useState<SharedDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulation
    setTimeout(() => {
      setDocs([
        {
          id: 'd1',
          name: 'Guide_Pratique_Examen_BEPC_2024.pdf',
          type: 'PDF',
          size: '2.4 MB',
          sender: 'Direction Examens',
          sharedAt: new Date().toISOString(),
          category: 'Guides'
        },
        {
          id: 'd2',
          name: 'Listes_Candidats_Centre_LOME_1.xlsx',
          type: 'XLSX',
          size: '850 KB',
          sender: 'Patronat Maritime',
          sharedAt: new Date(Date.now() - 3600000).toISOString(),
          category: 'Candidats'
        },
        {
          id: 'd3',
          name: 'PV_Reunion_Coordination_Mai.docx',
          type: 'DOCX',
          size: '1.2 MB',
          sender: 'Bureau National',
          sharedAt: new Date(Date.now() - 172800000).toISOString(),
          category: 'Procès-verbaux'
        }
      ]);
      setLoading(false);
    }, 500);
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter italic">Documents Partagés</h3>
          <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">Ressources, listes et archives institutionnelles</p>
        </div>
        <button className="px-6 py-2.5 bg-blue-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all flex items-center gap-2">
          <AppIcon name="document" size="menu" />
          Déposer un Fichier
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Document</th>
              <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Catégorie</th>
              <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Partagé par</th>
              <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {docs.map(doc => (
              <tr key={doc.id} className="hover:bg-blue-50/30 transition-colors group">
                <td className="px-8 py-5">
                  <div className="flex items-center space-x-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-[10px]",
                      doc.type === 'PDF' ? "bg-red-500" : doc.type === 'XLSX' ? "bg-green-600" : "bg-blue-600"
                    )}>
                      {doc.type}
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-900 group-hover:text-blue-900 transition-colors">{doc.name}</p>
                      <p className="text-[10px] font-bold text-gray-400 mt-0.5">{doc.size} • {new Date(doc.sharedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    {doc.category}
                  </span>
                </td>
                <td className="px-8 py-5">
                  <p className="text-xs font-bold text-gray-600">{doc.sender}</p>
                </td>
                <td className="px-8 py-5 text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <button className="p-2 hover:bg-blue-50 rounded-lg text-blue-900 transition-colors">
                      <AppIcon name="dashboard" size="menu" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
                      <AppIcon name="settings" size="menu" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
