'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';

/**
 * RecruitmentPlaceholder
 *
 * Illustration affichée dans le panneau de détails lorsqu'aucun poste
 * n'est sélectionné. Remplace l'ancien état vide textuel par une image
 * professionnelle qui renforce l'identité visuelle premium d'Academia Helm.
 */
export default function RecruitmentPlaceholder() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex h-full min-h-[420px] w-full items-center justify-center rounded-2xl bg-white border border-slate-200 shadow-sm p-6"
    >
      <Image
        src="/images/AcademiaHelm_RecruitmentPortal_Portrait.jpeg"
        alt="Academia Helm — Portail de Recrutement"
        width={675}
        height={1200}
        priority
        className="max-h-full max-w-full rounded-xl object-contain"
      />
    </motion.div>
  );
}
