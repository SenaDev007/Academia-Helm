'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Quote, Star } from 'lucide-react';
import type { PlatformReviewPublic } from '@/types/platform-review';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

type Props = {
  initialReviews?: PlatformReviewPublic[];
};

/**
 * Section avis avec données réelles uniquement.
 * Si aucun avis n'est disponible, affiche un message invitant à laisser un avis.
 */
export default function HelmNativeReviewsSection({ initialReviews = [] }: Props) {
  if (initialReviews.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-slate-500">
          Aucun avis pour le moment.
        </p>
        <Link
          href="/avis"
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-[#0b2f73] px-6 py-3 text-sm font-semibold text-white hover:bg-[#144798] transition-colors min-h-[44px]"
        >
          Laisser un avis
        </Link>
      </div>
    );
  }

  const rows = initialReviews.map((r) => ({
    id: r.id,
    quote: r.quote,
    author: r.authorLabel,
    role: r.roleLabel,
    org: r.organizationLabel,
    rating: r.rating,
  }));

  return (
    <div className="space-y-8">
      <motion.div
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-5"
      >
        {rows.map((r) => (
          <motion.article
            key={r.id}
            variants={fadeUp}
            whileHover={{ y: -4, transition: { type: 'spring', stiffness: 260, damping: 20 } }}
            className="relative rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/90 p-6 shadow-sm text-left"
          >
            <Quote className="absolute top-4 right-4 w-8 h-8 text-amber-400/40 rotate-180" aria-hidden />
            <div className="flex gap-0.5 mb-3" aria-label={`Note ${r.rating} sur 5`}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${i < r.rating ? 'text-amber-500 fill-amber-500' : 'text-slate-200'}`}
                />
              ))}
            </div>
            <p className="text-slate-700 leading-relaxed text-sm md:text-[15px] relative z-[1]">{r.quote}</p>
            <footer className="mt-5 pt-4 border-t border-slate-100">
              <p className="font-semibold text-[#0b2f73]">{r.author}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {r.role} · {r.org}
              </p>
            </footer>
          </motion.article>
        ))}
      </motion.div>

      <p className="text-center text-xs text-slate-500 max-w-2xl mx-auto">
        Ces avis sont enregistrés dans notre base et publiés après contrôle.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
        <Link
          href="/avis"
          className="inline-flex items-center justify-center rounded-xl bg-[#0b2f73] px-6 py-3 text-sm font-semibold text-white hover:bg-[#144798] transition-colors min-h-[44px]"
        >
          Laisser un avis
        </Link>
      </div>
    </div>
  );
}
