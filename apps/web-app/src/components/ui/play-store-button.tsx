"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * Bouton "Get it on Google Play" — style officiel Google
 * Fond noir, texte blanc, logo Play coloré
 */
export function PlayStoreButton({
  className,
  ...props
}: Omit<React.ComponentProps<"a">, "children">) {
  return (
    <a
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-lg bg-black px-4",
        "hover:bg-gray-900 transition-colors duration-200",
        "border border-white/10",
        className,
      )}
      {...props}
    >
      <PlayStoreIcon className="size-5" />
      <div className="text-left flex flex-col items-start justify-center pr-2">
        <span className="text-[10px] leading-none font-light tracking-tight text-white/70">
          DISPONIBLE SUR
        </span>
        <p className="text-sm font-semibold leading-none text-white">Google Play</p>
      </div>
    </a>
  );
}

function PlayStoreIcon({ ...props }: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      {/* Logo Google Play avec les couleurs officielles */}
      <path d="m3.609 1.814 13.126 7.39-2.647 2.647L3.609 1.814z" fill="#4285F4" />
      <path d="m20.391 12-3.656-2.796-2.933 2.933 2.933 2.933L20.391 12z" fill="#FBBC04" />
      <path d="M3.609 22.186l9.879-9.879-2.647-2.647-7.232 12.526z" fill="#EA4335" />
      <path d="m3.609 22.186 7.232-12.526L3.609 1.814v20.372z" fill="#34A853" />
    </svg>
  );
}
