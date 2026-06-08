'use client';

import { useEffect, useMemo, useState } from 'react';

interface ShareButtonsProps {
  url: string;
  title: string;
}

function IconFacebook(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={props.className} fill="currentColor">
      <path d="M22 12.06C22 6.51 17.52 2 12 2S2 6.51 2 12.06c0 5 3.66 9.14 8.44 9.94v-7.03H7.9V12.06h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.44 2.91h-2.34V22c4.78-.8 8.44-4.94 8.44-9.94Z" />
    </svg>
  );
}

function IconLinkedIn(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={props.className} fill="currentColor">
      <path d="M20.45 20.45h-3.55v-5.56c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.95v5.65H9.37V9h3.4v1.56h.05c.47-.9 1.62-1.85 3.34-1.85 3.57 0 4.23 2.35 4.23 5.41v6.33ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
    </svg>
  );
}

function IconWhatsApp(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={props.className} fill="currentColor">
      <path d="M12.04 2C6.54 2 2.07 6.47 2.07 11.97c0 1.94.56 3.83 1.62 5.46L2 22l4.71-1.65a9.9 9.9 0 0 0 5.33 1.55h.01c5.5 0 9.97-4.47 9.97-9.97S17.54 2 12.04 2Zm5.78 14.1c-.24.69-1.4 1.34-1.94 1.42-.5.08-1.14.12-1.84-.11-.42-.14-.95-.31-1.64-.61-2.88-1.25-4.75-4.15-4.9-4.35-.15-.2-1.17-1.56-1.17-2.98 0-1.42.74-2.12 1.01-2.41.27-.29.59-.36.79-.36h.57c.18 0 .42-.07.66.5.24.58.82 2.02.89 2.17.07.15.12.32.02.52-.1.2-.15.32-.3.49-.15.17-.32.38-.46.5-.15.12-.3.25-.13.5.17.25.77 1.27 1.65 2.06 1.14 1.02 2.1 1.34 2.35 1.49.25.15.4.12.55-.07.15-.2.64-.75.81-1.01.17-.25.34-.21.57-.12.23.09 1.47.69 1.72.82.25.12.42.18.49.28.07.1.07.59-.17 1.28Z" />
    </svg>
  );
}

function IconX(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={props.className} fill="currentColor">
      <path d="M18.9 2H22l-6.77 7.73L23.2 22h-6.3l-4.94-6.38L6.4 22H2.99l7.24-8.27L.8 2h6.46l4.46 5.76L18.9 2Zm-1.1 18h1.72L6.33 3.91H4.48L17.8 20Z" />
    </svg>
  );
}

function IconCopy(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={props.className} fill="currentColor">
      <path d="M8 7a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-1v-2h1a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-7a1 1 0 0 0-1 1V8H8V7Z" />
      <path d="M4 10a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V10Zm3-1a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1H7Z" />
    </svg>
  );
}

export function ShareButtons({ url, title }: ShareButtonsProps) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const shares = useMemo(
    () => [
      {
        name: 'Facebook',
        href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
        brandClass: 'text-[#1877F2]',
        Icon: IconFacebook,
      },
      {
        name: 'LinkedIn',
        href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
        brandClass: 'text-[#0A66C2]',
        Icon: IconLinkedIn,
      },
      {
        name: 'WhatsApp',
        href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
        brandClass: 'text-[#25D366]',
        Icon: IconWhatsApp,
      },
      {
        name: 'X',
        href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
        brandClass: 'text-slate-900',
        Icon: IconX,
      },
    ],
    [encodedTitle, encodedUrl],
  );

  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mt-10 border-t border-slate-100 pt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-slate-700">Partager cet article</p>
        <div className="flex flex-wrap items-center gap-2">
          {shares.map((s) => (
            <a
              key={s.name}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Partager sur ${s.name}`}
              title={`Partager sur ${s.name}`}
              className="group inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow"
            >
              <s.Icon className={`h-5 w-5 ${s.brandClass} transition group-hover:opacity-90`} />
            </a>
          ))}

          <button
            type="button"
            onClick={copyLink}
            aria-label="Copier le lien"
            title="Copier le lien"
            className="group inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow"
          >
            <IconCopy className="h-5 w-5 text-slate-600" />
            <span className="hidden sm:inline">{copied ? 'Copié' : 'Copier'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

