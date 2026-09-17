'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    $crisp: any[];
    CRISP_WEBSITE_ID: string;
  }
}

/**
 * CrispChat — widget de support tiers.
 *
 * ⭐ PERFORMANCE (chantier GTMetrix — spéc. §4 « report des scripts tiers non
 *    indispensables au premier rendu ») :
 * - AVANT : le script https://client.crisp.chat/l.js était injecté
 *   immédiatement au montage de CHAQUE page /app/* → requête DNS+TLS+JS
 *   tierce pendant la fenêtre LCP, et évaluation du widget sur le main
 *   thread (TBT) alors que personne ne l'utilise.
 * - APRÈS : l'injection est différée à requestIdleCallback (filet de secours
 *   4 s) — après le rendu initial et la navigation réactive. Le chat reste
 *   disponible quelques secondes après l'arrivée sur la page, ce qui est
 *   invisible pour l'usage réel (personne n'ouvre le chat dans les 4
 *   premières secondes).
 * - Le composant lui-même est aussi chargé en dynamic() depuis
 *   layout-client.tsx (hors chunk initial).
 */
export function CrispChat() {
  useEffect(() => {
    const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;

    if (!websiteId) {
      // Silencieux en production (ID non configuré = widget absent, normal)
      return;
    }

    const injectCrisp = () => {
      if (document.getElementById('crisp-loader-script')) return;
      // Configurer Crisp
      window.$crisp = [];
      window.CRISP_WEBSITE_ID = websiteId;

      // Injecter le script dynamiquement
      (function () {
        const d = document;
        const s = d.createElement('script');
        s.id = 'crisp-loader-script';
        s.src = 'https://client.crisp.chat/l.js';
        s.async = true;
        d.getElementsByTagName('head')[0].appendChild(s);
      })();
    };

    // ⭐ Différer à l'idle : le thread principal reste libre pour le rendu
    //    initial (LCP/TBT). Fallback timeout 4 s si l'idle ne vient pas.
    const ric = (window as Window & typeof globalThis).requestIdleCallback;
    let handle: number | ReturnType<typeof setTimeout>;
    if (typeof ric === 'function') {
      handle = ric(injectCrisp, { timeout: 4000 });
    } else {
      handle = setTimeout(injectCrisp, 4000);
    }

    return () => {
      if (typeof handle === 'number' && typeof (window as Window & typeof globalThis).cancelIdleCallback === 'function') {
        (window as Window & typeof globalThis).cancelIdleCallback!(handle);
      } else if (handle !== undefined) {
        clearTimeout(handle as ReturnType<typeof setTimeout>);
      }
    };
  }, []);

  return null;
}
