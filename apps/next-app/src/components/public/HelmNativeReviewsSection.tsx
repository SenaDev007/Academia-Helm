'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Quote, Star } from 'lucide-react';
import { HELM_LANDING_REVIEWS } from '@/data/helm-reviews';
import type { PlatformReviewPublic } from '@/types/platform-review';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

type Props = {
  initialReviews?: PlatformReviewPublic[];
};

export default function HelmNativeReviewsSection({ initialReviews = [] }: Props) {
  const fromApi = initialReviews.length > 0;
  const rows = fromApi
    ? initialReviews.map((r) => ({
        id: r.id,
        quote: r.quote,
        author: r.authorLabel,
        role: r.roleLabel,
        org: r.organizationLabel,
        rating: r.rating,
      }))
    : HELM_LANDING_REVIEWS.map((r) => ({
        id: r.id,
        quote: r.quote,
        author: r.author,
        role: r.role,
        org: r.org,
        rating: r.rating,
      }));

  return (
    <div className="space-y-8">
      {!fromApi ? (
        <p className="text-center text-sm text-amber-800 bg-amber-50 border border-amber-200/80 rounded-xl px-4 py-3 max-w-2xl mx-auto">
          Mode démo : aucun avis en base ou API indisponible. Lancez la migration, le seed et l’API pour afficher
          les témoignages persistés.
        </p>
      ) : null}

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
        {fromApi
          ? 'Ces avis sont enregistrés dans notre base et publiés après contrôle. Pour témoigner ou corriger une citation, contactez-nous.'
          : 'Témoignages issus de retours directs d’établissements partenaires (fichier de démo). Pour figurer sur cette page, contactez-nous.'}
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
        <Link
          href="/contact"
          className="inline-flex items-center justify-center rounded-xl bg-[#0b2f73] px-6 py-3 text-sm font-semibold text-white hover:bg-[#144798] transition-colors min-h-[44px]"
        >
          Nous contacter
        </Link>
        <Link
          href="/testimonials"
          className="inline-flex items-center justify-center rounded-xl border border-[#0b2f73]/25 bg-white px-6 py-3 text-sm font-semibold text-[#0b2f73] hover:bg-slate-50 transition-colors min-h-[44px]"
        >
          Voir la page témoignages
        </Link>
      </div>
    </div>
  );
}
