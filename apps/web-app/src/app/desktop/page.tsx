"use client";

/**
 * ============================================================================
 * DESKTOP APP LANDING — Sélecteur d'école pour l'app desktop Tauri
 * ============================================================================
 *
 * Cette page est le point d'entrée de l'application desktop Windows (Tauri).
 *
 * FLUX :
 *   1. Au premier lancement → l'utilisateur recherche son école
 *   2. L'école sélectionnée est sauvegardée dans localStorage
 *   3. Aux lancements suivants → redirection automatique vers l'école
 *   4. L'utilisateur arrive sur la page de connexion de SON école
 *
 * PRÉREQUIS :
 *   - L'école doit déjà avoir un compte créé sur la version web
 *   - L'utilisateur doit déjà avoir ses identifiants (créés par l'école)
 *
 * Cette page NE GÈRE PAS :
 *   - La création de compte école (ça se fait sur la version web publique)
 *   - La landing page marketing (non pertinente sur desktop)
 *   - L'inscription publique (non pertinente sur desktop)
 * ============================================================================
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Loader2, Building2, ChevronRight, X, CheckCircle2,
  ArrowRight, Settings, LogOut,
} from "lucide-react";
import { usePublicSchools } from "@/lib/query/use-public-schools";
import { QueryProvider } from "@/providers/QueryProvider";

// ── Palette Academia Helm ──
const NAVY = "#0b2f73";
const BLUE = "#1d4fa5";
const GOLD = "#f5b335";

interface SchoolSelection {
  id: string;
  name: string;
  slug: string;
  subdomain?: string;
  logoUrl?: string;
  city?: string;
  country?: string;
}

const STORAGE_KEY = "academia_helm_desktop_school";

function DesktopSchoolSelector() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSchool, setSelectedSchool] = useState<SchoolSelection | null>(null);
  const [savedSchool, setSavedSchool] = useState<SchoolSelection | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⭐ Hook React Query — récupère la liste des écoles publiques
  const { schools: allSchools, isLoading, error, refetch } = usePublicSchools();

  // ── Au chargement : vérifier si une école est déjà sauvegardée ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const school = JSON.parse(saved) as SchoolSelection;
        setSavedSchool(school);
        // Redirection automatique vers l'école sauvegardée
        redirectToSchool(school);
      }
    } catch {
      // localStorage corrompu — on continue avec le sélecteur
    }
  }, []);

  // Focus sur le champ de recherche au chargement
  useEffect(() => {
    if (!savedSchool && inputRef.current) {
      inputRef.current.focus();
    }
  }, [savedSchool]);

  // ── Filtrer les écoles par recherche ──
  const filteredSchools = (allSchools || []).filter((school: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      school.name?.toLowerCase().includes(q) ||
      school.city?.toLowerCase().includes(q) ||
      school.country?.toLowerCase().includes(q) ||
      school.slug?.toLowerCase().includes(q)
    );
  });

  // ── Rediriger vers l'URL de l'école ──
  function redirectToSchool(school: SchoolSelection) {
    setIsRedirecting(true);
    // Construire l'URL de l'école
    // En production avec sous-domaines : https://{slug}.acadiahelm.com/app
    // En mode query params : https://acadiahelm.com/app?tenant={slug}
    const useSubdomain = process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS === "true";
    const baseDomain = typeof window !== "undefined"
      ? window.location.hostname.replace(/^[^.]+\./, "")
      : "academiahelm.com";

    let schoolUrl: string;
    if (useSubdomain && school.slug) {
      schoolUrl = `https://${school.slug}.${baseDomain}/app`;
    } else {
      schoolUrl = `${window.location.origin}/app?tenant=${school.slug}`;
    }

    // Petite latence pour montrer l'animation de redirection
    setTimeout(() => {
      window.location.href = schoolUrl;
    }, 800);
  }

  // ── Sélectionner une école ──
  async function handleSelectSchool(school: any) {
    const selection: SchoolSelection = {
      id: school.id,
      name: school.name,
      slug: school.slug,
      subdomain: school.subdomain,
      logoUrl: school.logoUrl,
      city: school.city,
      country: school.country,
    };
    setSelectedSchool(selection);
    // Sauvegarder dans localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));

    // Sauvegarder aussi dans le store Tauri (pour l'app desktop)
    try {
      const tauri = (window as any).__TAURI__;
      if (tauri?.store?.Store) {
        const store = await tauri.store.Store.load('academia-helm-store.json');
        await store.set('selectedSchool', { slug: selection.slug, name: selection.name });
        await store.save();
        console.log('School saved to Tauri store for offline use');
      }
    } catch (e) {
      console.log('Tauri store not available (web mode):', e);
    }

    // Rediriger
    redirectToSchool(selection);
  }

  // ── Changer d'école (oublier la sélection sauvegardée) ──
  async function handleChangeSchool() {
    localStorage.removeItem(STORAGE_KEY);

    // Supprimer aussi du store Tauri
    try {
      const tauri = (window as any).__TAURI__;
      if (tauri?.store?.Store) {
        const store = await tauri.store.Store.load('academia-helm-store.json');
        await store.delete('selectedSchool');
        await store.save();
      }
    } catch (e) {
      console.log('Tauri store not available:', e);
    }

    setSavedSchool(null);
    setSelectedSchool(null);
    setSearchQuery("");
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  // ── Affichage : redirection en cours ──
  if (isRedirecting && (savedSchool || selectedSchool)) {
    const school = savedSchool || selectedSchool;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          {school?.logoUrl ? (
            <img
              src={school.logoUrl}
              alt={school.name}
              className="w-20 h-20 rounded-2xl object-cover mx-auto mb-4 shadow-lg"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Building2 className="w-10 h-10 text-white" />
            </div>
          )}
          <h2 className="text-xl font-bold text-slate-900 mb-2">{school?.name}</h2>
          <p className="text-sm text-slate-500 mb-4">Connexion à votre école...</p>
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
        </div>
      </div>
    );
  }

  // ── Affichage : sélecteur d'école ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Logo Academia Helm */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-lg mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Academia Helm</h1>
          <p className="text-sm text-slate-500 mt-1">Application Desktop</p>
        </div>

        {/* Carte principale */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          {/* En-tête */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
            <h2 className="text-lg font-bold mb-1">Trouvez votre école</h2>
            <p className="text-sm text-blue-100">
              Recherchez l'établissement auquel vous souhaitez vous connecter.
              Votre école doit déjà avoir un compte Academia Helm.
            </p>
          </div>

          {/* Barre de recherche */}
          <div className="p-6">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nom de l'école, ville, pays..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-slate-900 placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              )}
            </div>

            {/* Liste des écoles */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-3 text-slate-500">Chargement des écoles...</span>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-500 mb-3">Erreur lors du chargement</p>
                <button
                  onClick={() => refetch()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                >
                  Réessayer
                </button>
              </div>
            ) : filteredSchools.length === 0 ? (
              <div className="text-center py-12">
                <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">
                  {searchQuery
                    ? `Aucune école trouvée pour "${searchQuery}"`
                    : "Aucune école disponible"}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredSchools.map((school: any) => (
                  <button
                    key={school.id}
                    onClick={() => handleSelectSchool(school)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all text-left group"
                  >
                    {school.logoUrl ? (
                      <img
                        src={school.logoUrl}
                        alt={school.name}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{school.name}</p>
                      {(school.city || school.country) && (
                        <p className="text-xs text-slate-500 truncate">
                          {[school.city, school.country].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pied de page */}
          <div className="border-t border-slate-100 p-4 bg-slate-50">
            <p className="text-xs text-slate-400 text-center">
              Votre école n'est pas listée ? Contactez l'administration de votre école
              pour qu'elle crée un compte Academia Helm.
            </p>
          </div>
        </div>

        {/* École sauvegardée (si déjà connecté auparavant) */}
        {savedSchool && !isRedirecting && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-900">
                  Dernière école : {savedSchool.name}
                </p>
                <p className="text-xs text-emerald-600">Connexion automatique...</p>
              </div>
            </div>
            <button
              onClick={handleChangeSchool}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1"
            >
              <Settings className="w-3 h-3" />
              Changer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DesktopPage() {
  return (
    <QueryProvider>
      <DesktopSchoolSelector />
    </QueryProvider>
  );
}
