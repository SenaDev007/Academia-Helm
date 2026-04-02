import Image from 'next/image';

interface ArticleHeaderProps {
  title: string;
  description: string;
  author: { name: string; role: string; avatar?: string };
  publishedAt: string;
  updatedAt: string;
  readingTime: number;
  category: string;
  coverImage: { url: string; alt: string; credit?: string };
}

export function ArticleHeader({
  title,
  description,
  author,
  publishedAt,
  updatedAt,
  readingTime,
  category,
  coverImage,
}: ArticleHeaderProps) {
  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <header className="max-w-4xl mx-auto px-4 pt-12 pb-8">
      <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-4">
        {category}
      </span>

      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-4">{title}</h1>

      <p className="text-xl text-gray-600 mb-6">{description}</p>

      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-8 border-b border-gray-100 pb-6">
        <div className="flex items-center gap-2">
          {author.avatar ? (
            <Image
              src={author.avatar}
              alt={author.name}
              width={32}
              height={32}
              className="rounded-full"
            />
          ) : null}
          <div>
            <span className="font-medium text-gray-800">{author.name}</span>
            <span className="text-gray-400 mx-1">·</span>
            <span>{author.role}</span>
          </div>
        </div>

        <span className="text-gray-300">|</span>

        <div className="flex flex-col">
          <span>
            Publié le {formatDate(publishedAt)} à {formatTime(publishedAt)}
          </span>
          {updatedAt !== publishedAt ? (
            <span className="text-xs text-gray-400">
              Mis à jour le {formatDate(updatedAt)} à {formatTime(updatedAt)}
            </span>
          ) : null}
        </div>

        <span className="text-gray-300">|</span>

        <span>⏱ {readingTime} min de lecture</span>
      </div>

      <div className="relative w-full h-64 md:h-96 rounded-2xl overflow-hidden mb-8">
        <Image src={coverImage.url} alt={coverImage.alt} fill className="object-cover" priority />
        {coverImage.credit ? (
          <span className="absolute bottom-2 right-3 text-xs text-white/70">Photo : {coverImage.credit}</span>
        ) : null}
      </div>
    </header>
  );
}

