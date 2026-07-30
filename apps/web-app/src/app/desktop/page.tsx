"use client";

/**
 * ============================================================================
 * DESKTOP APP LANDING — Sélecteur d'école pour l'app desktop Tauri
 * ============================================================================
 *
 * Version optimisée :
 *   - Vrai logo Academia Helm (logo-Academia Hub.png)
 *   - Couleurs AH (navy #0B2F73, gold #F5B335)
 *   - Chargement rapide : fetch direct sans logos base64
 *   - Recherche instantanée côté client
 * ============================================================================
 */

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Search, Loader2, Building2, ChevronRight, X, CheckCircle2,
  Settings,
} from "lucide-react";
import Image from "next/image";
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
        redirectToSchool(school);
      }
    } catch {
      // localStorage corrompu — on continue avec le sélecteur
    }
  }, []);

  // Focus sur le champ de recherche au chargement
  useEffect(() => {
    if (!savedSchool && !isRedirecting) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [savedSchool, isRedirecting]);

  // ── Filtrer les écoles (recherche instantanée côté client) ──
  const filteredSchools = useMemo(() => {
    if (!allSchools) return [];
    if (!searchQuery.trim()) return allSchools;
    const q = searchQuery.toLowerCase();
    return allSchools.filter((s: any) =>
      s.name?.toLowerCase().includes(q) ||
      s.city?.toLowerCase().includes(q) ||
      s.country?.toLowerCase().includes(q)
    );
  }, [allSchools, searchQuery]);

  // ── Rediriger vers l'URL de l'école ──
  function redirectToSchool(school: SchoolSelection) {
    setIsRedirecting(true);
    const schoolUrl = `${window.location.origin}/app?tenant=${school.slug}`;
    setTimeout(() => {
      window.location.href = schoolUrl;
    }, 500);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));

    // Sauvegarder aussi dans le store Tauri (pour l'app desktop)
    try {
      const tauri = (window as any).__TAURI__;
      if (tauri?.store?.Store) {
        const store = await tauri.store.Store.load('academia-helm-store.json');
        await store.set('selectedSchool', { slug: selection.slug, name: selection.name });
        await store.save();
      }
    } catch (e) {
      console.log('Tauri store not available:', e);
    }

    redirectToSchool(selection);
  }

  // ── Changer d'école ──
  async function handleChangeSchool() {
    localStorage.removeItem(STORAGE_KEY);
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
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, #071D4A 0%, ${NAVY} 50%, #1A3F8B 100%)` }}
      >
        <div className="text-center text-white">
          <Image
            src="/images/logo-Academia Hub.png"
            alt="Academia Helm"
            width={80}
            height={80}
            className="rounded-2xl mx-auto mb-4 shadow-lg"
          />
          <h2 className="text-xl font-bold mb-2">{school?.name}</h2>
          <p className="text-sm opacity-70 mb-4">Connexion à votre école...</p>
          <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{ color: GOLD }} />
        </div>
      </div>
    );
  }

  // ── Affichage : sélecteur d'école ──
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: `linear-gradient(135deg, #071D4A 0%, ${NAVY} 50%, #1A3F8B 100%)` }}
    >
      <div className="w-full max-w-2xl">
        {/* Logo Academia Helm */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-lg mb-4 p-2">
            <Image
              src="/images/logo-Academia Hub.png"
              alt="Academia Helm"
              width={56}
              height={56}
              className="rounded-lg"
              priority
            />
          </div>
          <h1 className="text-3xl font-bold text-white">Academia Helm</h1>
          <p className="text-sm mt-1" style={{ color: GOLD }}>Plateforme de pilotage éducatif</p>
        </div>

        {/* Carte principale */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* En-tête */}
          <div
            className="p-6 text-white"
            style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 100%)` }}
          >
            <h2 className="text-lg font-bold mb-1">Trouvez votre école</h2>
            <p className="text-sm opacity-90">
              Recherchez l'établissement auquel vous souhaitez vous connecter.
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
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: NAVY }} />
                <span className="ml-3 text-slate-500">Chargement des écoles...</span>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-500 mb-3">Erreur lors du chargement</p>
                <button
                  onClick={() => refetch()}
                  className="px-4 py-2 text-white rounded-lg text-sm font-semibold"
                  style={{ background: NAVY }}
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
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-white"
                      style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 100%)` }}
                    >
                      <Building2 className="w-5 h-5" />
                    </div>
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
              Votre école n'est pas listée ? Contactez l'administration pour créer un compte.
            </p>
          </div>
        </div>

        {/* École sauvegardée */}
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

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-white/40">
          © 2026 YEHI OR Tech — Academia Helm
        </div>
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
