/**
 * ============================================================================
 * CARTE INTERACTIVE DU BÉNIN - BENINMAP
 * ============================================================================
 * 
 * Carte SVG interactive des 12 départements du Bénin avec :
 * - Coloration choroplèthe selon le nombre d'écoles
 * - Animations au survol et à la sélection
 * - Tooltip au survol affichant les statistiques du département
 * - Onglets niveau d'enseignement : Primaire / Secondaire / Tous
 * - Panneau détaillé avec circonscriptions scolaires
 * 
 * Palette Academia Helm : Navy (#0b2f73) / Blue (#1d4fa5) / Gold (#f5b335)
 * 
 * ============================================================================
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, GraduationCap, Users, School, TrendingUp, X, BookOpen, ChevronDown } from 'lucide-react';
import { BENIN_DEPARTMENTS, type DepartmentData } from '@/data/benin-departments';

/* ── Palette Academia Helm ────────────────────────────────────────────── */
const NAVY = '#0b2f73';
const BLUE = '#1d4fa5';
const GOLD = '#f5b335';
const NAVY_DARK = '#071d4a';
const NAVY_LIGHT = '#1a4a8a';
const GOLD_LIGHT = '#f7c76e';

/* ── Types ────────────────────────────────────────────────────────────── */
type FilterType = 'all' | 'public' | 'private';
type EducationLevel = 'primaire' | 'secondaire' | 'all';

interface BeninMapProps {
  onDepartmentSelect?: (dept: DepartmentData | null) => void;
  selectedDepartment?: DepartmentData | null;
  filter?: FilterType;
  className?: string;
}

/* ── SVG Paths des 12 départements du Bénin (GeoJSON-simplified) ─────── */
const DEPT_PATHS: Record<string, string> = {
  AL: 'M 168 12 L 178 10 L 195 15 L 210 30 L 220 50 L 228 75 L 232 105 L 228 135 L 218 158 L 200 170 L 180 175 L 155 172 L 135 162 L 118 148 L 105 130 L 95 108 L 88 82 L 92 55 L 105 35 L 128 20 Z',
  AT: 'M 88 82 L 95 108 L 105 130 L 100 155 L 90 175 L 75 192 L 58 202 L 40 198 L 28 178 L 20 155 L 16 125 L 20 95 L 30 72 L 48 58 L 68 55 L 82 65 Z',
  BO: 'M 228 75 L 250 62 L 278 58 L 305 65 L 325 82 L 338 105 L 340 135 L 332 162 L 315 182 L 290 192 L 260 188 L 235 178 L 218 158 L 228 135 L 232 105 Z',
  DO: 'M 75 192 L 90 175 L 100 155 L 118 148 L 135 162 L 148 178 L 138 198 L 122 215 L 102 228 L 82 235 L 62 228 L 48 215 L 42 198 L 58 202 Z',
  CO: 'M 148 178 L 155 172 L 180 175 L 200 170 L 218 158 L 235 178 L 242 198 L 232 220 L 210 238 L 185 242 L 162 235 L 142 222 L 130 210 L 138 198 Z',
  AQ: 'M 62 228 L 82 235 L 102 228 L 122 215 L 130 210 L 142 222 L 135 248 L 122 272 L 105 290 L 85 298 L 65 292 L 48 278 L 38 258 L 40 238 Z',
  KO: 'M 38 258 L 48 278 L 65 292 L 58 312 L 45 328 L 30 332 L 20 318 L 14 298 L 18 272 L 28 255 Z',
  LI: 'M 85 298 L 105 290 L 122 272 L 135 260 L 132 278 L 122 295 L 108 308 L 92 312 L 85 305 Z',
  MO: 'M 14 298 L 20 318 L 30 332 L 45 328 L 42 348 L 30 362 L 18 365 L 10 352 L 5 332 L 8 312 Z',
  OU: 'M 122 272 L 135 248 L 142 222 L 162 235 L 185 242 L 205 252 L 210 272 L 205 292 L 190 308 L 168 318 L 148 312 L 135 295 L 132 278 Z',
  PL: 'M 185 242 L 210 238 L 232 220 L 252 232 L 265 252 L 258 275 L 242 290 L 222 298 L 205 298 L 205 292 L 210 272 L 205 252 Z',
  ZO: 'M 142 222 L 162 235 L 185 242 L 205 252 L 210 272 L 205 292 L 190 308 L 168 318 L 148 312 L 135 295 L 135 260 L 135 248 Z',
};

