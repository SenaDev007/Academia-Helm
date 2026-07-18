"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Settings as SettingsIcon,
  User,
  Mail,
  Phone,
  MapPin,
  School,
  LogOut,
  Save,
  Loader2,
  Info,
  ShieldCheck,
} from "lucide-react";
import {
  getProfile,
  updateProfile,
  type ProspectProfile,
  type UpdateProfilePayload,
} from "@/lib/saisiemaster/api";
import { useSaisieMasterStore } from "@/lib/saisiemaster/store";
import { BRAND } from "@/lib/saisiemaster/constants";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Vue "Paramètres" :
 *  - Charge le profil depuis le backend.
 *  - Formulaire d'édition (firstName, lastName, schoolName, phone, city).
 *    L'email est en lecture seule (clé de login).
 *  - Bouton "Enregistrer" → PUT /api/saisiemaster/profile.
 *  - Bouton "Se déconnecter" (avec confirmation).
 *  - Carte "À propos" avec version + infos utiles.
 */
export function SettingsView() {
  const [profile, setProfile] = useState<ProspectProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<UpdateProfilePayload>({});
  const [saving, setSaving] = useState(false);

  const updateProspect = useSaisieMasterStore((s) => s.updateProspect);
  const logout = useSaisieMasterStore((s) => s.logout);
  const setView = useSaisieMasterStore((s) => s.setView);
  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const p = await getProfile();
        if (cancelled) return;
        setProfile(p);
        setForm({
          firstName: p.firstName,
          lastName: p.lastName,
          schoolName: p.schoolName,
          phoneNumber: p.phoneNumber ?? "",
          city: p.city ?? "",
        });
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Impossible de charger le profil.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateProfile(form);
      updateProspect(updated);
      setProfile((prev) =>
        prev ? { ...prev, ...updated } : prev,
      );
      toast.success("Profil mis à jour avec succès");
    } catch (e) {
      console.error(e);
      toast.error("Échec de la mise à jour du profil", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    setView("landing");
    setLogoutOpen(false);
    toast.success("Vous êtes déconnecté");
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-[#0D6EFD]" />
          Paramètres
        </h2>
        <Card className="p-8 flex flex-col items-center justify-center gap-3 border-dashed">
          <Loader2 className="h-6 w-6 animate-spin text-[#0D6EFD]" />
          <p className="text-sm text-muted-foreground">Chargement…</p>
        </Card>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-[#0D6EFD]" />
          Paramètres
        </h2>
        <Card className="p-6 border-[#DC3545]/30 bg-[#DC3545]/5">
          <p className="text-sm text-[#DC3545] font-medium mb-1">
            Impossible de charger votre profil
          </p>
          <p className="text-xs text-muted-foreground">
            {error ?? "Veuillez vous reconnecter puis réessayer."}
          </p>
        </Card>
      </div>
    );
  }

  const hasChanges =
    form.firstName !== profile.firstName ||
    form.lastName !== profile.lastName ||
    form.schoolName !== profile.schoolName ||
    (form.phoneNumber ?? "") !== (profile.phoneNumber ?? "") ||
    (form.city ?? "") !== (profile.city ?? "");

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-[#0D6EFD]" />
          Paramètres
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gérez votre profil et vos préférences.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Profile form (2/3) */}
        <Card className="lg:col-span-2 p-4 sm:p-6 border-border/60 shadow-sm bg-white dark:bg-zinc-950 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <User className="h-4 w-4 text-[#0D6EFD]" />
            <h3 className="text-sm font-semibold text-foreground">
              Informations personnelles
            </h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Prénom" icon={User}>
              <Input
                value={form.firstName ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, firstName: e.target.value }))
                }
                placeholder="Prénom"
                className="h-9"
              />
            </Field>
            <Field label="Nom" icon={User}>
              <Input
                value={form.lastName ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, lastName: e.target.value }))
                }
                placeholder="Nom"
                className="h-9"
              />
            </Field>
            <Field label="École" icon={School} className="sm:col-span-2">
              <Input
                value={form.schoolName ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, schoolName: e.target.value }))
                }
                placeholder="Nom de l'établissement"
                className="h-9"
              />
            </Field>
            <Field label="Email (non modifiable)" icon={Mail}>
              <Input
                value={profile.email}
                disabled
                readOnly
                className="h-9 bg-muted/50 text-muted-foreground"
              />
            </Field>
            <Field label="Téléphone" icon={Phone}>
              <Input
                value={form.phoneNumber ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phoneNumber: e.target.value }))
                }
                placeholder="Ex: +229 01 97 00 00 00"
                className="h-9"
              />
            </Field>
            <Field label="Ville" icon={MapPin} className="sm:col-span-2">
              <Input
                value={form.city ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, city: e.target.value }))
                }
                placeholder="Ex: Cotonou, Porto-Novo, Parakou…"
                className="h-9"
              />
            </Field>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/40">
            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
              <Info className="h-3.5 w-3.5" />
              L&apos;email est votre identifiant de connexion et ne peut pas être
              modifié.
            </p>
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="bg-[#008751] hover:bg-[#008751]/90 text-white shrink-0"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Enregistrer
            </Button>
          </div>
        </Card>

        {/* Right column: account summary + about */}
        <div className="space-y-4">
          {/* Account summary */}
          <Card className="p-4 sm:p-5 border-border/60 shadow-sm bg-white dark:bg-zinc-950 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#008751]" />
              <h3 className="text-sm font-semibold text-foreground">Compte</h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="grid place-items-center h-12 w-12 rounded-full bg-[#0D6EFD]/10 text-[#0D6EFD] text-base font-bold shrink-0">
                {profile.firstName.charAt(0).toUpperCase()}
                {profile.lastName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">
                  {profile.firstName} {profile.lastName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {profile.email}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40">
              <MiniStat label="Classes" value={profile.classesCreated} />
              <MiniStat label="Notes" value={profile.gradesEntered} />
              <MiniStat label="Exports" value={profile.exportsCount} />
            </div>
            <Button
              variant="outline"
              onClick={() => setLogoutOpen(true)}
              className="w-full text-[#DC3545] hover:bg-[#DC3545]/5 hover:text-[#DC3545] border-[#DC3545]/30"
            >
              <LogOut className="h-4 w-4" />
              Se déconnecter
            </Button>
          </Card>

          {/* About */}
          <Card className="p-4 sm:p-5 border-border/60 shadow-sm bg-white dark:bg-zinc-950 space-y-2">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-[#0D6EFD]" />
              <h3 className="text-sm font-semibold text-foreground">
                À propos
              </h3>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Application</span>
                <span className="font-medium text-foreground">{BRAND.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Version</span>
                <span className="font-medium text-foreground">
                  {BRAND.version}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Inscrit depuis</span>
                <span className="font-medium text-foreground">
                  {formatDate(profile.signupDate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Dernière connexion</span>
                <span className="font-medium text-foreground">
                  {formatDate(profile.lastLoginAt)}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/40">
              {BRAND.description}
            </p>
          </Card>
        </div>
      </div>

      {/* Logout confirm */}
      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Se déconnecter ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous serez déconnecté de votre compte SaisieMaster. Vos saisies
              restent sauvegardées sur votre compte et pourront être reprises
              à la prochaine connexion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="bg-[#DC3545] hover:bg-[#DC3545]/90 text-white"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Se déconnecter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function Field({
  label,
  icon: Icon,
  children,
  className,
}: {
  label: string;
  icon: typeof User;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground inline-flex items-center gap-1.5 mb-1.5">
        <Icon className="h-3 w-3" />
        {label}
      </Label>
      {children}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-sm font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}
