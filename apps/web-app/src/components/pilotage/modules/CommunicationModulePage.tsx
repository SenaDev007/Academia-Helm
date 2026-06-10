/**
 * ============================================================================
 * MODULE COMMUNICATION & NOTIFICATIONS (Spec 15 Onglets — Production Ready)
 * ============================================================================
 * Centre de commandement multicanal de l'établissement.
 *
 * 1. Tableau de bord          9. Communication Élèves
 * 2. Messagerie Interne      10. Communication Administrative
 * 3. Annonces Officielles    11. Canaux & Connecteurs
 * 4. Notifications Auto      12. Historique & Traçabilité
 * 5. Campagnes               13. Rapports & Analytique
 * 6. Modèles de Messages     14. Paramétrage
 * 7. Communication Parents   15. ORION Communication
 * 8. Communication Enseignants
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import {
  LayoutDashboard, MessageSquare, Megaphone, Bell, Zap,
  FileText, Users, GraduationCap, BookOpen, Building2,
  Wifi, History, BarChart3, Settings, ShieldCheck,
  Plus, Send, Download, BrainCircuit
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';

// Sub-module components
import CommDashboard          from '@/components/communication/CommDashboard';
import InternalMessaging      from '@/components/communication/InternalMessaging';
import OfficialAnnouncements  from '@/components/communication/OfficialAnnouncements';
import AutoNotifications      from '@/components/communication/AutoNotifications';
import CampaignManager        from '@/components/communication/CampaignManager';
import MessageTemplates       from '@/components/communication/MessageTemplates';
import ParentCommunication    from '@/components/communication/ParentCommunication';
import TeacherCommunication   from '@/components/communication/TeacherCommunication';
import StudentCommunication   from '@/components/communication/StudentCommunication';
import AdminCommunication     from '@/components/communication/AdminCommunication';
import ChannelConnectors      from '@/components/communication/ChannelConnectors';
import CommHistory            from '@/components/communication/CommHistory';
import CommAnalytics          from '@/components/communication/CommAnalytics';
import CommSettings           from '@/components/communication/CommSettings';
import OrionCommunication     from '@/components/communication/OrionCommunication';

export default function CommunicationModulePage() {
  const { academicYear, isLoading: contextLoading } = useModuleContext();
  const [activeSubModuleId, setActiveSubModuleId] = useState<string>('dashboard');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (academicYear?.id) loadCommStats();
  }, [academicYear?.id]);

  const loadCommStats = async () => {
    try {
      const res = await fetch(`/api/communication/v2/dashboard/stats?academicYearId=${academicYear?.id}`);
      if (res.ok) {
        const data = await res.json();
        setStats({
          totalSent:       data.totalSent       ?? 0,
          unread:          data.unread           ?? 0,
          activeCampaigns: data.activeCampaigns  ?? 0,
          deliveryRate:    data.deliveryRate     ?? 0,
        });
      }
    } catch (e) { console.error(e); }
  };

  if (contextLoading) return <div className="p-8 text-center text-slate-400">Initialisation Communication...</div>;

  return (
    <>
      <ModuleContainer
        header={{
          title: 'Communication & Notifications',
          description: 'Centre de commandement multicanal — messagerie, annonces, campagnes SMS/WhatsApp/Email',
          icon: 'messageSquare',
          kpis: stats ? [
            { label: 'Messages Envoyés',    value: stats.totalSent,        icon: 'send',         trend: 'up' },
            { label: 'Non Lus',             value: stats.unread,           icon: 'bell',         trend: 'down' },
            { label: 'Campagnes Actives',   value: stats.activeCampaigns,  icon: 'zap',          trend: 'neutral' },
            { label: 'Taux de Livraison',   value: `${stats.deliveryRate}%`, icon: 'shieldCheck', trend: 'up' },
          ] : [],
          actions: (
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl font-bold shadow-lg shadow-violet-900/20 hover:bg-violet-700 transition-all">
                <Plus className="w-4 h-4" /> Nouvelle Annonce
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all">
                <Send className="w-4 h-4" /> Envoyer Message
              </button>
            </div>
          )
        }}
        subModules={{
          activeModuleId: activeSubModuleId,
          onModuleChange: setActiveSubModuleId,
          modules: [
            { id: 'dashboard',    label: 'Tableau de Bord',        icon: <LayoutDashboard className="w-4 h-4" /> },
            { id: 'messaging',    label: 'Messagerie Interne',     icon: <MessageSquare className="w-4 h-4" /> },
            { id: 'announcements',label: 'Annonces Officielles',   icon: <Megaphone className="w-4 h-4" /> },
            { id: 'auto',         label: 'Notifications Auto',     icon: <Bell className="w-4 h-4" /> },
            { id: 'campaigns',    label: 'Campagnes',              icon: <Zap className="w-4 h-4" /> },
            { id: 'templates',    label: 'Modèles Messages',       icon: <FileText className="w-4 h-4" /> },
            { id: 'parents',      label: 'Parents',                icon: <Users className="w-4 h-4" /> },
            { id: 'teachers',     label: 'Enseignants',            icon: <GraduationCap className="w-4 h-4" /> },
            { id: 'students',     label: 'Élèves',                 icon: <BookOpen className="w-4 h-4" /> },
            { id: 'admin',        label: 'Administrative',         icon: <Building2 className="w-4 h-4" /> },
            { id: 'channels',     label: 'Canaux & Connecteurs',   icon: <Wifi className="w-4 h-4" /> },
            { id: 'history',      label: 'Historique',             icon: <History className="w-4 h-4" /> },
            { id: 'analytics',    label: 'Rapports & Analytique',  icon: <BarChart3 className="w-4 h-4" /> },
            { id: 'settings',     label: 'Paramétrage',            icon: <Settings className="w-4 h-4" /> },
            { id: 'orion',        label: 'ORION Communication',    icon: <ShieldCheck className="w-4 h-4" /> },
          ]
        }}
        content={{
          layout: 'default',
          children:
            activeSubModuleId === 'dashboard'     ? <CommDashboard /> :
            activeSubModuleId === 'messaging'     ? <InternalMessaging /> :
            activeSubModuleId === 'announcements' ? <OfficialAnnouncements /> :
            activeSubModuleId === 'auto'          ? <AutoNotifications /> :
            activeSubModuleId === 'campaigns'     ? <CampaignManager /> :
            activeSubModuleId === 'templates'     ? <MessageTemplates /> :
            activeSubModuleId === 'parents'       ? <ParentCommunication /> :
            activeSubModuleId === 'teachers'      ? <TeacherCommunication /> :
            activeSubModuleId === 'students'      ? <StudentCommunication /> :
            activeSubModuleId === 'admin'         ? <AdminCommunication /> :
            activeSubModuleId === 'channels'      ? <ChannelConnectors /> :
            activeSubModuleId === 'history'       ? <CommHistory /> :
            activeSubModuleId === 'analytics'     ? <CommAnalytics /> :
            activeSubModuleId === 'settings'      ? <CommSettings /> :
            activeSubModuleId === 'orion'         ? <OrionCommunication /> :
            <CommDashboard />
        }}
      />
    </>
  );
}
