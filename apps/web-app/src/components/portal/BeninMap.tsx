/**
 * ============================================================================
 * CARTE INTERACTIVE DU BÉNIN - BENINMAP
 * ============================================================================
 * 
 * Carte SVG interactive des 12 départements du Bénin avec :
 * - Coloration choroplèthe selon le nombre d'écoles
 * - Animations au survol et à la sélection
 * - Panneau de détails du département sélectionné
 * - Légende de couleur
 * - Responsive et accessible
 * 
 * Palette Academia Helm : Navy (#1E3A5F) / Gold (#C9A84C)
 * 
 * ============================================================================
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, GraduationCap, Users, School, TrendingUp, ChevronRight } from 'lucide-react';
import { BENIN_DEPARTMENTS, type DepartmentData } from '@/data/benin-departments';

/* ── Palette Academia Helm ────────────────────────────────────────────── */
const NAVY = '#1E3A5F';
const NAVY_DARK = '#0D1F6E';
const NAVY_LIGHT = '#2d4a73';
const GOLD = '#C9A84C';
const GOLD_LIGHT = '#e4c978';

/* ── Types ────────────────────────────────────────────────────────────── */
type FilterType = 'all' | 'public' | 'private';

interface BeninMapProps {
  onDepartmentSelect?: (dept: DepartmentData | null) => void;
  selectedDepartment?: DepartmentData | null;
  filter?: FilterType;
  className?: string;
}

/* ── SVG Paths des 12 départements du Bénin ──────────────────────────── */
const DEPT_PATHS: Record<string, string> = {
  AL: 'M 85 5 L 145 8 L 175 15 L 200 35 L 210 65 L 215 100 L 210 130 L 195 145 L 160 155 L 130 150 L 105 140 L 80 120 L 55 95 L 45 65 L 50 35 Z',
  AT: 'M 45 65 L 55 95 L 80 120 L 75 150 L 65 175 L 50 195 L 35 210 L 20 195 L 12 165 L 10 130 L 15 95 L 25 70 Z',
  BO: 'M 210 65 L 260 55 L 310 60 L 340 80 L 350 110 L 345 145 L 330 170 L 300 185 L 265 180 L 235 170 L 210 155 L 195 145 L 210 130 L 215 100 Z',
  DO: 'M 50 195 L 65 175 L 75 150 L 105 140 L 130 150 L 145 165 L 135 195 L 120 215 L 100 230 L 75 240 L 55 235 L 40 220 Z',
  CO: 'M 145 165 L 160 155 L 195 145 L 210 155 L 235 170 L 240 195 L 230 220 L 205 240 L 175 245 L 150 235 L 130 225 L 120 215 L 135 195 Z',
  AQ: 'M 55 235 L 75 240 L 100 230 L 120 215 L 130 225 L 125 255 L 115 280 L 100 300 L 82 310 L 60 305 L 42 290 L 35 265 Z',
  KO: 'M 35 265 L 42 290 L 60 305 L 55 325 L 42 340 L 28 345 L 18 330 L 12 305 L 15 280 Z',
  LI: 'M 82 310 L 100 300 L 115 280 L 130 275 L 128 295 L 118 310 L 105 320 L 90 325 L 82 318 Z',
  MO: 'M 12 305 L 18 330 L 28 345 L 42 340 L 40 360 L 28 375 L 15 378 L 8 365 L 5 340 L 8 320 Z',
  OU: 'M 115 280 L 125 255 L 130 225 L 150 235 L 175 245 L 195 255 L 200 275 L 195 295 L 180 310 L 160 320 L 140 315 L 128 295 Z',
  PL: 'M 175 245 L 205 240 L 230 220 L 250 230 L 260 250 L 255 270 L 240 285 L 220 295 L 200 295 L 195 295 L 200 275 L 195 255 Z',
  ZO: 'M 130 225 L 150 235 L 175 245 L 195 255 L 200 275 L 195 295 L 180 310 L 160 320 L 140 315 L 128 295 L 130 275 L 125 255 Z',
};

/* ── Positions des labels ──────────────────────────────────────────────── */
const DEPT_LABELS: Record<string, { x: number; y: number }> = {
  AL: { x: 130, y: 82 },
  AT: { x: 38, y: 140 },
  BO: { x: 280, y: 120 },
  DO: { x: 95, y: 200 },
  CO: { x: 185, y: 205 },
  AQ: { x: 82, y: 275 },
  KO: { x: 30, y: 310 },
  LI: { x: 102, y: 308 },
  MO: { x: 22, y: 355 },
  OU: { x: 168, y: 290 },
  PL: { x: 232, y: 265 },
  ZO: { x: 162, y: 268 },
};

