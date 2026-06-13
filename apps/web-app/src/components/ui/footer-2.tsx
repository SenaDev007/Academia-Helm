"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Mail,
  Phone,
  MapPin,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PlayStoreButton } from "@/components/ui/play-store-button";
import { AppStoreButton } from "@/components/ui/app-store-button";
import { TextHoverEffect, FooterBackgroundGradient } from "@/components/ui/hover-footer";
import { cn } from "@/lib/utils";

/**
 * Footer Premium Academia Helm
 * 
 * Fusion de footer-2 (structure grille, social, app stores) et hover-footer
 * (section contact, effet TextHoverEffect lumineux, fond gradient).
 * 
 * Palette : Navy #0b2f73, Blue #1d4fa5, Gold #f5b335
 */

// --- Liens du footer personnalisés pour Academia Helm ---
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

// --- Réseaux sociaux ---
const socialLinks = [
  { icon: Facebook, href: "https://facebook.com/academiahub", label: "Facebook" },
  { icon: Instagram, href: "https://instagram.com/academiahub", label: "Instagram" },
  { icon: Linkedin, href: "https://linkedin.com/company/academiahub", label: "LinkedIn" },
  { icon: Twitter, href: "https://twitter.com/academiahub", label: "X (Twitter)" },
];

// --- Informations de contact (du prompt 2, personnalisées) ---
const contactInfo = [
  {
    icon: <Mail size={18} className="text-[#f5b335]" />,
    text: "support@academiahelm.com",
    href: "mailto:support@academiahelm.com",
  },
  {
    icon: <Phone size={18} className="text-[#f5b335]" />,
    text: "+229 97 00 00 00",
    href: "tel:+22997000000",
  },
  {
    icon: <MapPin size={18} className="text-[#f5b335]" />,
    text: "Cotonou, Bénin — Afrique de l'Ouest",
  },
];

export function Footer2() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden bg-[#0b2f73] border-t border-[#144798]">
      {/* Fond gradient Helm */}
      <FooterBackgroundGradient />

      <div className="max-w-6xl mx-auto px-4 lg:px-6 relative z-10">
        {/* Section Contact — inspirée du prompt 2 */}
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

        {/* Grille de liens — structure du prompt 1 */}
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
          <div className="flex gap-2 items-center">
            {socialLinks.map(({ icon: Icon, href, label }, i) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className={cn(
                  buttonVariants({ variant: "outline", size: "icon" }),
                  "border-white/20 hover:border-[#f5b335]/50 hover:bg-[#f5b335]/10 text-white/60 hover:text-[#f5b335]",
                )}
                key={i}
              >
                <Icon className="size-5" />
              </a>
            ))}
          </div>

          <div className="flex gap-3">
            <a href="#" aria-label="Télécharger sur l'App Store">
              <AppStoreButton />
            </a>
            <a href="#" aria-label="Disponible sur Google Play">
              <PlayStoreButton />
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

      {/* Effet TextHoverEffect — filigrane lumineux "ACADEMIA HELM" */}
      <div className="hidden lg:block h-[20rem] -mt-40 -mb-24 relative">
        <TextHoverEffect text="ACADEMIA HELM" className="z-50 opacity-30" />
      </div>
    </footer>
  );
}
