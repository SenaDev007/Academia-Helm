'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    $crisp: any[];
    CRISP_WEBSITE_ID: string;
  }
}

export function CrispChat() {
  useEffect(() => {
    const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;
    
    if (!websiteId) {
      console.warn('Crisp Chat: NEXT_PUBLIC_CRISP_WEBSITE_ID is not defined.');
      return;
    }

    // Configurer Crisp
    window.$crisp = [];
    window.CRISP_WEBSITE_ID = websiteId;

    // Injecter le script dynamiquement
    (function() {
      const d = document;
      const s = d.createElement('script');
      s.src = 'https://client.crisp.chat/l.js';
      s.async = true;
      d.getElementsByTagName('head')[0].appendChild(s);
    })();
  }, []);

  return null;
}
