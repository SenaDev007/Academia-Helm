"use client";

/**
 * SaisieMaster — Signup form
 *
 * Email + name + school name + password (min 6 chars).
 * On submit, calls POST /api/saisiemaster/signup via the lib client.
 *
 * On success: calls onSuccess(prospect, token). The store wrapper will
 * store the auth in localStorage + Zustand.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Sparkles } from "lucide-react";
import { signup, type Prospect, ApiError } from "@/lib/saisiemaster/api";

interface SignupFormProps {
  onSuccess: (prospect: Prospect, token: string) => void;
  onSwitchToLogin: () => void;
  /** Optional default email (e.g. if user typed it in the login form first). */
  defaultEmail?: string;
}

export function SignupForm({
  onSuccess,
  onSwitchToLogin,
  defaultEmail = "",
}: SignupFormProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !firstName.trim() || !lastName.trim() || !schoolName.trim()) {
      setError("Veuillez remplir tous les champs obligatoires (*).");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Adresse email invalide.");
      return;
    }

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const result = await signup({
        email: email.trim().toLowerCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        schoolName: schoolName.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
        city: city.trim() || undefined,
        password,
      });
      onSuccess(result.prospect, result.token);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Échec de l'inscription. Réessayez.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full border-2 border-[#008751]/20 shadow-lg">
      <CardContent className="p-6 sm:p-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#008751]/10 text-[#008751]">
              <Sparkles className="h-4 w-4" />
            </span>
            <h2 className="text-xl font-bold text-foreground">
              Créer mon compte gratuit
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Gratuit, sans carte bancaire. Créez votre compte avec un mot de
            passe pour retrouver vos saisies d&apos;une visite à l&apos;autre.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="sm-firstName">
                Prénom <span className="text-[#e31b23]">*</span>
              </Label>
              <Input
                id="sm-firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jean"
                autoComplete="given-name"
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sm-lastName">
                Nom <span className="text-[#e31b23]">*</span>
              </Label>
              <Input
                id="sm-lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Houngbedji"
                autoComplete="family-name"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="sm-schoolName">
              École <span className="text-[#e31b23]">*</span>
            </Label>
            <Input
              id="sm-schoolName"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="École La Persévérance"
              autoComplete="organization"
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="sm-email">
              Email <span className="text-[#e31b23]">*</span>
            </Label>
            <Input
              id="sm-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="directeur@monecole.bj"
              autoComplete="email"
              disabled={loading}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="sm-password">
                Mot de passe <span className="text-[#e31b23]">*</span>
              </Label>
              <Input
                id="sm-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={loading}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sm-confirmPassword">
                Confirmer le mot de passe <span className="text-[#e31b23]">*</span>
              </Label>
              <Input
                id="sm-confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={loading}
                required
                minLength={6}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Minimum 6 caractères. Votre mot de passe est hashé (bcrypt) et
            jamais transmis en clair.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="sm-phone">Téléphone (optionnel)</Label>
              <Input
                id="sm-phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+229 01 97 00 00 00"
                autoComplete="tel"
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sm-city">Ville (optionnel)</Label>
              <Input
                id="sm-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Cotonou"
                autoComplete="address-level2"
                disabled={loading}
              />
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-[#e31b23]/30 bg-[#fde7e7] px-4 py-3 text-sm text-[#e31b23]"
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-[#008751] hover:bg-[#008751]/90 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Création du compte…
              </>
            ) : (
              "Commencer gratuitement"
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Déjà un compte ?{" "}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="font-medium text-[#008751] hover:underline"
              disabled={loading}
            >
              Se connecter
            </button>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
