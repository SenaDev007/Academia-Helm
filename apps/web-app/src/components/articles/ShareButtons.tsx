'use client';

interface ShareButtonsProps {
  url: string;
  title: string;
}

export function ShareButtons({ url, title }: ShareButtonsProps) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const shares = [
    {
      name: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      color: 'bg-[#1877F2] hover:bg-[#166FE5]',
    },
    {
      name: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      color: 'bg-[#0A66C2] hover:bg-[#095BAB]',
    },
    {
      name: 'WhatsApp',
      href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      color: 'bg-[#25D366] hover:bg-[#20BA5A]',
    },
    {
      name: 'X (Twitter)',
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      color: 'bg-black hover:bg-gray-800',
    },
  ];

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      alert('Lien copié !');
    } catch {
      alert('Impossible de copier le lien.');
    }
  };

  return (
    <div className="border-t border-gray-100 pt-8 mt-10">
      <p className="text-sm font-semibold text-gray-700 mb-3">Partager cet article :</p>
      <div className="flex flex-wrap gap-3">
        {shares.map((s) => (
          <a
            key={s.name}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`${s.color} text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors`}
          >
            {s.name}
          </a>
        ))}
        <button
          type="button"
          onClick={copyLink}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Copier le lien
        </button>
      </div>
    </div>
  );
}

