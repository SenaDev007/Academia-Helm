"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import { AppStoreButton } from "@/components/ui/app-store-button";
import { PlayStoreButton } from "@/components/ui/play-store-button";
import { TextHoverEffect, FooterBackgroundGradient } from "@/components/ui/hover-footer";
import { cn } from "@/lib/utils";

/**
 * Footer Premium Academia Helm
 * 
 * Palette : Navy #0b2f73, Blue #1d4fa5, Gold #f5b335
 * Icônes sociales avec couleurs officielles des marques
 */

// --- Liens du footer ---
const footerLinks = [
  {
    title: "Produit",
    links: [
      { href: "/modules", label: "Fonctionnalités" },
      { href: "/orion", label: "ORION (IA)" },
      { href: "/#tarification", label: "Tarification" },
      { href: "/#offline", label: "Mode offline" },
      { href: "/blog", label: "Blog & Ressources" },
      { href: "/jobs", label: "Recrutement" },
    ],
  },
  {
    title: "Communauté",
    links: [
      { href: "/federis", label: "Academia Federis" },
      { href: "/avis", label: "Témoignages" },
      { href: "/contact", label: "Nous contacter" },
      { href: "#", label: "Partenaires" },
      { href: "#", label: "Programme éducatif" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "#", label: "Centre d'aide" },
      { href: "#", label: "Guide de démarrage" },
      { href: "#", label: "Documentation API" },
      { href: "#", label: "FAQ" },
      { href: "#", label: "Signaler un problème" },
    ],
  },
  {
    title: "Légal",
    links: [
      { href: "/legal/cgu", label: "Conditions générales" },
      { href: "/legal/privacy", label: "Politique de confidentialité" },
      { href: "/legal/mentions", label: "Mentions légales" },
      { href: "/legal/cgv", label: "CGV" },
      { href: "#", label: "Préférences cookies" },
    ],
  },
];

// --- Icônes SVG sociales avec couleurs officielles ---
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073c0 6.025 4.388 11.02 10.125 11.927V15.56H7.078v-3.487h3.047V9.414c0-3.007 1.792-4.669 4.533-4.669 1.313 0 2.686.236 2.686.236v2.953h-1.514c-1.491 0-1.956.93-1.956 1.885v2.254h3.328l-.532 3.487h-2.796V24C19.612 23.093 24 18.098 24 12.073z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M20.447 20.452H16.89v-5.569c0-1.328-.025-3.037-1.851-3.037-1.854 0-2.136 1.446-2.136 2.939v5.667H9.346V9h3.415v1.561h.049c.476-.9 1.637-1.85 3.37-1.85 3.603 0 4.268 2.372 4.268 5.455v6.286zM5.337 7.433a2.063 2.063 0 1 1 0-4.126 2.063 2.063 0 0 1 0 4.126zM7.119 20.452H3.553V9H7.12v11.452z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2H21l-6.56 7.496L22.15 22H16.11l-4.73-6.186L5.97 22H3.21l7.014-8.013L1.85 2h6.194l4.274 5.648L18.244 2zm-.967 18.35h1.53L7.206 3.565H5.564L17.277 20.35z" />
    </svg>
  );
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M23.498 6.186a2.997 2.997 0 0 0-2.11-2.12C19.503 3.5 12 3.5 12 3.5s-7.504 0-9.388.565a2.997 2.997 0 0 0-2.11 2.12A31.21 31.21 0 0 0 0 12a31.21 31.21 0 0 0 .502 5.814 2.997 2.997 0 0 0 2.11 2.12C4.496 20.5 12 20.5 12 20.5s7.503 0 9.388-.565a2.997 2.997 0 0 0 2.11-2.12A31.21 31.21 0 0 0 24 12a31.21 31.21 0 0 0-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

// --- Réseaux sociaux avec couleurs officielles ---
const socialLinks = [
  {
    icon: FacebookIcon,
    href: "https://facebook.com/academiahub",
    label: "Facebook",
    bgColor: "#1877F2",
  },
  {
    icon: LinkedInIcon,
    href: "https://linkedin.com/company/academiahub",
    label: "LinkedIn",
    bgColor: "#0A66C2",
  },
  {
    icon: XIcon,
    href: "https://twitter.com/academiahub",
    label: "X (Twitter)",
    bgColor: "#000000",
  },
  {
    icon: YouTubeIcon,
    href: "https://youtube.com/@academiahub",
    label: "YouTube",
    bgColor: "#FF0000",
  },
];

