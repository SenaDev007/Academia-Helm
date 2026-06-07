'use client';

import React from 'react';
import { 
  Settings, 
  Globe, 
  Shield, 
  Bell, 
  Smartphone, 
  Mail, 
  Eye, 
  Save,
  CheckCircle2,
  MessageSquare
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';

export default function CommunicationSettingsPage() {
  return (
    <ModuleContentArea>
      <div className="p-6 space-y-8">
        <div className="flex items-center justify-between">
          <h3 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Settings className="text-slate-400" size={32} /> Paramètres de Communication
          </h3>
          <button className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200">
            <Save size={18} /> Enregistrer les modifications
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Navigation Sidebar */}
          <div className="lg:col-span-1 space-y-2">
            {[
              { label: 'Général', icon: <Globe size={18} />, active: true },
              { label: 'Identité Visuelle', icon: <Eye size={18} />, active: false },
              { label: 'Sécurité & RGPD', icon: <Shield size={18} />, active: false },
              { label: 'Préférences Canaux', icon: <Smartphone size={18} />, active: false },
              { label: 'Notifications', icon: <Bell size={18} />, active: false },
            ].map((item, i) => (
              <button key={i} className={`w-full text-left px-6 py-4 rounded-2xl text-sm font-bold flex items-center gap-3 transition-all ${
                item.active ? 'bg-white border border-slate-100 text-slate-900 shadow-sm' : 'text-slate-400 hover:bg-slate-50'
              }`}>
                {item.icon} {item.label}
              </button>
            ))}
          </div>

          {/* Form Area */}
          <div className="lg:col-span-3 space-y-8">
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm space-y-10">
              {/* Branding Section */}
              <section>
                <h5 className="font-black text-slate-900 uppercase tracking-widest text-xs mb-6">Identité Institutionnelle</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom de l'Expéditeur par défaut</label>
                    <input type="text" defaultValue="ACADEMIA HELM SCHOOL" className="w-full px-5 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email de Réponse (Reply-To)</label>
                    <input type="email" defaultValue="admin@academia.edu" className="w-full px-5 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900 transition-all" />
                  </div>
                </div>
              </section>

              {/* Signature Section */}
              <section className="pt-10 border-t border-slate-50">
                <h5 className="font-black text-slate-900 uppercase tracking-widest text-xs mb-6">Signature Automatique</h5>
                <textarea 
                  className="w-full px-5 py-4 bg-slate-50 border-none rounded-[1.5rem] text-sm font-medium focus:ring-2 focus:ring-slate-900 transition-all min-h-[120px]"
                  defaultValue="Cordialement,\nLa Direction d'Academia Helm\nService Administratif"
                />
              </section>

              {/* Channel Toggle Section */}
              <section className="pt-10 border-t border-slate-50">
                <h5 className="font-black text-slate-900 uppercase tracking-widest text-xs mb-6">Canaux Activés par défaut</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Email Institutionnel', icon: <Mail size={16} />, active: true },
                    { label: 'SMS Prioritaires', icon: <Smartphone size={16} />, active: true },
                    { label: 'WhatsApp Business', icon: <MessageSquare size={16} />, active: false },
                  ].map((chan, i) => (
                    <div key={i} className={`p-5 rounded-2xl border flex items-center justify-between transition-all ${chan.active ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-100 opacity-60'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`${chan.active ? 'text-slate-900' : 'text-slate-300'}`}>{chan.icon}</div>
                        <span className="text-xs font-bold text-slate-700">{chan.label}</span>
                      </div>
                      <div className={`w-8 h-4 rounded-full relative transition-colors ${chan.active ? 'bg-slate-900' : 'bg-slate-200'}`}>
                        <div className={`absolute top-1 w-2 h-2 bg-white rounded-full transition-all ${chan.active ? 'right-1' : 'left-1'}`}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Danger Zone */}
            <div className="bg-rose-50 rounded-[2.5rem] p-8 border border-rose-100 flex items-center justify-between">
              <div>
                <h6 className="text-rose-900 font-black text-sm uppercase tracking-widest mb-1">Zone Critique</h6>
                <p className="text-rose-600 text-xs font-medium italic">Réinitialiser tous les logs de communication (Action irréversible)</p>
              </div>
              <button className="bg-white text-rose-600 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-rose-200 hover:bg-rose-600 hover:text-white transition-all">
                Purger les archives
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModuleContentArea>
  );
}
