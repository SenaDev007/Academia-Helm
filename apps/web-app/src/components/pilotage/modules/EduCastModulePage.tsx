/**
 * ============================================================================
 * MODULE EDUCAST - ACADEMIA HELM
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern ModuleContainer (comme
 * FinanceModulePage / CanteenModulePage / TransportModulePage) pour uniformiser
 * le design à travers tous les modules. Avant, ce module utilisait
 * ModulePageLayout (obsolète) avec des onglets pills custom navy-900/uppercase
 * framer-motion — désormais il utilise ModuleContainer + SubModuleNavigation
 * standard (bleus soulignés).
 *
 * Sous-modules (17) :
 *   1. Tableau de Bord (dashboard)
 *   2. Médiathèque (library)
 *   3. Studio Enseignant (studio)
 *   4. Monétisation (monetization)
 *   5. Packs de Contenus (packs)
 *   6. Vidéos Pédagogiques (videos)
 *   7. Podcasts & Audios (podcasts)
 *   8. Webinaires & Directs (webinars)
 *   9. Annonces (announcements)
 *  10. Modération (moderation)
 *  11. Statistiques (analytics)
 *  12. Rapports (reports)
 *  13. Chaînes (channels)
 *  14. Playlists (playlists)
 *  15. Capsules de Révision (capsules)
 *  16. Ressources (resources)
 *  17. Paramètres (settings)
 *
 * Note : La navigation par sous-modules est gérée par ModuleContainer.subModules.
 * Les sous-composants NE doivent PAS inclure leur propre SubModuleNavigation.
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Library,
  MonitorPlay,
  Zap,
  ListMusic,
  Video,
  Headphones,
  Globe,
  Megaphone,
  ShieldCheck,
  BarChart3,
  FileText,
  Settings,
  Plus,
  Download,
  Radio,
  Package,
  Paperclip,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';

// Sous-composants (aucun ne contient SubModuleNavigation — pattern FinanceModulePage)
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
import EduCastChannels from './educast/EduCastChannels';
import EduCastPlaylists from './educast/EduCastPlaylists';
import EduCastRevisionCapsules from './educast/EduCastRevisionCapsules';
import EduCastResources from './educast/EduCastResources';
import EduCastSettings from './educast/EduCastSettings';

export default function EduCastModulePage() {
  const { academicYear, isLoading: contextLoading } = useModuleContext();
  const [activeSubModuleId, setActiveSubModuleId] = useState<string>('dashboard');
  const [stats, setStats] = useState<any>(null);

  // Charger les stats EduCast pour les KPIs du header
  useEffect(() => {
    if (academicYear?.id) {
      loadEduCastStats();
    }
  }, [academicYear?.id]);

  const loadEduCastStats = async () => {
    try {
      const res = await fetch(
        `/api/modules-complementaires/educast/stats?academicYearId=${academicYear?.id}`,
        { credentials: 'include' },
      );
      if (res.ok) {
        const data = await res.json();
        setStats(data?.data ?? data);
      }
    } catch (e) {
      console.error('Erreur chargement stats EduCast:', e);
    }
  };

  if (contextLoading) return <div className="p-8 text-center">Chargement...</div>;

  return (
    <ModuleContainer
      header={{
        title: 'EduCast',
        description:
          "Plateforme de diffusion multimédia pédagogique : chaînes enseignant, vidéos, podcasts, webinaires, capsules de révision, monétisation et modération",
        icon: 'video',
        kpis: stats
          ? [
              {
                label: 'Médias publiés',
                value: String(stats.totalContents ?? 0),
                icon: 'play',
                trend: 'up',
              },
              {
                label: 'Canaux actifs',
                value: String(stats.activeChannels ?? 0),
                icon: 'badgeCheck',
                trend: 'neutral',
              },
              {
                label: 'Revenus (F CFA)',
                value: String(stats.totalRevenue ?? 0),
                icon: 'trendingUp',
                trend: 'up',
              },
              {
                label: 'Inscriptions',
                value: String(stats.totalSubscribers ?? 0),
                icon: 'users',
                trend: 'up',
              },
            ]
          : [],
        actions: (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubModuleId('library')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-900/20 hover:bg-indigo-700 transition-all"
              title="Publier un nouveau contenu"
            >
              <Plus className="w-4 h-4" /> Publier Contenu
            </button>
            <button
              onClick={() => setActiveSubModuleId('reports')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all"
              title="Rapports & statistiques EduCast"
            >
              <Download className="w-4 h-4" /> Rapports
            </button>
          </div>
        ),
      }}
      subModules={{
        activeModuleId: activeSubModuleId,
        onModuleChange: setActiveSubModuleId,
        modules: [
          { id: 'dashboard', label: 'Tableau de Bord', icon: <LayoutDashboard className="w-4 h-4" /> },
          { id: 'library', label: 'Médiathèque', icon: <Library className="w-4 h-4" /> },
          { id: 'studio', label: 'Studio Enseignant', icon: <MonitorPlay className="w-4 h-4" /> },
          { id: 'monetization', label: 'Monétisation', icon: <Zap className="w-4 h-4" /> },
          { id: 'packs', label: 'Packs de Contenus', icon: <Package className="w-4 h-4" /> },
          { id: 'videos', label: 'Vidéos Pédagogiques', icon: <Video className="w-4 h-4" /> },
          { id: 'podcasts', label: 'Podcasts & Audios', icon: <Headphones className="w-4 h-4" /> },
          { id: 'webinars', label: 'Webinaires & Directs', icon: <Globe className="w-4 h-4" /> },
          { id: 'announcements', label: 'Annonces', icon: <Megaphone className="w-4 h-4" /> },
          { id: 'moderation', label: 'Modération', icon: <ShieldCheck className="w-4 h-4" /> },
          { id: 'analytics', label: 'Statistiques', icon: <BarChart3 className="w-4 h-4" /> },
          { id: 'reports', label: 'Rapports', icon: <FileText className="w-4 h-4" /> },
          { id: 'channels', label: 'Chaînes', icon: <Radio className="w-4 h-4" /> },
          { id: 'playlists', label: 'Playlists', icon: <ListMusic className="w-4 h-4" /> },
          { id: 'capsules', label: 'Capsules de Révision', icon: <Zap className="w-4 h-4" /> },
          { id: 'resources', label: 'Ressources', icon: <Paperclip className="w-4 h-4" /> },
          { id: 'settings', label: 'Configuration', icon: <Settings className="w-4 h-4" /> },
        ],
      }}
      content={
        activeSubModuleId === 'dashboard' ? { layout: 'default', children: <EduCastDashboard /> } :
        activeSubModuleId === 'library' ? { layout: 'default', children: <EduCastLibrary /> } :
        activeSubModuleId === 'studio' ? { layout: 'default', children: <EduCastTeacherStudio /> } :
        activeSubModuleId === 'monetization' ? { layout: 'default', children: <EduCastMonetization /> } :
        activeSubModuleId === 'packs' ? { layout: 'default', children: <EduCastPacks /> } :
        activeSubModuleId === 'videos' ? { layout: 'default', children: <EduCastVideos /> } :
        activeSubModuleId === 'podcasts' ? { layout: 'default', children: <EduCastPodcasts /> } :
        activeSubModuleId === 'webinars' ? { layout: 'default', children: <EduCastWebinars /> } :
        activeSubModuleId === 'announcements' ? { layout: 'default', children: <EduCastAnnouncements /> } :
        activeSubModuleId === 'moderation' ? { layout: 'default', children: <EduCastModeration /> } :
        activeSubModuleId === 'analytics' ? { layout: 'default', children: <EduCastAnalytics /> } :
        activeSubModuleId === 'reports' ? { layout: 'default', children: <EduCastReports /> } :
        activeSubModuleId === 'channels' ? { layout: 'default', children: <EduCastChannels /> } :
        activeSubModuleId === 'playlists' ? { layout: 'default', children: <EduCastPlaylists /> } :
        activeSubModuleId === 'capsules' ? { layout: 'default', children: <EduCastRevisionCapsules /> } :
        activeSubModuleId === 'resources' ? { layout: 'default', children: <EduCastResources /> } :
        activeSubModuleId === 'settings' ? { layout: 'default', children: <EduCastSettings /> } :
        { layout: 'default', children: <EduCastDashboard /> }
      }
    />
  );
}