// --- Informations de contact ---
const contactInfo = [
  {
    icon: <Mail size={18} className="text-[#f5b335]" />,
    text: "support@academiahelm.com",
    href: "mailto:support@academiahelm.com",
  },
  {
    icon: <Phone size={18} className="text-[#f5b335]" />,
    text: "+229 01 41 36 08 03",
    href: "tel:+2290141360803",
  },
  {
    icon: <MapPin size={18} className="text-[#f5b335]" />,
    text: "Parakou, Bénin — Afrique de l'Ouest",
  },
];

export function Footer2() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden bg-[#0b2f73] border-t border-[#144798]">
      {/* Fond gradient Helm */}
      <FooterBackgroundGradient />

      <div className="max-w-6xl mx-auto px-4 lg:px-6 relative z-10">
        {/* Section Contact */}
        <div className="pt-8 pb-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 p-5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="flex-shrink-0">
              <h4 className="text-white text-lg font-semibold mb-1">Contactez-nous</h4>
              <p className="text-white/50 text-sm">Notre équipe est à votre écoute</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 flex-1">
              {contactInfo.map((item, i) => (
                <div key={i} className="flex items-center space-x-3">
                  {item.icon}
                  {item.href ? (
                    <a
                      href={item.href}
                      className="text-white/80 hover:text-[#f5b335] transition-colors text-sm"
                    >
                      {item.text}
                    </a>
                  ) : (
                    <span className="text-white/80 text-sm">
                      {item.text}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Grille de liens */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-8">
          {footerLinks.map((item, i) => (
            <div key={i}>
              <h3 className="mb-4 text-xs uppercase tracking-wider text-[#f5b335] font-semibold">
                {item.title}
              </h3>
              <ul className="space-y-2 text-white/60 text-sm">
                {item.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      prefetch={true}
                      className="hover:text-white hover:translate-x-1 transition-all duration-200 inline-block"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Séparateur */}
        <div className="h-px bg-gradient-to-r from-transparent via-[#f5b335]/30 to-transparent" />

        {/* Section Social + App Stores */}
        <div className="py-5 flex flex-wrap items-center justify-between gap-4">
          {/* Icônes sociales avec couleurs officielles */}
          <div className="flex gap-2 items-center">
            {socialLinks.map(({ icon: Icon, href, label, bgColor }, i) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                key={i}
                className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center",
                  "transition-all duration-200 hover:scale-110 hover:shadow-lg",
                  "group relative overflow-hidden",
                )}
                style={{ backgroundColor: bgColor }}
              >
                <span className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.3),transparent_55%)]" />
                <Icon className="size-4 text-white" />
              </a>
            ))}
          </div>

          {/* Boutons Google Play & App Store */}
          <div className="flex gap-3">
            <a href="#" aria-label="Disponible sur Google Play">
              <PlayStoreButton />
            </a>
            <a href="#" aria-label="Télécharger sur l'App Store">
              <AppStoreButton />
            </a>
          </div>
        </div>

        {/* Séparateur */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Copyright + badges */}
        <div className="py-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Image
              src="/images/logo-Academia Hub.png"
              alt="Academia Helm"
              width={28}
              height={28}
              className="h-7 w-auto"
              loading="lazy"
              sizes="28px"
            />
            <p className="text-xs text-white/50">
              © {currentYear} Academia Helm. Tous droits réservés.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-white/40">
            <span>Conforme RGPD</span>
            <span className="w-1 h-1 bg-white/30 rounded-full" />
            <span>Standards internationaux</span>
            <span className="w-1 h-1 bg-white/30 rounded-full" />
            <span>Service certifié</span>
          </div>

          {/* Badge service actif */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-white/70">Service opérationnel</span>
          </div>
        </div>
      </div>

      {/* TextHoverEffect — filigrane lumineux "ACADEMIA HELM" */}
      <div className="hidden lg:block h-[18rem] -mt-36 -mb-20 relative">
        <TextHoverEffect text="ACADEMIA HELM" className="z-50 opacity-30" />
      </div>
    </footer>
  );
}
