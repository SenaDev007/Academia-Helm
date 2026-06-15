/* eslint-disable @next/next/no-img-element */
'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import clsx from 'clsx';

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
    <header className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-50 via-white to-white" />
      <div className="mx-auto max-w-5xl px-4 pt-7 sm:pt-10 md:pt-14">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="flex flex-wrap items-center gap-1.5 sm:gap-2"
        >
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/70 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur sm:px-3 sm:py-1 sm:text-xs">
            {category}
          </span>
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/70 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur sm:px-3 sm:py-1 sm:text-xs">
            ⏱ {readingTime} min
          </span>
          <span className="hidden xs:inline-flex items-center rounded-full border border-slate-200 bg-white/70 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur sm:inline-flex sm:px-3 sm:py-1 sm:text-xs">
            Publié le {formatDate(publishedAt)}
          </span>
          {updatedAt !== publishedAt ? (
            <span className="hidden md:inline-flex items-center rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
              Mis à jour le {formatDate(updatedAt)}
            </span>
          ) : null}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut', delay: 0.05 }}
          className="mt-4 text-balance text-[28px] font-semibold tracking-tight text-slate-950 sm:mt-5 sm:text-3xl md:text-5xl"
        >
          {title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
          className="mt-3 max-w-3xl text-pretty text-base leading-relaxed text-slate-600 sm:mt-4 sm:text-lg md:text-xl"
        >
          {description}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut', delay: 0.15 }}
          className="mt-6 flex flex-wrap items-center gap-3 border-b border-slate-100 pb-6 sm:mt-7 sm:pb-7"
        >
          <div className="flex items-center gap-3">
            {author.avatar ? (
              <Image
                src={author.avatar}
                alt={author.name}
                width={40}
                height={40}
                className="h-9 w-9 rounded-full ring-1 ring-slate-200 sm:h-10 sm:w-10"
                sizes="40px"
              />
            ) : null}
            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-900">{author.name}</div>
              <div className="text-xs font-medium text-slate-500">{author.role}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span className="hidden sm:inline">·</span>
            <span className={clsx('rounded-full bg-slate-100 px-2.5 py-1 text-slate-600')}>Academia Helm</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut', delay: 0.2 }}
          className="mt-6 sm:mt-8"
        >
          <div className="relative h-48 w-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-sm sm:h-56 md:h-[420px]">
            <Image
              src={coverImage.url}
              alt={coverImage.alt}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 1024px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
            {coverImage.credit ? (
              <span className="absolute bottom-3 right-4 rounded-full bg-black/35 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
                Photo : {coverImage.credit}
              </span>
            ) : null}
          </div>
        </motion.div>
      </div>
    </header>
  );
}

