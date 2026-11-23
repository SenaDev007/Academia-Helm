"use client";

/**
 * ⭐ 2026-11-23 — EN-TÊTE D'IDENTITÉ ÉCOLE COMPLET (module Examen).
 *
 * Exige promoteur : « Juste avant la section du tableau, la section où figurent
 * les informations de l'école — TOUTES les informations de l'école doivent
 * figurer. Par exemple les adresses mail et les contacts de l'école sont bien
 * mentionnés dans le module Paramètres → onglet Identité, pourtant tout
 * n'apparaît pas. »
 *
 * Ce composant affiche l'identité COMPLÈTE telle que définie dans Paramètres →
 * Identité : logo, nom, sigle, slogan (devise), localisation (adresse · ville ·
 * département · pays) et contacts (téléphones, WhatsApp, email, site web).
 *
 * Il reçoit l'identité DÉJÀ résolue par niveau : maternelle/primaire → profil
 * global (identité par défaut) ; secondaire → profil « Identité école
 * secondaire » fusionné (voir useSchoolIdentityForLevel).
 *
 * Utilisé par l'onglet Bulletins (en-tête du bulletin de chaque élève) et
 * l'onglet Registre des notes (section identité avant le tableau).
 */

import type { SchoolIdentity } from "@/hooks/useSchoolIdentity";
import { cn } from "@/lib/utils";

export function SchoolIdentityHeader({
  school,
  lang = "FR",
  className,
}: {
  school: SchoolIdentity | null | undefined;
  lang?: "FR" | "EN";
  className?: string;
}) {
  const isEn = lang === "EN";
  if (!school) return null;

  const location = [
    school.address,
    school.city,
    school.department,
    school.country,
  ].filter(Boolean).join(", ");

  const phones = [school.phonePrimary || school.phone, school.phoneSecondary]
    .filter(Boolean)
    .join(" · ");
  const contacts: string[] = [];
  if (phones) contacts.push(`${isEn ? "Tel" : "Tél"} : ${phones}`);
  if (school.whatsapp) contacts.push(`WhatsApp : ${school.whatsapp}`);
  if (school.email) contacts.push(`Email : ${school.email}`);
  if (school.website) contacts.push(`${isEn ? "Web" : "Site"} : ${school.website}`);

  return (
    <div className={cn("bg-slate-50 rounded-lg p-3 text-center border border-slate-200", className)}>
      <div className="flex items-center justify-center gap-3 mb-1">
        {school.logoUrl && (
          <img src={school.logoUrl} alt="logo" className="h-12 w-12 rounded object-cover border border-slate-200 bg-white" />
        )}
        <div className="text-left">
          <h3 className="text-xs font-bold text-slate-900 leading-tight">
            {school.schoolName || (isEn ? "School" : "École")}
            {school.schoolAcronym ? ` (${school.schoolAcronym})` : ""}
          </h3>
          {school.slogan && (
            <p className="text-[10px] italic text-slate-500 leading-tight">{school.slogan}</p>
          )}
        </div>
      </div>
      {location && <p className="text-[10px] text-slate-500 leading-snug">{location}</p>}
      {contacts.length > 0 && (
        <p className="text-[10px] text-slate-600 leading-snug mt-0.5">{contacts.join("   ·   ")}</p>
      )}
    </div>
  );
}
