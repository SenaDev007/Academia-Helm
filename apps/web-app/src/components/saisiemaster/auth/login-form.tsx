"use client";

/**
 * SaisieMaster — Login form
 *
 * Email + password (required). Calls POST /api/saisiemaster/login via the
 * lib client. Shows an error message if the login fails.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, LogIn } from "lucide-react";
import { login, type Prospect, ApiError } from "@/lib/saisiemaster/api";

interface LoginFormProps {
  onSuccess: (prospect: Prospect, token: string) => void;
  onSwitchToSignup: () => void;
}

export function LoginForm({ onSuccess, onSwitchToSignup }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Veuillez saisir votre email.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Adresse email invalide.");
      return;
    }

    if (!password) {
      setError("Veuillez saisir votre mot de passe.");
      return;
    }

    setLoading(true);
    try {
      const result = await login({
        email: email.trim().toLowerCase(),
        password,
      });
      onSuccess(result.prospect, result.token);
    } catch (err) {
      if (err instanceof ApiError) {
        // Friendlier message for 404 (no account found)
        if (err.status === 404) {
          setError(
            "Aucun compte trouvé avec cet email. Inscrivez-vous gratuitement pour commencer.",
          );
        } else if (err.status === 401) {
          setError(
            "Email ou mot de passe incorrect. Vérifiez vos identifiants.",
          );
        } else {
          setError(err.message);
        }
      } else {
        setError(
          err instanceof Error ? err.message : "Échec de la connexion. Réessayez.",
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
              <LogIn className="h-4 w-4" />
            </span>
            <h2 className="text-xl font-bold text-foreground">
              Se connecter
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Saisissez votre email et votre mot de passe pour retrouver vos
            saisies enregistrées.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="sm-login-email">Email</Label>
            <Input
              id="sm-login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="directeur@monecole.bj"
              autoComplete="email"
              autoFocus
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="sm-login-password">Mot de passe</Label>
            <Input
              id="sm-login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={loading}
              required
            />
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
                Connexion…
              </>
            ) : (
              "Se connecter"
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Pas encore de compte ?{" "}
            <button
              type="button"
              onClick={onSwitchToSignup}
              className="font-medium text-[#008751] hover:underline"
              disabled={loading}
            >
              Créer un compte gratuit
            </button>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
