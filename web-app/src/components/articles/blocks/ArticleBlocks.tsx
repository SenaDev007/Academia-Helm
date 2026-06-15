'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import clsx from 'clsx';

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0 },
};

export function ArticleDivider({ className }: { className?: string }) {
  return <div className={clsx('my-10 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent', className)} />;
}

export function ArticleBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
      {children}
    </span>
  );
}

export function ArticleSection({
  eyebrow,
  title,
  children,
  id,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <motion.section
      id={id}
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="scroll-mt-28"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {eyebrow ? <ArticleBadge>{eyebrow}</ArticleBadge> : null}
      </div>
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-[28px]">{title}</h2>
      <div className="mt-4 space-y-4 text-[17px] leading-relaxed text-slate-700 text-left sm:text-justify [hyphens:auto]">
        {children}
      </div>
    </motion.section>
  );
}

export function ArticleCallout({
  title,
  children,
  tone = 'info',
}: {
  title?: string;
  children: ReactNode;
  tone?: 'info' | 'warning' | 'success';
}) {
  const toneClasses =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50/60 text-slate-800'
      : tone === 'success'
        ? 'border-emerald-200 bg-emerald-50/60 text-slate-800'
        : 'border-blue-200 bg-blue-50/60 text-slate-800';

  return (
    <div className={clsx('rounded-2xl border p-5 shadow-sm', toneClasses)}>
      {title ? <p className="mb-2 text-sm font-semibold text-slate-900">{title}</p> : null}
      <div className="text-[15px] leading-relaxed">{children}</div>
    </div>
  );
}

export function ArticleKpiGrid({ children }: { children: ReactNode }) {
  return <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>;
}

export function ArticleKpiCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-4xl font-semibold tracking-tight text-blue-700">{value}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{description}</p>
    </div>
  );
}

export function ArticleInlineCta({
  text,
  primary,
  secondary,
}: {
  text: ReactNode;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <div className="my-10 rounded-3xl border border-slate-200 bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white shadow-md md:p-7">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-[15px] font-semibold leading-relaxed md:text-base">{text}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href={primary.href}
            className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            {primary.label}
          </Link>
          {secondary ? (
            <Link
              href={secondary.href}
              className="inline-flex items-center justify-center rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 hover:bg-white/15"
            >
              {secondary.label}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ArticleFaq({
  items,
  title = 'FAQ',
}: {
  title?: string;
  items: Array<{ question: string; answer: string }>;
}) {
  return (
    <motion.section
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-[28px]">{title}</h2>
      <div className="mt-6 space-y-4">
        {items.map((f) => (
          <details
            key={f.question}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm open:shadow-md"
          >
            <summary className="cursor-pointer list-none text-base font-semibold text-slate-900">
              <span className="inline-flex items-center gap-2">
                <span className="text-blue-700">+</span>
                {f.question}
              </span>
            </summary>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-700">{f.answer}</p>
          </details>
        ))}
      </div>
    </motion.section>
  );
}

