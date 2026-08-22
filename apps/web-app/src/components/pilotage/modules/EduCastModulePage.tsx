'use client';

/**
 * ============================================================================
 * EDUCAST — Interface unifiée type YouTube
 * ============================================================================
 *
 * Refonte août 2026 : remplacement des 17 onglets dispersés par une interface
 * unifiée type YouTube (sidebar + feed + watch view).
 *
 * Structure (comme YouTube) :
 *   ┌─────────────────────────────────────────────────────┐
 *   │ Top bar: [☰] [Search bar] [Upload] [Avatar]          │
 *   ├──────────┬──────────────────────────────────────────┤
 *   │ Sidebar  │ Main content area                         │
 *   │          │                                            │
 *   │ 🏠 Accueil│  Grid of content cards (thumbnails)       │
 *   │ 📺 Vidéos │  ┌──────┐ ┌──────┐ ┌──────┐              │
 *   │ 🎙️ Podcast│  │ Card │ │ Card │ │ Card │              │
 *   │ 📡 Webinar│  └──────┘ └──────┘ └──────┘              │
 *   │ 💊 Capsules│                                            │
 *   │ 📋 Playlists│ (Click a card → watch view opens inline) │
 *   │ 📁 Médiathèque│                                        │
 *   │ ⚙️ Studio │                                            │
 *   │ 📊 Stats  │                                            │
 *   │ 💰 Monét. │                                            │
 *   │ 🔒 Modér. │                                            │
 *   └──────────┴──────────────────────────────────────────┘
 *
 * ⭐ Director/Promoter: dropdown in top bar to switch between teachers
 * ⭐ Each teacher: their own channel with all their content
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Home, Video, Headphones, Radio, Pill, ListMusic, Library,
  MonitorPlay, BarChart3, Zap, ShieldCheck, Search, Upload,
  Menu, X, Play, Eye, Clock, ChevronDown, Users, Film,
  Plus, Settings, TrendingUp, Heart, MessageCircle, Share2, Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useModuleContext } from '@/hooks/useModuleContext';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

interface EduCastContent {
  id: string;
  title: string;
  description?: string;
  type: 'VIDEO' | 'PODCAST' | 'WEBINAR' | 'CAPSULE' | 'RESOURCE';
  thumbnailUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  duration?: number;
  views: number;
  teacherId: string;
  teacherName: string;
  teacherAvatarUrl?: string;
  channelId?: string;
  channelName?: string;
  createdAt: string;
  subject?: string;
  classLevel?: string;
  isPublished: boolean;
}

interface TeacherInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  role: string;
}

// ─────────────────────────────────────────────────────────────────────
// Sidebar items (YouTube-style)
// ─────────────────────────────────────────────────────────────────────

const SIDEBAR_ITEMS = [
  { id: 'home', label: 'Accueil', icon: Home },
  { id: 'videos', label: 'Vidéos', icon: Video },
  { id: 'podcasts', label: 'Podcasts', icon: Headphones },
  { id: 'webinars', label: 'Webinaires', icon: Radio },
  { id: 'capsules', label: 'Capsules de Révision', icon: Pill },
  { id: 'playlists', label: 'Playlists', icon: ListMusic },
  { id: 'library', label: 'Médiathèque', icon: Library },
  { id: 'studio', label: 'Studio', icon: MonitorPlay },
  { id: 'analytics', label: 'Statistiques', icon: BarChart3 },
  { id: 'monetization', label: 'Monétisation', icon: Zap },
  { id: 'moderation', label: 'Modération', icon: ShieldCheck, directorOnly: true },
  { id: 'settings', label: 'Configuration', icon: Settings },
];

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function formatViews(views: number): string {
  if (views < 1000) return `${views} vue${views > 1 ? 's' : ''}`;
  if (views < 1000000) return `${(views / 1000).toFixed(1)}K vues`;
  return `${(views / 1000000).toFixed(1)}M vues`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)} jour${diff > 172800 ? 's' : ''}`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDuration(seconds: number): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const TYPE_BADGES: Record<string, { label: string; color: string; icon: any }> = {
  VIDEO: { label: 'Vidéo', color: 'bg-red-500', icon: Video },
  PODCAST: { label: 'Podcast', color: 'bg-purple-500', icon: Headphones },
  WEBINAR: { label: 'Webinaire', color: 'bg-blue-500', icon: Radio },
  CAPSULE: { label: 'Capsule', color: 'bg-emerald-500', icon: Pill },
  RESOURCE: { label: 'Ressource', color: 'bg-amber-500', icon: Library },
};

const AVATAR_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-indigo-500', 'bg-purple-500', 'bg-cyan-500', 'bg-orange-500'];

function getAvatarColor(name: string): string {
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────

export default function EduCastModulePage() {
  const { academicYear } = useModuleContext();
  const { user } = useAppSession();
  const userRole = (user?.role || '').toUpperCase();
  const isDirector = ['PROMOTER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR', 'ADMIN', 'PLATFORM_OWNER'].includes(userRole);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [contents, setContents] = useState<EduCastContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContent, setSelectedContent] = useState<EduCastContent | null>(null);
  const [teachers, setTeachers] = useState<TeacherInfo[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [showUploadModal, setShowUploadModal] = useState(false);

  // ⭐ Load teachers (for director/promoter switcher)
  useEffect(() => {
    if (!isDirector) return;
    (async () => {
      try {
        const res = await fetch(`/api/modules-complementaires/educast/contents?academicYearId=${academicYear?.id || ''}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const items = data?.data || data || [];
          // Extract unique teachers
          const teacherMap = new Map<string, TeacherInfo>();
          for (const item of items) {
            if (item.teacherId && !teacherMap.has(item.teacherId)) {
              teacherMap.set(item.teacherId, {
                id: item.teacherId,
                firstName: item.teacherFirstName || '',
                lastName: item.teacherLastName || '',
                email: item.teacherEmail || '',
                avatarUrl: item.teacherAvatarUrl,
                role: 'TEACHER',
              });
            }
          }
          setTeachers(Array.from(teacherMap.values()));
        }
      } catch (e) { console.error('Failed to load teachers:', e); }
    })();
  }, [isDirector, academicYear?.id]);

  // ⭐ Load content
  const loadContent = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (academicYear?.id) params.set('academicYearId', academicYear.id);
      if (activeView !== 'home') params.set('type', activeView.toUpperCase());
      if (searchQuery) params.set('q', searchQuery);
      if (selectedTeacherId) params.set('teacherId', selectedTeacherId);
      const res = await fetch(`/api/modules-complementaires/educast/contents?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setContents(data?.data || data || []);
      }
    } catch (e) { console.error('Failed to load content:', e); }
    finally { setLoading(false); }
  }, [academicYear?.id, activeView, searchQuery, selectedTeacherId]);

  useEffect(() => { loadContent(); }, [loadContent]);

  // Filter sidebar items based on role
  const visibleSidebarItems = SIDEBAR_ITEMS.filter(item => !item.directorOnly || isDirector);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-white overflow-hidden">
      {/* ═════════ TOP BAR (YouTube-style) ═════════ */}
      <div className="flex items-center gap-4 px-4 h-14 border-b border-slate-200 bg-white sticky top-0 z-50">
        {/* Hamburger menu */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-full hover:bg-slate-100"
        >
          <Menu className="w-5 h-5 text-slate-700" />
        </button>
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center">
            <Play className="w-4 h-4 text-white" fill="white" />
          </div>
          <span className="text-lg font-bold text-slate-900 hidden sm:block">EduCast</span>
        </div>
        {/* Search bar */}
        <div className="flex-1 max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher des vidéos, podcasts, capsules..."
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-full text-sm outline-none focus:bg-white focus:ring-2 focus:ring-pink-500/30"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        {/* ⭐ Teacher switcher (director/promoter only) */}
        {isDirector && teachers.length > 0 && (
          <select
            value={selectedTeacherId}
            onChange={e => setSelectedTeacherId(e.target.value)}
            className="hidden md:block px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
            title="Changer d'enseignant"
          >
            <option value="">Tous les enseignants</option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>
                {t.firstName} {t.lastName}
              </option>
            ))}
          </select>
        )}
        {/* Upload button */}
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-pink-600 text-white rounded-full text-sm font-bold hover:bg-pink-700"
        >
          <Upload className="w-4 h-4" />
          <span className="hidden sm:block">Publier</span>
        </button>
        {/* User avatar */}
        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold', getAvatarColor(user?.firstName || user?.email || 'U'))}>
          {getInitials(`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'U')}
        </div>
      </div>

      {/* ═════════ MAIN LAYOUT ═════════ */}
      <div className="flex flex-1 overflow-hidden">
        {/* ═════════ SIDEBAR (YouTube-style) ═════════ */}
        {sidebarOpen && (
          <div className="w-56 flex-shrink-0 border-r border-slate-200 overflow-y-auto bg-white">
            <div className="py-2">
              {visibleSidebarItems.map(item => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setActiveView(item.id); setSelectedContent(null); }}
                    className={cn(
                      'w-full flex items-center gap-4 px-4 py-2.5 text-sm transition-colors',
                      isActive ? 'bg-pink-50 font-bold text-pink-700' : 'text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
            {/* Teacher list (for director/promoter) */}
            {isDirector && teachers.length > 0 && (
              <div className="border-t border-slate-100 pt-2 mt-2">
                <div className="px-4 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Enseignants
                </div>
                {teachers.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTeacherId(selectedTeacherId === t.id ? '' : t.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50 transition-colors',
                      selectedTeacherId === t.id && 'bg-pink-50 font-bold text-pink-700'
                    )}
                  >
                    <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold', getAvatarColor(t.firstName + t.lastName))}>
                      {getInitials(`${t.firstName} ${t.lastName}`)}
                    </div>
                    <span className="truncate text-xs">{t.firstName} {t.lastName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═════════ MAIN CONTENT AREA ═════════ */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          {/* Watch view (inline video player) */}
          {selectedContent ? (
            <WatchView
              content={selectedContent}
              onBack={() => setSelectedContent(null)}
              relatedContent={contents.filter(c => c.id !== selectedContent.id && c.type === selectedContent.type).slice(0, 5)}
            />
          ) : (
            /* Feed view (grid of content cards) */
            <FeedView
              loading={loading}
              contents={contents}
              activeView={activeView}
              searchQuery={searchQuery}
              onContentClick={setSelectedContent}
            />
          )}
        </div>
      </div>

      {/* ═════════ Upload Modal ═════════ */}
      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onUploaded={() => { setShowUploadModal(false); loadContent(); }}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
//  FEED VIEW — Grid of content cards (YouTube home page)
// ═════════════════════════════════════════════════════════════════

function FeedView({
  loading, contents, activeView, searchQuery, onContentClick,
}: {
  loading: boolean;
  contents: EduCastContent[];
  activeView: string;
  searchQuery: string;
  onContentClick: (content: EduCastContent) => void;
}) {
  const viewTitle = SIDEBAR_ITEMS.find(i => i.id === activeView)?.label || 'Accueil';

  if (loading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm animate-pulse">
              <div className="aspect-video bg-slate-200" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (contents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Film className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-lg font-bold text-slate-700">
          {searchQuery ? `Aucun résultat pour "${searchQuery}"` : `Aucun contenu dans ${viewTitle}`}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {searchQuery ? 'Essayez d\'autres mots-clés' : 'Publiez votre premier contenu en cliquant sur "Publier"'}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Category chips (YouTube-style) */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {SIDEBAR_ITEMS.filter(i => !i.directorOnly).map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => { /* handled by sidebar, this is just a visual chip */ }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition',
                activeView === item.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {contents.map(content => (
          <ContentCard key={content.id} content={content} onClick={() => onContentClick(content)} />
        ))}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
//  CONTENT CARD — Video thumbnail card (YouTube-style)
// ═════════════════════════════════════════════════════════════════

function ContentCard({ content, onClick }: { content: EduCastContent; onClick: () => void }) {
  const badge = TYPE_BADGES[content.type] || TYPE_BADGES.VIDEO;
  const BadgeIcon = badge.icon;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer group"
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-gradient-to-br from-slate-200 to-slate-300 relative overflow-hidden">
        {content.thumbnailUrl ? (
          <img src={content.thumbnailUrl} alt={content.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        ) : (
          <div className={cn('w-full h-full flex items-center justify-center', badge.color)}>
            <BadgeIcon className="w-12 h-12 text-white opacity-50" />
          </div>
        )}
        {/* Type badge */}
        <span className={cn('absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold text-white', badge.color)}>
          {badge.label}
        </span>
        {/* Duration */}
        {content.duration && (
          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-white text-[10px] font-medium rounded">
            {formatDuration(content.duration)}
          </span>
        )}
        {/* Play button on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
          <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
            <Play className="w-6 h-6 text-white" fill="white" />
          </div>
        </div>
      </div>
      {/* Info */}
      <div className="p-3 flex gap-3">
        {/* Teacher avatar */}
        <div className={cn('w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold', getAvatarColor(content.teacherName))}>
          {getInitials(content.teacherName)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 leading-tight">
            {content.title}
          </h3>
          <p className="text-xs text-slate-500 mt-1 truncate">
            {content.teacherName}
          </p>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
            <span className="flex items-center gap-0.5">
              <Eye className="w-3 h-3" /> {formatViews(content.views)}
            </span>
            <span>•</span>
            <span>{formatDate(content.createdAt)}</span>
          </div>
          {content.subject && (
            <span className="inline-block mt-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-medium rounded">
              {content.subject} {content.classLevel ? `• ${content.classLevel}` : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
//  WATCH VIEW — Inline video player (YouTube watch page)
// ═════════════════════════════════════════════════════════════════

function WatchView({
  content, onBack, relatedContent,
}: {
  content: EduCastContent;
  onBack: () => void;
  relatedContent: EduCastContent[];
}) {
  const { user } = useAppSession();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  // ⭐ Load likes + comments on mount
  useEffect(() => {
    if (!content.id) return;
    (async () => {
      try {
        // Check if liked
        if (user?.id) {
          const favRes = await fetch(`/api/modules-complementaires/educast/media/${content.id}/favorite-status?userId=${user.id}`, { credentials: 'include' });
          if (favRes.ok) {
            const favData = await favRes.json();
            setLiked(favData.liked || false);
          }
        }
        // Load comments
        const cmtRes = await fetch(`/api/modules-complementaires/educast/media/${content.id}/comments`, { credentials: 'include' });
        if (cmtRes.ok) {
          const cmtData = await cmtRes.json();
          setComments(Array.isArray(cmtData) ? cmtData : (cmtData?.data || []));
        }
        // Track view
        await fetch(`/api/modules-complementaires/educast/media/${content.id}/engage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'VIEW' }),
          credentials: 'include',
        }).catch(() => {});
      } catch {}
    })();
  }, [content.id, user?.id]);

  const handleLike = async () => {
    try {
      const res = await fetch(`/api/modules-complementaires/educast/media/${content.id}/favorite`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();
      setLiked(data.liked);
      setLikeCount(prev => data.liked ? prev + 1 : Math.max(0, prev - 1));
    } catch {}
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || !user?.id) return;
    setPostingComment(true);
    try {
      const res = await fetch(`/api/modules-complementaires/educast/media/${content.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to post comment');
      const data = await res.json();
      setComments(prev => [data, ...prev]);
      setNewComment('');
      toast.success('Commentaire publié');
    } catch (e: any) {
      toast.error('Échec: ' + e.message);
    } finally {
      setPostingComment(false);
    }
  };

  const handleShare = () => {
    const url = window.location.href.split('?')[0] + `?content=${content.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Lien copié dans le presse-papiers');
    }).catch(() => {
      toast.info(`Partagez: ${content.title}`);
    });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Main video area */}
      <div className="flex-1 min-w-0">
        {/* Back button */}
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-3">
          <ChevronDown className="w-4 h-4 rotate-90" /> Retour
        </button>
        {/* Player */}
        <div className="aspect-video bg-black rounded-xl overflow-hidden">
          {content.videoUrl ? (
            <video src={content.videoUrl} controls className="w-full h-full" autoPlay />
          ) : content.audioUrl ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <Headphones className="w-16 h-16 text-white opacity-50 mb-2" />
                <audio src={content.audioUrl} controls className="mt-2" autoPlay />
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white text-sm">Lecture non disponible</div>
          )}
        </div>
        {/* Title */}
        <h1 className="text-lg font-bold text-slate-900 mt-3">{content.title}</h1>
        {/* Teacher info + action buttons (YouTube-style) */}
        <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold', getAvatarColor(content.teacherName))}>
              {getInitials(content.teacherName)}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{content.teacherName}</p>
              <p className="text-xs text-slate-500">{formatViews(content.views)} • {formatDate(content.createdAt)}</p>
            </div>
          </div>
          {/* ⭐ Action buttons (like, comment, share — YouTube-style) */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleLike}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition',
                liked ? 'bg-pink-100 text-pink-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              )}
            >
              <Heart className={cn('w-4 h-4', liked && 'fill-pink-600 text-pink-600')} />
              {likeCount > 0 && <span>{likeCount}</span>}
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-full text-xs font-bold transition">
              <MessageCircle className="w-4 h-4" />
              {comments.length}
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-full text-xs font-bold transition"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Partager</span>
            </button>
            {content.subject && (
              <span className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-full">
                {content.subject} {content.classLevel ? `• ${content.classLevel}` : ''}
              </span>
            )}
          </div>
        </div>
        {/* Description */}
        {content.description && (
          <div className="mt-4 p-3 bg-slate-50 rounded-xl text-sm text-slate-600 whitespace-pre-wrap">
            {content.description}
          </div>
        )}
        {/* ⭐ COMMENTS SECTION (YouTube-style) */}
        <div className="mt-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Commentaires ({comments.length})
          </h3>
          {/* Comment input */}
          {user?.id && (
            <div className="flex gap-3">
              <div className={cn('w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold', getAvatarColor(`${user.firstName || ''} ${user.lastName || ''}`))}>
                {getInitials(`${user.firstName || ''} ${user.lastName || ''}`)}
              </div>
              <div className="flex-1 space-y-2">
                <textarea
                  placeholder="Ajouter un commentaire..."
                  className="w-full px-3 py-2 bg-transparent border-b border-slate-200 text-sm outline-none focus:border-pink-500 resize-none"
                  rows={1}
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                />
                {newComment.trim() && (
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setNewComment('')} className="px-3 py-1 text-xs text-slate-600 rounded-full hover:bg-slate-100">Annuler</button>
                    <button
                      onClick={handlePostComment}
                      disabled={postingComment}
                      className="px-3 py-1 bg-pink-600 text-white text-xs font-bold rounded-full hover:bg-pink-700 disabled:opacity-50"
                    >
                      {postingComment ? '...' : 'Commenter'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Comments list */}
          {comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map((cmt: any) => (
                <div key={cmt.id} className="flex gap-3">
                  <div className={cn('w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold', getAvatarColor(`${cmt.user?.firstName || ''} ${cmt.user?.lastName || ''}`))}>
                    {getInitials(`${cmt.user?.firstName || ''} ${cmt.user?.lastName || ''}`)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {cmt.user?.firstName} {cmt.user?.lastName}
                      </span>
                      <span className="text-[10px] text-slate-400">{formatDate(cmt.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-700 mt-0.5">{cmt.content}</p>
                  </div>
                  {user?.id === cmt.userId && (
                    <button
                      onClick={async () => {
                        try {
                          await fetch(`/api/modules-complementaires/educast/comments/${cmt.id}`, { method: 'DELETE', credentials: 'include' });
                          setComments(prev => prev.filter((c: any) => c.id !== cmt.id));
                          toast.success('Commentaire supprimé');
                        } catch {}
                      }}
                      className="text-[10px] text-red-400 hover:text-red-600"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Aucun commentaire pour le moment</p>
          )}
        </div>
      </div>

      {/* Related content sidebar */}
      <div className="lg:w-80 flex-shrink-0 space-y-3">
        <h3 className="text-sm font-bold text-slate-700 mb-2">Contenus similaires</h3>
        {relatedContent.map(rc => (
          <div
            key={rc.id}
            onClick={() => { onBack(); setTimeout(() => {}, 100); }}
            className="flex gap-2 cursor-pointer hover:bg-white rounded-lg p-1 transition"
          >
            <div className="w-40 aspect-video bg-slate-200 rounded-lg flex-shrink-0 relative overflow-hidden">
              {rc.thumbnailUrl ? (
                <img src={rc.thumbnailUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className={cn('w-full h-full flex items-center justify-center', (TYPE_BADGES[rc.type] || TYPE_BADGES.VIDEO).color)}>
                  <Play className="w-6 h-6 text-white opacity-50" />
                </div>
              )}
              {rc.duration && (
                <span className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 text-white text-[8px] rounded">
                  {formatDuration(rc.duration)}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 line-clamp-2 leading-tight">{rc.title}</p>
              <p className="text-[10px] text-slate-500 mt-1">{rc.teacherName}</p>
              <p className="text-[10px] text-slate-400">{formatViews(rc.views)} • {formatDate(rc.createdAt)}</p>
            </div>
          </div>
        ))}
        {relatedContent.length === 0 && (
          <p className="text-xs text-slate-400">Aucun contenu similaire</p>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
//  UPLOAD MODAL — Publish new content (YouTube upload-style)
// ═════════════════════════════════════════════════════════════════

function UploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'VIDEO' | 'PODCAST' | 'WEBINAR' | 'CAPSULE' | 'RESOURCE'>('VIDEO');
  const [subject, setSubject] = useState('');
  const [classLevel, setClassLevel] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!title.trim() || !file) { toast.error('Titre et fichier requis'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('type', type);
      formData.append('subject', subject);
      formData.append('classLevel', classLevel);
      formData.append('file', file);
      const res = await fetch('/api/modules-complementaires/educast/contents', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Upload échoué');
      toast.success('Contenu publié avec succès');
      onUploaded();
    } catch (e: any) {
      toast.error('Échec upload: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Upload className="w-4 h-4 text-pink-600" /> Publier un contenu
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          {/* Type selector */}
          <div className="flex gap-2 flex-wrap">
            {Object.entries(TYPE_BADGES).map(([key, badge]) => (
              <button
                key={key}
                onClick={() => setType(key as any)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition',
                  type === key ? `${badge.color} text-white` : 'bg-slate-100 text-slate-600'
                )}
              >
                <badge.icon className="w-3.5 h-3.5" />
                {badge.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Titre *"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-500/30"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <textarea
            placeholder="Description"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-500/30"
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Matière (ex: Mathématiques)"
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-500/30"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
            <input
              type="text"
              placeholder="Classe (ex: CM2)"
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-500/30"
              value={classLevel}
              onChange={e => setClassLevel(e.target.value)}
            />
          </div>
          {/* File input */}
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center">
            {file ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-700 truncate">{file.name}</span>
                <button onClick={() => setFile(null)} className="text-red-500 text-xs">Supprimer</button>
              </div>
            ) : (
              <label className="cursor-pointer">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600">Cliquez pour sélectionner un fichier</p>
                <p className="text-xs text-slate-400 mt-1">Vidéo, audio, ou document</p>
                <input
                  type="file"
                  className="hidden"
                  accept="video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx"
                  onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); }}
                />
              </label>
            )}
          </div>
        </div>
        <div className="p-4 border-t border-slate-100 flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-200">
            Annuler
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || !title.trim() || !file}
            className="flex-1 px-4 py-2 bg-pink-600 text-white text-sm font-bold rounded-lg hover:bg-pink-700 disabled:opacity-50"
          >
            {uploading ? 'Publication...' : 'Publier'}
          </button>
        </div>
      </div>
    </div>
  );
}
