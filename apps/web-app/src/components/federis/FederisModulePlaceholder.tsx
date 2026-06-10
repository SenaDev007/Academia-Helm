/**
 * FederisModulePlaceholder Component
 * 
 * Un composant générique pour les modules en cours de développement
 * Permet de respecter la structure des 23 modules tout en itérant.
 */

'use client';

import AppIcon from '@/components/ui/AppIcon';

interface FederisModulePlaceholderProps {
  title: string;
  description?: string;
  icon?: string;
}

export default function FederisModulePlaceholder({ 
  title, 
  description = "Ce module est en cours de déploiement dans votre infrastructure Academia Federis.",
  icon = "settings"
}: FederisModulePlaceholderProps) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
      <div className="w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center mb-8 relative">
        <div className="absolute inset-0 bg-blue-900/5 rounded-3xl animate-pulse" />
        <AppIcon name={icon as any} size="large" className="text-blue-900 relative z-10" />
      </div>
      
      <h1 className="text-3xl font-black text-blue-900 tracking-tight mb-4">{title}</h1>
      <p className="text-gray-500 font-medium max-w-md mx-auto mb-10 leading-relaxed">
        {description}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        {[
          { label: 'Statut BDD', val: 'Prêt', color: 'text-green-600' },
          { label: 'Permissions', val: 'Sécurisé', color: 'text-blue-600' },
          { label: 'ORION', val: 'Actif', color: 'text-indigo-600' },
        ].map(item => (
          <div key={item.label} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{item.label}</div>
            <div className={item.color + " font-black"}>{item.val}</div>
          </div>
        ))}
      </div>

      <button className="mt-12 px-8 py-4 bg-gray-900 text-white rounded-2xl text-sm font-bold shadow-xl shadow-gray-200 hover:bg-black transition-all">
        Retour au Tableau de Bord
      </button>
    </div>
  );
}
