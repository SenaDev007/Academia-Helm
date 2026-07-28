"use client";

/**
 * ============================================================================
 * PORTAIL PARENT — Communication [/app/parent/messages]
 * ============================================================================
 *
 * Page de communication parent :
 *   1. Notifications in-app reçues par le parent (depuis /api/notifications)
 *   2. Annonces de l'école (depuis /api/communication/v2/announcements)
 *   3. Coordonnées de l'école pour contacter directement
 *
 * Pas de redirect vers /app/communication (réservé au staff école).
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useSchoolIdentity } from "@/hooks/useSchoolIdentity";
import {
  MessageSquare, Loader2, Bell, CheckCircle2, Phone, Mail,
  MapPin, RefreshCw, Building2, Megaphone,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ParentMessagesPage() {
  const { user, tenant } = useAppSession();
  const { identity: school } = useSchoolIdentity();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"notifications" | "annonces" | "contact">("notifications");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Charger les notifications + annonces en parallèle
      const [notifRes, annRes] = await Promise.all([
        fetch(`/api/notifications?limit=50`, { credentials: "include" }),
        fetch(`/api/communication/v2/announcements?limit=20`, { credentials: "include" }).catch(() => null),
      ]);

      const notifData = await notifRes.json();
      setNotifications(Array.isArray(notifData) ? notifData : (notifData.items || []));

      if (annRes && annRes.ok) {
        const annData = await annRes.json();
        setAnnouncements(Array.isArray(annData) ? annData : (annData.items || []));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH", credentials: "include" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch {
      // silent
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch(`/api/notifications/read-all`, { method: "PATCH", credentials: "include" });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success("Toutes les notifications marquées comme lues");
    } catch {
      toast.error("Erreur", { description: "Impossible de marquer comme lu" });
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-teal-600" />
          <h2 className="text-lg font-bold text-slate-900">Communication</h2>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
              {unreadCount} non lu(s)
            </span>
          )}
        </div>
        <button
          onClick={loadData}
          className="p-2 hover:bg-slate-100 rounded-lg"
          aria-label="Rafraîchir"
        >
          <RefreshCw className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
        {[
          { id: "notifications" as const, label: "Notifications", icon: Bell },
          { id: "annonces" as const, label: "Annonces", icon: Megaphone },
          { id: "contact" as const, label: "Contacter l'école", icon: Phone },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                isActive
                  ? "bg-teal-50 text-teal-700 border border-teal-200"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : (
        <>
          {activeTab === "notifications" && (
            <NotificationsTab
              notifications={notifications}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
              unreadCount={unreadCount}
            />
          )}
          {activeTab === "annonces" && <AnnouncementsTab announcements={announcements} />}
          {activeTab === "contact" && <ContactTab school={school} tenant={tenant} />}
        </>
      )}
    </div>
  );
}

// ============================================================================
// Onglet Notifications
// ============================================================================

function NotificationsTab({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  unreadCount,
}: {
  notifications: any[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  unreadCount: number;
}) {
  if (notifications.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <Bell className="h-10 w-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Aucune notification.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <button
            onClick={onMarkAllAsRead}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100"
          >
            <CheckCircle2 className="h-3 w-3" />
            Tout marquer comme lu
          </button>
        </div>
      )}
      {notifications.map((n) => (
        <div
          key={n.id}
          className={cn(
            "bg-white rounded-xl border p-3 flex items-start gap-3 transition-all",
            n.isRead ? "border-slate-200" : "border-teal-300 bg-teal-50/30"
          )}
        >
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
              n.isRead ? "bg-slate-100" : "bg-teal-100"
            )}
          >
            <Bell className={cn("h-4 w-4", n.isRead ? "text-slate-400" : "text-teal-600")} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={cn("text-sm font-semibold", n.isRead ? "text-slate-700" : "text-slate-900")}>
                {n.title}
              </p>
              {!n.isRead && (
                <span className="inline-block w-2 h-2 rounded-full bg-teal-500" />
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5">{n.body}</p>
            <p className="text-[10px] text-slate-400 mt-1">
              {n.createdAt && format(new Date(n.createdAt), "d MMM yyyy 'à' HH:mm", { locale: fr })}
            </p>
          </div>
          {!n.isRead && (
            <button
              onClick={() => onMarkAsRead(n.id)}
              className="text-xs text-teal-700 hover:underline"
            >
              Marquer lu
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Onglet Annonces
// ============================================================================

function AnnouncementsTab({ announcements }: { announcements: any[] }) {
  if (announcements.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <Megaphone className="h-10 w-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Aucune annonce de l'école pour le moment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {announcements.map((a) => (
        <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Megaphone className="h-4 w-4 text-blue-600" />
            <h3 className="font-bold text-slate-900">{a.title || a.subject || "Annonce"}</h3>
          </div>
          {a.body && (
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.body}</p>
          )}
          {a.content && (
            <div
              className="text-sm text-slate-700 mt-1"
              dangerouslySetInnerHTML={{ __html: a.content }}
            />
          )}
          <p className="text-xs text-slate-400 mt-2">
            {a.publishedAt
              ? format(new Date(a.publishedAt), "d MMM yyyy", { locale: fr })
              : a.createdAt
                ? format(new Date(a.createdAt), "d MMM yyyy", { locale: fr })
                : ""}
          </p>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Onglet Contacter l'école
// ============================================================================

function ContactTab({ school, tenant }: { school: any; tenant: any }) {
  const schoolName = school?.schoolName || tenant?.name || "Établissement";
  const phone = school?.phone || tenant?.phone;
  const email = school?.email || tenant?.email;
  const address = school?.address || tenant?.address;

  return (
    <div className="space-y-3">
      <div className="bg-gradient-to-r from-teal-600 to-blue-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg">{schoolName}</h3>
            <p className="text-sm text-teal-100">Contacter l'administration</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {phone && (
          <a
            href={`tel:${phone}`}
            className="bg-white rounded-xl border border-slate-200 p-4 hover:border-teal-300 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center mb-2">
              <Phone className="h-5 w-5 text-teal-600" />
            </div>
            <p className="text-xs text-slate-500 uppercase">Téléphone</p>
            <p className="font-bold text-slate-900 text-sm">{phone}</p>
          </a>
        )}
        {email && (
          <a
            href={`mailto:${email}`}
            className="bg-white rounded-xl border border-slate-200 p-4 hover:border-teal-300 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-2">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-xs text-slate-500 uppercase">Email</p>
            <p className="font-bold text-slate-900 text-sm break-all">{email}</p>
          </a>
        )}
        {address && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mb-2">
              <MapPin className="h-5 w-5 text-amber-600" />
            </div>
            <p className="text-xs text-slate-500 uppercase">Adresse</p>
            <p className="font-bold text-slate-900 text-sm">{address}</p>
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm text-amber-900">
          <strong>Pour toute question pédagogique</strong> (devoirs, présence, cahier journal),
          contactez l'enseignant titulaire de votre enfant — ses coordonnées sont disponibles
          sur la fiche détaillée de l'enfant.
        </p>
        <p className="text-sm text-amber-900 mt-2">
          <strong>Pour toute question administrative</strong> (scolarité, bulletins, inscription),
          contactez l'administration aux coordonnées ci-dessus.
        </p>
      </div>
    </div>
  );
}
