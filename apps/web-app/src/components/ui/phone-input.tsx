'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * ============================================================================
 * PHONE INPUT — Composant de saisie de numéro de téléphone (Bénin)
 * ============================================================================
 *
 * Format standard Bénin : +229 suivi de 10 chiffres.
 * Affichage : +229 01 52 03 04 05
 *
 * Fonctionnalités :
 * - Préfixe +229 fixe (non éditable)
 * - Masque de saisie automatique (groupes de 2 chiffres)
 * - Validation visuelle (bordure verte si valide, rouge si invalide)
 * - Retourne la valeur au format '+229XXXXXXXXXX' (12 chiffres après +)
 *
 * Usage :
 * <PhoneInput
 *   value={formData.phone}
 *   onChange={(value) => setFormData(prev => ({ ...prev, phone: value }))}
 *   placeholder="01 52 03 04 05"
 * />
 * ============================================================================
 */

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  name?: string;
}

/**
 * Normalise une valeur d'entrée vers le format +229XXXXXXXXXX.
 * - Retire tout ce qui n'est pas un chiffre
 * - Si la valeur commence par 229, on le retire (double préfixe)
 * - Garde max 10 chiffres (le numéro local béninois)
 * - Retourne '+229' + 10 chiffres, ou '+229' si vide
 */
function normalizePhone(raw: string): string {
  // Retirer tout sauf les chiffres
  let digits = raw.replace(/\D/g, '');

  // Si l'utilisateur tape 229 au début, on le retire (c'est le préfixe qu'on ajoute nous-même)
  if (digits.startsWith('229')) {
    digits = digits.slice(3);
  }

  // Limiter à 10 chiffres (numéro local béninois)
  digits = digits.slice(0, 10);

  return digits;
}

/**
 * Formate les 10 chiffres en groupes de 2 pour l'affichage.
 * Ex: '0152030405' → '01 52 03 04 05'
 */
function formatDisplay(digits: string): string {
  const groups: string[] = [];
  for (let i = 0; i < digits.length; i += 2) {
    groups.push(digits.slice(i, i + 2));
  }
  return groups.join(' ');
}

/**
 * Extrait les 10 chiffres depuis une valeur stockée (qui peut être
 * '+229XXXXXXXXXX', 'XXXXXXXXXX', ou 'XX XX XX XX XX').
 */
function extractDigits(stored: string): string {
  if (!stored) return '';
  let digits = stored.replace(/\D/g, '');
  if (digits.startsWith('229')) {
    digits = digits.slice(3);
  }
  return digits.slice(0, 10);
}

export function isValidBeninPhone(value: string): boolean {
  const digits = extractDigits(value);
  return digits.length === 10;
}

export default function PhoneInput({
  value,
  onChange,
  placeholder = '01 52 03 04 05',
  className,
  required = false,
  name,
}: PhoneInputProps) {
  const [digits, setDigits] = useState(extractDigits(value));
  const [isFocused, setIsFocused] = useState(false);

  // Sync quand la valeur externe change (ex: initialData)
  useEffect(() => {
    setDigits(extractDigits(value));
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newDigits = normalizePhone(e.target.value);
    setDigits(newDigits);
    // Retourner la valeur complète au format +229XXXXXXXXXX
    onChange(newDigits ? `+229${newDigits}` : '');
  }, [onChange]);

  const displayValue = formatDisplay(digits);
  const isValid = digits.length === 10;
  const isPartial = digits.length > 0 && digits.length < 10;
  const showValidation = digits.length > 0 && !isFocused;

  return (
    <div className="relative">
      <div className={cn(
        'flex items-center bg-slate-50 border rounded-xl transition-all overflow-hidden',
        isFocused && 'ring-2 ring-blue-500 border-blue-500',
        !isFocused && showValidation && isValid && 'border-emerald-300',
        !isFocused && showValidation && isPartial && 'border-amber-300',
        !isFocused && !showValidation && 'border-slate-200',
        className,
      )}>
        {/* Préfixe fixe +229 */}
        <span className="px-3 py-2.5 text-sm font-bold text-slate-500 bg-slate-100 border-r border-slate-200 select-none whitespace-nowrap">
          🇧🇯 +229
        </span>
        {/* Champ de saisie (10 chiffres, masque XX XX XX XX XX) */}
        <input
          type="tel"
          name={name}
          value={displayValue}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          maxLength={14}  // 'XX XX XX XX XX' = 14 chars max
          required={required}
          className="flex-1 px-3 py-2.5 bg-transparent border-none outline-none text-sm font-medium text-slate-800 placeholder:text-slate-300 min-w-0"
          inputMode="numeric"
          autoComplete="tel-national"
        />
        {/* Icône de validation */}
        {showValidation && isValid && (
          <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-3 shrink-0" />
        )}
        {showValidation && isPartial && (
          <span className="text-[10px] text-amber-500 font-bold mr-3 shrink-0 whitespace-nowrap">
            {digits.length}/10
          </span>
        )}
      </div>
      {/* Message d'aide */}
      {isPartial && isFocused && (
        <p className="text-[10px] text-amber-500 mt-1 ml-1 font-medium">
          {10 - digits.length} chiffre(s) restant(s) — format: 10 chiffres après +229
        </p>
      )}
    </div>
  );
}
