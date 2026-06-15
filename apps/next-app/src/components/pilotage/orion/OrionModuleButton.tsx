/**
 * ============================================================================
 * ORION MODULE BUTTON - BOUTON "ANALYSE ORION" PAR MODULE
 * ============================================================================
 * 
 * Bouton discret pour accéder à l'analyse ORION depuis chaque module
 * ============================================================================
 */

'use client';

import { Brain } from 'lucide-react';
import Link from 'next/link';

interface OrionModuleButtonProps {
  moduleType: string;
  academicYearId: string;
  schoolLevelId: string;
}

export default function OrionModuleButton({
  moduleType,
  academicYearId,
  schoolLevelId,
}: OrionModuleButtonProps) {
  return (
    <Link
      href={`/app/orion?module=${moduleType}&academicYearId=${academicYearId}&schoolLevelId=${schoolLevelId}`}
      className="inline-flex items-center space-x-2 px-3 py-2 text-sm font-medium text-navy-600 hover:text-navy-900 hover:bg-navy-50 rounded-md transition-colors"
    >
      <Brain className="w-4 h-4" />
      <span>Analyse ORION</span>
    </Link>
  );
}

