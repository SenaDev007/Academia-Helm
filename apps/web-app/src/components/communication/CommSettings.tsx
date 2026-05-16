/**
 * CommSettings Component
 * 
 * ONGLET 14 — Paramétrage Communication
 * Configuration globale, politiques d'envoi et routage.
 */

'use client';

import { useState } from 'react';
import { 
  Settings, 
  Clock, 
  ShieldCheck, 
  Globe, 
  MessageSquare,
  Save,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CommSettings() {
  const [activeTab, setActiveTab] = useState('general');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex h-[600px] bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-slate-50 border-r border-slate-200 p-6 flex flex-col gap-2">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Configuration</h3>
        {[
          { id: 'general', label: 'Règles Générales', icon: Settings },
          { id: 'routing', label: 'Routage & Fallback', icon: Globe },
          { id: 'schedule', label: 'Heures d\'Envoi', icon: Clock },
          { id: 'consent', label: 'Consentement & RGPD', icon: ShieldCheck },
          { id: 'templates', label: 'Modèles par Défaut', icon: MessageSquare },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-left",
              activeTab === tab.id 
                ? "bg-violet-600 text-white shadow-md shadow-violet-900/20" 
                : "text-slate-600 hover:bg-slate-200/50"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 p-8 overflow-y-auto relative">
        <div className="max-w-2xl">
          {activeTab === 'general' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-1">
                  <Settings className="w-5 h-5 text-violet-500" /> Règles Générales
                </h3>
                <p className="text-sm text-slate-500">Paramètres par défaut pour l'ensemble du module de communication.</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700">Langue principale des communications</label>
                  <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/20">
                    <option>Français (FR)</option>
                    <option>Anglais (EN)</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700">Canal prioritaire par défaut</label>
                  <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/20">
                    <option>Portail (Push Notification)</option>
                    <option>WhatsApp</option>
                    <option>SMS</option>
                    <option>Email</option>
                  </select>
                  <p className="text-xs text-slate-400">Ce canal sera utilisé en premier pour toutes les notifications automatiques.</p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-700">Validation avant envoi massif</p>
                    <p className="text-xs text-slate-500">Exiger l'approbation d'un directeur pour les campagnes &gt; 100 destinataires.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
                
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-700">Copie automatique à la direction</p>
                    <p className="text-xs text-slate-500">Mettre la direction en copie cachée (Bcc) des annonces officielles.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-1">
                  <Clock className="w-5 h-5 text-violet-500" /> Heures d'Envoi
                </h3>
                <p className="text-sm text-slate-500">Politique de respect de la vie privée. Limitez les envois nocturnes.</p>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-700">Heure de début autorisée</label>
                    <input type="time" defaultValue="07:00" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/20" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-700">Heure de fin autorisée</label>
                    <input type="time" defaultValue="20:00" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/20" />
                  </div>
                </div>
                
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-700">Ignorer pour les urgences</p>
                    <p className="text-xs text-slate-500">Les messages marqués comme "URGENT" bypasseront ces règles.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Fallback info for other tabs */}
          {['routing', 'consent', 'templates'].includes(activeTab) && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 mb-4">
                <Settings className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm font-bold text-slate-900">Paramètres Avancés</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">Cette section est réservée à l'administrateur système (Super Admin).</p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Save Button */}
      <div className="absolute bottom-8 right-8">
        <button 
          onClick={handleSave}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm shadow-xl transition-all",
            saved ? "bg-emerald-500 text-white shadow-emerald-500/20" : "bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20"
          )}
        >
          {saved ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
          {saved ? 'Enregistré' : 'Enregistrer les modifications'}
        </button>
      </div>
    </div>
  );
}
