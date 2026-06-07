'use client';

import { Settings, Bell, Shield, Map, Truck, CreditCard, Save } from 'lucide-react';

export default function TransportSettings() {
  const sections = [
    { title: 'Types de véhicules', icon: Truck, items: ['Bus Scolaire', 'Mini-bus', 'Van', '4x4'] },
    { title: 'Zones de transport', icon: Map, items: ['Centre-ville', 'Périphérie', 'Zone Industrielle', 'Hors périmètre'] },
    { title: 'Notifications parents', icon: Bell, items: ['Montée dans le bus', 'Descente du bus', 'Retard > 10 min', 'Incident'] },
    { title: 'Tarification', icon: CreditCard, items: ['Mensuel A/R', 'Mensuel simple', 'Trimestriel', 'Annuel'] },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-2">
          <Settings className="w-6 h-6 text-slate-400" /> Configuration du module
        </h3>
        <button className="flex items-center gap-2 px-8 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/20">
          <Save className="w-4 h-4" /> Enregistrer les modifications
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {sections.map((section, i) => (
          <div key={i} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-slate-50 rounded-2xl text-slate-600">
                <section.icon className="w-5 h-5" />
              </div>
              <h4 className="text-lg font-black text-slate-900 tracking-tighter uppercase">{section.title}</h4>
            </div>
            <div className="space-y-3">
              {section.items.map((item, j) => (
                <div key={j} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 border border-slate-100 group hover:border-navy-900 transition-all cursor-pointer">
                  <span className="text-sm font-bold text-slate-700">{item}</span>
                  <div className="w-8 h-4 bg-slate-200 rounded-full relative group-hover:bg-navy-900 transition-colors">
                    <div className="absolute left-1 top-1 w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>
              ))}
              <button className="w-full py-4 border-2 border-dashed border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:border-navy-900 hover:text-navy-900 transition-all mt-4">
                Ajouter une option
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
