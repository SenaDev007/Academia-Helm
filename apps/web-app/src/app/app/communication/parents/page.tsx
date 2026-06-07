'use client';

import React from 'react';
import { 
  Users, 
  Search, 
  MessageCircle, 
  Phone, 
  Mail, 
  MoreHorizontal, 
  ShieldCheck, 
  UserPlus,
  ArrowUpRight,
  Filter
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';

export default function ParentCommunicationPage() {
  const families = [
    { id: 1, name: 'Famille Amoussou', student: 'Koffi Amoussou', class: 'CM2 A', status: 'REACHABLE', lastContact: 'Il y a 2 jours' },
    { id: 2, name: 'Famille Kodjo', student: 'Afi Kodjo', class: '3ème B', status: 'UNREACHABLE', lastContact: 'Jamais' },
    { id: 3, name: 'Famille Silva', student: 'Pedro Silva', class: 'Terminale C', status: 'REACHABLE', lastContact: 'Aujourd\'hui' },
  ];

  return (
    <ModuleContentArea>
      <div className="p-6 space-y-8">
        {/* Hero Section */}
        <div className="bg-emerald-600 rounded-[2.5rem] p-8 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl shadow-emerald-100">
          <div className="max-w-xl">
            <h3 className="text-4xl font-black mb-4 tracking-tight">Communication Parents</h3>
            <p className="text-emerald-50 font-medium text-lg leading-relaxed opacity-90">
              Gérez les relations avec les familles. Assurez-vous que chaque parent est joignable et informé en temps réel.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 text-center min-w-[140px]">
              <p className="text-3xl font-black">94%</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">Joignabilité</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 text-center min-w-[140px]">
              <p className="text-3xl font-black">12</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">Non joignables</p>
            </div>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher une famille, un parent ou un élève..." 
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button className="bg-slate-50 p-3 rounded-xl text-slate-400 hover:bg-slate-100 transition-all">
              <Filter size={20} />
            </button>
            <button className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex-1 md:flex-none justify-center">
              <UserPlus size={18} /> Nouveau Contact
            </button>
          </div>
        </div>

        {/* Families Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {families.map((family) => (
            <div key={family.id} className="bg-white rounded-[2rem] p-6 border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-all">
                  <Users size={24} />
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  family.status === 'REACHABLE' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                }`}>
                  {family.status === 'REACHABLE' ? 'Joignable' : 'Critique'}
                </div>
              </div>

              <h4 className="text-xl font-black text-slate-900 mb-1">{family.name}</h4>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Élève: {family.student} ({family.class})</p>
              
              <div className="flex items-center gap-4 py-4 border-y border-slate-50 mb-6">
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Dernier Contact</p>
                  <p className="text-sm font-bold text-slate-700">{family.lastContact}</p>
                </div>
                <button className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all">
                  <ArrowUpRight size={18} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button className="flex-1 bg-emerald-50 text-emerald-600 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center gap-2">
                  <MessageCircle size={14} /> WhatsApp
                </button>
                <button className="flex-1 bg-blue-50 text-blue-600 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2">
                  <Mail size={14} /> Email
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ModuleContentArea>
  );
}
