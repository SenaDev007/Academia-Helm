/**
 * ============================================================================
 * MODULE EDUCAST - ACADEMIA HELM
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { 
  LayoutDashboard, 
  Library, 
  MonitorPlay, 
  Video, 
  Headphones, 
  Zap, 
  Globe, 
  ListMusic, 
  Megaphone, 
  ShieldCheck, 
  BarChart3, 
  Paperclip, 
  FileText, 
  Settings,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import ModulePageLayout from './ModulePageLayout';

// Sub-components (to be created)
import EduCastDashboard from './educast/EduCastDashboard';
import EduCastLibrary from './educast/EduCastLibrary';
import EduCastTeacherStudio from './educast/EduCastTeacherStudio';
import EduCastMonetization from './educast/EduCastMonetization';
import EduCastPacks from './educast/EduCastPacks';
import EduCastVideos from './educast/EduCastVideos';
import EduCastPodcasts from './educast/EduCastPodcasts';
import EduCastWebinars from './educast/EduCastWebinars';
import EduCastAnnouncements from './educast/EduCastAnnouncements';
import EduCastModeration from './educast/EduCastModeration';
import EduCastAnalytics from './educast/EduCastAnalytics';
import EduCastReports from './educast/EduCastReports';
import EduCastSettings from './educast/EduCastSettings';

const TABS = [
  { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard },
  { id: 'library', label: 'Médiathèque', icon: Library },
  { id: 'studio', label: 'Studio Enseignant', icon: MonitorPlay },
  { id: 'monetization', label: 'Monétisation', icon: Zap },
  { id: 'packs', label: 'Packs de Contenus', icon: ListMusic },
  { id: 'videos', label: 'Vidéos Pédagogiques', icon: Video },
  { id: 'podcasts', label: 'Podcasts & Audios', icon: Headphones },
  { id: 'webinars', label: 'Webinaires & Directs', icon: Globe },
  { id: 'announcements', label: 'Annonces', icon: Megaphone },
  { id: 'moderation', label: 'Modération', icon: ShieldCheck },
  { id: 'analytics', label: 'Statistiques', icon: BarChart3 },
  { id: 'reports', label: 'Rapports', icon: FileText },
  { id: 'settings', label: 'Configuration', icon: Settings },
];

export default function EduCastModulePage() {
  const { currentYear } = useAcademicYear();
  const { currentLevel } = useSchoolLevel();
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard': return <EduCastDashboard />;
      case 'library': return <EduCastLibrary />;
      case 'studio': return <EduCastTeacherStudio />;
      case 'monetization': return <EduCastMonetization />;
      case 'packs': return <EduCastPacks />;
      case 'videos': return <EduCastVideos />;
      case 'podcasts': return <EduCastPodcasts />;
      case 'webinars': return <EduCastWebinars />;
      case 'announcements': return <EduCastAnnouncements />;
      case 'moderation': return <EduCastModeration />;
      case 'analytics': return <EduCastAnalytics />;
      case 'reports': return <EduCastReports />;
      case 'settings': return <EduCastSettings />;
      default: return <EduCastDashboard />;
    }
  };

  return (
    <ModulePageLayout
      title="EduCast"
      subtitle={`${currentLevel?.label || 'Toutes Sections'} | ${currentYear?.name || ''}`}
      actions={
        <div className="flex items-center space-x-2">
          <button className="flex items-center space-x-2 px-4 py-2 bg-navy-900 text-white rounded-xl hover:bg-navy-800 transition-all font-bold text-sm shadow-sm">
            <Plus className="w-4 h-4 text-[#C9A84C]" />
            <span>Publier Contenu</span>
          </button>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Tab Navigation */}
        <div className="bg-white p-1 rounded-2xl border border-slate-200 flex flex-wrap gap-1 shadow-sm sticky top-0 z-10 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-tighter transition-all whitespace-nowrap ${
                  isActive 
                    ? 'bg-navy-900 text-white shadow-md' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-navy-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#C9A84C]' : ''}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {renderActiveTab()}
          </motion.div>
        </AnimatePresence>
      </div>
    </ModulePageLayout>
  );
}