/* ── Positions des labels ──────────────────────────────────────────────── */
const DEPT_LABELS: Record<string, { x: number; y: number }> = {
  AL: { x: 158, y: 95 },
  AT: { x: 55, y: 132 },
  BO: { x: 285, y: 125 },
  DO: { x: 95, y: 195 },
  CO: { x: 192, y: 208 },
  AQ: { x: 88, y: 265 },
  KO: { x: 32, y: 305 },
  LI: { x: 108, y: 298 },
  MO: { x: 25, y: 345 },
  OU: { x: 175, y: 285 },
  PL: { x: 238, y: 265 },
  ZO: { x: 168, y: 270 },
};

/* ── Helpers ──────────────────────────────────────────────────────────── */
function getChoroplethColor(value: number, max: number): string {
  if (max === 0) return NAVY_LIGHT;
  const ratio = value / max;
  const r = Math.round(26 + (7 - 26) * ratio);
  const g = Math.round(74 + (29 - 74) * ratio);
  const b = Math.round(138 + (115 - 138) * ratio);
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
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [educationLevel, setEducationLevel] = useState<EducationLevel>('primaire');
  const [circumscriptionOpen, setCircumscriptionOpen] = useState(false);

  const maxSchools = useMemo(() => {
    const getSchoolCount = (dept: DepartmentData) => {
      switch (educationLevel) {
        case 'secondaire': return dept.secondaire.schoolCount;
        case 'all': return dept.schoolCount + dept.secondaire.schoolCount;
        default: return dept.schoolCount;
      }
    };
    return Math.max(...BENIN_DEPARTMENTS.map(getSchoolCount));
  }, [educationLevel]);

  const getSchoolCount = useCallback(
    (dept: DepartmentData) => {
      switch (educationLevel) {
        case 'secondaire': return dept.secondaire.schoolCount;
        case 'all': return dept.schoolCount + dept.secondaire.schoolCount;
        default: return dept.schoolCount;
      }
    },
    [educationLevel],
  );

  const getValue = useCallback(
    (dept: DepartmentData) => {
      const sc = getSchoolCount(dept);
      switch (filter) {
        case 'public':
          return educationLevel === 'secondaire' ? dept.secondaire.publicCount : educationLevel === 'all' ? dept.publicCount + dept.secondaire.publicCount : dept.publicCount;
        case 'private':
          return educationLevel === 'secondaire' ? dept.secondaire.privateCount : educationLevel === 'all' ? dept.privateCount + dept.secondaire.privateCount : dept.privateCount;
        default:
          return sc;
      }
    },
    [filter, educationLevel, getSchoolCount],
  );

  const getFilterLabel = useCallback(() => {
    const levelLabel = educationLevel === 'secondaire' ? 'Secondaire' : educationLevel === 'all' ? 'Tous niveaux' : 'Primaire';
    switch (filter) {
      case 'public': return `publics (${levelLabel})`;
      case 'private': return `privés (${levelLabel})`;
      default: return `${levelLabel.toLowerCase()}`;
    }
  }, [filter, educationLevel]);

  const activeDept = selectedDepartment ?? (hoveredDept ? BENIN_DEPARTMENTS.find((d) => d.code === hoveredDept) : null);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 360;
    const y = ((e.clientY - rect.top) / rect.height) * 400;
    setTooltipPos({ x, y });
  }, []);

  const getActiveData = useCallback(
    (dept: DepartmentData) => {
      if (educationLevel === 'secondaire') {
        return {
          schoolCount: dept.secondaire.schoolCount,
          studentCount: dept.secondaire.studentCount,
          teacherCount: dept.secondaire.teacherCount,
          femalePercent: dept.secondaire.femalePercent,
          publicCount: dept.secondaire.publicCount,
          privateCount: dept.secondaire.privateCount,
        };
      }
      if (educationLevel === 'all') {
        return {
          schoolCount: dept.schoolCount + dept.secondaire.schoolCount,
          studentCount: dept.studentCount + dept.secondaire.studentCount,
          teacherCount: dept.teacherCount + dept.secondaire.teacherCount,
          femalePercent: Math.round(((dept.femalePercent * dept.studentCount) + (dept.secondaire.femalePercent * dept.secondaire.studentCount)) / (dept.studentCount + dept.secondaire.studentCount) * 10) / 10,
          publicCount: dept.publicCount + dept.secondaire.publicCount,
          privateCount: dept.privateCount + dept.secondaire.privateCount,
        };
      }
      return {
        schoolCount: dept.schoolCount,
        studentCount: dept.studentCount,
        teacherCount: dept.teacherCount,
        femalePercent: dept.femalePercent,
        publicCount: dept.publicCount,
        privateCount: dept.privateCount,
      };
    },
    [educationLevel],
  );

  return (
    <div className={className}>
      {/* ── Onglets niveau d'enseignement ──────────────────────────── */}
      <div className="flex items-center gap-1 mb-3 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 p-0.5">
        {([
          { key: 'primaire', label: 'Maternel & Primaire', icon: BookOpen },
          { key: 'secondaire', label: 'Secondaire', icon: GraduationCap },
          { key: 'all', label: 'Tous niveaux', icon: School },
        ] as const).map(({ key, label, icon: LvlIcon }) => (
          <button
            key={key}
            onClick={() => setEducationLevel(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-all ${
              educationLevel === key
                ? 'text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800 hover:bg-white/60'
            }`}
            style={
              educationLevel === key
                ? { background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }
                : undefined
            }
          >
            <LvlIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{key === 'primaire' ? 'Primaire' : key === 'secondaire' ? 'Secondaire' : 'Tous'}</span>
          </button>
        ))}
      </div>

      {/* ── Carte SVG plein format ─────────────────────────────────── */}
      <div className="relative">
        <svg
          viewBox="0 0 360 400"
          className="w-full max-w-2xl mx-auto"
          role="img"
          aria-label="Carte interactive du Bénin par département"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => { setHoveredDept(null); setTooltipPos(null); }}
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
                  style={{ filter: isActive ? 'drop-shadow(0 2px 8px rgba(245,179,53,0.4))' : 'none' }}
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
                  {dept.name.toUpperCase()}
                </text>
              </g>
            );
          })}

          {/* Tooltip au survol */}
          {hoveredDept && (() => {
            const dept = BENIN_DEPARTMENTS.find((d) => d.code === hoveredDept);
            if (!dept) return null;
            const tx = tooltipPos ? Math.min(Math.max(tooltipPos.x + 12, 60), 300) : (DEPT_LABELS[dept.code]?.x ?? 130);
            const ty = tooltipPos ? Math.max(tooltipPos.y - 12, 30) : ((DEPT_LABELS[dept.code]?.y ?? 100) - 30);
            const data = getActiveData(dept);
            const publicPct = ((data.publicCount / data.schoolCount) * 100).toFixed(0);
            const privatePct = ((data.privateCount / data.schoolCount) * 100).toFixed(0);

            return (
              <g className="pointer-events-none">
                <rect
                  x={tx - 80}
                  y={ty - 62}
                  width={160}
                  height={60}
                  rx={8}
                  fill="rgba(11,47,115,0.94)"
                  stroke={GOLD}
                  strokeWidth={0.5}
                />
                <text
                  x={tx}
                  y={ty - 44}
                  textAnchor="middle"
                  fill="white"
                  fontSize="8"
                  fontWeight="700"
                >
                  {dept.name}
                </text>
                <text
                  x={tx}
                  y={ty - 30}
                  textAnchor="middle"
                  fill={GOLD_LIGHT}
                  fontSize="7"
                  fontWeight="600"
                >
                  {formatNumber(data.schoolCount)} écoles — {formatNumber(data.studentCount)} apprenants
                </text>
                <text
                  x={tx}
                  y={ty - 18}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.7)"
                  fontSize="6.5"
                >
                  Public {publicPct}% · Privé {privatePct}% · {formatNumber(data.teacherCount)} enseignants
                </text>
                <polygon
                  points={`${tx - 5},${ty - 2} ${tx + 5},${ty - 2} ${tx},${ty + 4}`}
                  fill="rgba(11,47,115,0.94)"
                />
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
            Écoles — {getFilterLabel()}
          </span>
        </div>
      </div>

      {/* ── Détail du département sélectionné (sous la carte) ──────── */}
      <AnimatePresence mode="wait">
        {activeDept && onDepartmentSelect && selectedDepartment?.code === activeDept.code ? (
          <motion.div
            key={activeDept.code}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="mt-5 rounded-2xl border border-slate-200/80 bg-white shadow-lg overflow-hidden"
          >
            {/* En-tête département */}
            <div
              className="px-5 py-4 relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
            >
              {/* Decorative circle */}
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10" style={{ backgroundColor: GOLD }} />
              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: GOLD_LIGHT }}>
                    Département ({BENIN_DEPARTMENTS.indexOf(activeDept) + 1}/{BENIN_DEPARTMENTS.length})
                  </p>
                  <h3 className="mt-0.5 text-xl font-bold text-white">{activeDept.name}</h3>
                  <p className="mt-0.5 text-[11px] text-blue-200 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {activeDept.capital} · {formatNumber(activeDept.area)} km²
                  </p>
                </div>
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ background: `${GOLD}22` }}
                >
                  <School className="h-6 w-6" style={{ color: GOLD }} />
                </div>
              </div>
            </div>

            {/* Statistiques principales */}
            <div className="p-4 space-y-4">
              {/* Onglets Primaire / Secondaire dans le panneau */}
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                {(['primaire', 'secondaire'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setEducationLevel(level)}
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                      educationLevel === level
                        ? 'bg-white text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                    style={educationLevel === level ? { background: `linear-gradient(135deg, ${NAVY}, ${BLUE})`, color: 'white' } : undefined}
                  >
                    {level === 'primaire' ? 'Maternel & Primaire' : 'Secondaire'}
                  </button>
                ))}
              </div>

              {/* 4 Key Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatCard
                  icon={<School className="h-4 w-4" style={{ color: BLUE }} />}
                  label="Écoles"
                  value={formatNumber(getActiveData(activeDept).schoolCount)}
                  accent={BLUE}
                />
                <StatCard
                  icon={<Users className="h-4 w-4" style={{ color: BLUE }} />}
                  label="Apprenants"
                  value={formatNumber(getActiveData(activeDept).studentCount)}
                  accent={BLUE}
                />
                <StatCard
                  icon={<GraduationCap className="h-4 w-4" style={{ color: BLUE }} />}
                  label="Enseignants"
                  value={formatNumber(getActiveData(activeDept).teacherCount)}
                  accent={BLUE}
                />
                <StatCard
                  icon={<TrendingUp className="h-4 w-4" style={{ color: BLUE }} />}
                  label="% Filles"
                  value={`${getActiveData(activeDept).femalePercent}%`}
                  accent={BLUE}
                />
              </div>

              {/* Répartition Public / Privé */}
              <div className="rounded-xl bg-slate-50 p-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Répartition Public / Privé
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">Public</span>
                      <span className="text-slate-500">
                        {formatNumber(getActiveData(activeDept).publicCount)} ({((getActiveData(activeDept).publicCount / getActiveData(activeDept).schoolCount) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: NAVY }}
                        initial={{ width: 0 }}
                        animate={{ width: `${(getActiveData(activeDept).publicCount / getActiveData(activeDept).schoolCount) * 100}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">Privé</span>
                      <span className="text-slate-500">
                        {formatNumber(getActiveData(activeDept).privateCount)} ({((getActiveData(activeDept).privateCount / getActiveData(activeDept).schoolCount) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: GOLD }}
                        initial={{ width: 0 }}
                        animate={{ width: `${(getActiveData(activeDept).privateCount / getActiveData(activeDept).schoolCount) * 100}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Secondaire stats summary (shown when primaire tab is active) */}
              {educationLevel === 'primaire' && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <GraduationCap className="h-4 w-4" style={{ color: BLUE }} />
                    <span className="text-xs font-semibold" style={{ color: NAVY }}>Secondaire — Aperçu</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-sm font-bold" style={{ color: NAVY }}>{formatNumber(activeDept.secondaire.schoolCount)}</p>
                      <p className="text-[10px] text-slate-500">Écoles</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: NAVY }}>{formatNumber(activeDept.secondaire.studentCount)}</p>
                      <p className="text-[10px] text-slate-500">Apprenants</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: NAVY }}>{formatNumber(activeDept.secondaire.teacherCount)}</p>
                      <p className="text-[10px] text-slate-500">Enseignants</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: NAVY }}>{activeDept.secondaire.femalePercent}%</p>
                      <p className="text-[10px] text-slate-500">% Filles</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Circonscriptions scolaires */}
              {educationLevel === 'primaire' && activeDept.circumscriptions.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <button
                    onClick={() => setCircumscriptionOpen(!circumscriptionOpen)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold uppercase tracking-wide hover:bg-slate-50 transition-colors"
                    style={{ color: NAVY }}
                  >
                    <span className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" style={{ color: GOLD }} />
                      Circonscriptions ({activeDept.circumscriptions.length})
                    </span>
                    <motion.div
                      animate={{ rotate: circumscriptionOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    </motion.div>
                  </button>
                  <AnimatePresence>
                    {circumscriptionOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="overflow-hidden"
                      >
                        <div className="max-h-72 overflow-y-auto">
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="border-t border-slate-100" style={{ background: `${NAVY}08` }}>
                                <th className="text-left px-3 py-2 font-semibold text-slate-600">Circonscription</th>
                                <th className="text-right px-3 py-2 font-semibold text-slate-600">Écoles</th>
                                <th className="text-right px-3 py-2 font-semibold text-slate-600">Apprenants</th>
                                <th className="text-right px-3 py-2 font-semibold text-slate-600">Enseignants</th>
                                <th className="text-right px-3 py-2 font-semibold text-slate-600">% Filles</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeDept.circumscriptions.map((circ, i) => (
                                <tr
                                  key={circ.name}
                                  className={`border-t border-slate-50 hover:bg-blue-50/40 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-25'}`}
                                >
                                  <td className="px-3 py-1.5 font-medium text-slate-800">{circ.name}</td>
                                  <td className="text-right px-3 py-1.5 font-semibold" style={{ color: NAVY }}>{formatNumber(circ.schoolCount)}</td>
                                  <td className="text-right px-3 py-1.5 text-slate-600">{formatNumber(circ.studentCount)}</td>
                                  <td className="text-right px-3 py-1.5 text-slate-600">{formatNumber(circ.teacherCount)}</td>
                                  <td className="text-right px-3 py-1.5">
                                    <span className="inline-flex items-center gap-1">
                                      <span className="font-medium" style={{ color: circ.femalePercent >= 48 ? '#16a34a' : '#dc2626' }}>
                                        {circ.femalePercent}%
                                      </span>
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Communes */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Communes ({activeDept.communes.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {activeDept.communes.map((commune) => (
                    <span
                      key={commune}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-700"
                      style={{ backgroundColor: `${NAVY}08`, border: `1px solid ${NAVY}18` }}
                    >
                      <MapPin className="h-3 w-3" style={{ color: BLUE }} />
                      {commune}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action */}
              <motion.button
                type="button"
                onClick={() => onDepartmentSelect(null)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors"
                style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <X className="h-4 w-4" />
                <span>Voir tous les départements</span>
              </motion.button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
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
      className="rounded-lg p-2.5 border border-slate-100"
      style={{ background: `linear-gradient(135deg, ${accent}08, ${accent}03)` }}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        {icon}
        <span className="text-[11px] text-slate-500">{label}</span>
      </div>
      <p className="text-base font-bold" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}