/* ── Helpers ──────────────────────────────────────────────────────────── */
function getChoroplethColor(value: number, max: number): string {
  if (max === 0) return NAVY_LIGHT;
  const ratio = value / max;
  // Gradient from light navy to deep navy
  const r = Math.round(45 + (13 - 45) * ratio);
  const g = Math.round(74 + (31 - 74) * ratio);
  const b = Math.round(115 + (110 - 115) * ratio);
  return `rgb(${r},${g},${b})`;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n);
}

/* ── Composant principal ──────────────────────────────────────────────── */
export default function BeninMap({
  onDepartmentSelect,
  selectedDepartment,
  filter = 'all',
  className = '',
}: BeninMapProps) {
  const [hoveredDept, setHoveredDept] = useState<string | null>(null);

  const maxSchools = useMemo(
    () => Math.max(...BENIN_DEPARTMENTS.map((d) => d.schoolCount)),
    [],
  );

  const getValue = useCallback(
    (dept: DepartmentData) => {
      switch (filter) {
        case 'public':
          return dept.publicCount;
        case 'private':
          return dept.privateCount;
        default:
          return dept.schoolCount;
      }
    },
    [filter],
  );

  const getFilterLabel = useCallback(() => {
    switch (filter) {
      case 'public':
        return 'publics';
      case 'private':
        return 'privés';
      default:
        return 'tous statuts';
    }
  }, [filter]);

  const activeDept = selectedDepartment ?? (hoveredDept ? BENIN_DEPARTMENTS.find((d) => d.code === hoveredDept) : null);

  return (
    <div className={`flex flex-col lg:flex-row gap-6 ${className}`}>
      {/* ── Carte SVG ────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <div className="relative">
          <svg
            viewBox="0 0 360 400"
            className="w-full max-w-lg mx-auto"
            role="img"
            aria-label="Carte interactive du Bénin par département"
          >
            {/* Départements */}
            {BENIN_DEPARTMENTS.map((dept) => {
              const path = DEPT_PATHS[dept.code];
              if (!path) return null;
              const value = getValue(dept);
              const isHovered = hoveredDept === dept.code;
              const isSelected = selectedDepartment?.code === dept.code;
              const isActive = isHovered || isSelected;

              return (
                <g key={dept.code}>
                  <motion.path
                    d={path}
                    fill={getChoroplethColor(value, maxSchools)}
                    stroke={isActive ? GOLD : 'rgba(255,255,255,0.6)'}
                    strokeWidth={isActive ? 2.5 : 1}
                    className="cursor-pointer"
                    style={{ filter: isActive ? 'drop-shadow(0 2px 8px rgba(201,168,76,0.4))' : 'none' }}
                    whileHover={{ scale: 1.02, originX: '50%', originY: '50%' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    onMouseEnter={() => setHoveredDept(dept.code)}
                    onMouseLeave={() => setHoveredDept(null)}
                    onClick={() => onDepartmentSelect?.(isSelected ? null : dept)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Département ${dept.name}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onDepartmentSelect?.(isSelected ? null : dept);
                      }
                    }}
                  />
                  {/* Label du département */}
                  <text
                    x={DEPT_LABELS[dept.code]?.x ?? 0}
                    y={DEPT_LABELS[dept.code]?.y ?? 0}
                    textAnchor="middle"
                    className="pointer-events-none select-none"
                    fill={isActive ? GOLD : 'rgba(255,255,255,0.9)'}
                    fontSize={isActive ? '9' : '7.5'}
                    fontWeight={isActive ? '700' : '500'}
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
                  >
                    {dept.name}
                  </text>
                </g>
              );
            })}

            {/* Tooltip au survol */}
            {hoveredDept && !selectedDepartment && (() => {
              const dept = BENIN_DEPARTMENTS.find((d) => d.code === hoveredDept);
              if (!dept) return null;
              const label = DEPT_LABELS[dept.code];
              return (
                <g className="pointer-events-none">
                  <rect
                    x={label.x - 55}
                    y={label.y - 40}
                    width={110}
                    height={28}
                    rx={6}
                    fill="rgba(13,31,110,0.92)"
                    stroke={GOLD}
                    strokeWidth={0.5}
                  />
                  <text
                    x={label.x}
                    y={label.y - 22}
                    textAnchor="middle"
                    fill="white"
                    fontSize="7"
                    fontWeight="600"
                  >
                    {dept.name} — {formatNumber(getValue(dept))} écoles
                  </text>
                </g>
              );
            })()}
          </svg>

          {/* Légende */}
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500">
            <span>Moins</span>
            <div className="flex h-3 w-32 rounded overflow-hidden">
              {[0.1, 0.3, 0.5, 0.7, 0.9].map((ratio, i) => (
                <div
                  key={i}
                  className="flex-1"
                  style={{ backgroundColor: getChoroplethColor(ratio * maxSchools, maxSchools) }}
                />
              ))}
            </div>
            <span>Plus</span>
            <span className="ml-2 text-slate-400">
              Écoles par département — {getFilterLabel()}
            </span>
          </div>
        </div>
      </div>

      {/* ── Panneau de détails ────────────────────────────────────── */}
      <div className="lg:w-80 xl:w-96 flex-shrink-0">
        <AnimatePresence mode="wait">
          {activeDept ? (
            <motion.div
              key={activeDept.code}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="rounded-2xl border border-slate-200/80 bg-white shadow-lg overflow-hidden"
            >
              {/* En-tête département */}
              <div
                className="px-5 py-4"
                style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})` }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider" style={{ color: GOLD_LIGHT }}>
                      Département ({BENIN_DEPARTMENTS.indexOf(activeDept) + 1}/{BENIN_DEPARTMENTS.length})
                    </p>
                    <h3 className="mt-1 text-xl font-bold text-white">{activeDept.name}</h3>
                    <p className="mt-0.5 text-xs text-slate-300 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {activeDept.capital} · {formatNumber(activeDept.area)} km²
                    </p>
                  </div>
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl"
                    style={{ background: `${GOLD}22` }}
                  >
                    <School className="h-6 w-6" style={{ color: GOLD }} />
                  </div>
                </div>
              </div>

              {/* Statistiques */}
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    icon={<School className="h-4 w-4" style={{ color: NAVY }} />}
                    label="Écoles"
                    value={formatNumber(getValue(activeDept))}
                    accent={NAVY}
                  />
                  <StatCard
                    icon={<Users className="h-4 w-4" style={{ color: NAVY }} />}
                    label="Apprenants"
                    value={formatNumber(activeDept.studentCount)}
                    accent={NAVY}
                  />
                  <StatCard
                    icon={<GraduationCap className="h-4 w-4" style={{ color: NAVY }} />}
                    label="Enseignants"
                    value={formatNumber(activeDept.teacherCount)}
                    accent={NAVY}
                  />
                  <StatCard
                    icon={<TrendingUp className="h-4 w-4" style={{ color: NAVY }} />}
                    label="% Filles"
                    value={`${activeDept.femalePercent}%`}
                    accent={NAVY}
                  />
                </div>

                {/* Répartition Public / Privé */}
                <div className="rounded-xl bg-slate-50 p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Répartition
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-slate-700">Public</span>
                        <span className="text-slate-500">
                          {formatNumber(activeDept.publicCount)} ({((activeDept.publicCount / activeDept.schoolCount) * 100).toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: NAVY }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(activeDept.publicCount / activeDept.schoolCount) * 100}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-slate-700">Privé</span>
                        <span className="text-slate-500">
                          {formatNumber(activeDept.privateCount)} ({((activeDept.privateCount / activeDept.schoolCount) * 100).toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: GOLD }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(activeDept.privateCount / activeDept.schoolCount) * 100}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Communes */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                    Communes ({activeDept.communes.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {activeDept.communes.map((commune) => (
                      <span
                        key={commune}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
                      >
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {commune}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Action */}
                {onDepartmentSelect && selectedDepartment?.code === activeDept.code && (
                  <motion.button
                    type="button"
                    onClick={() => onDepartmentSelect(null)}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors"
                    style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})` }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span>Voir tous les départements</span>
                    <ChevronRight className="h-4 w-4" />
                  </motion.button>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-6 text-center"
            >
              <div
                className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ background: `linear-gradient(135deg, ${NAVY}15, ${GOLD}15)` }}
              >
                <MapPin className="h-8 w-8" style={{ color: NAVY }} />
              </div>
              <h4 className="text-base font-bold text-slate-800">
                Sélectionnez un département
              </h4>
              <p className="mt-1.5 text-sm text-slate-500">
                Cliquez ou survolez la carte pour voir les statistiques détaillées par département
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Micro-composant : StatCard ───────────────────────────────────────── */
function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-xl p-3 border border-slate-100"
      style={{ background: `linear-gradient(135deg, ${accent}08, ${accent}03)` }}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className="text-lg font-bold" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}
