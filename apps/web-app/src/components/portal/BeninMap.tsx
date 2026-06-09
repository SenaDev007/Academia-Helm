'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, GraduationCap, Users, BookOpen } from 'lucide-react';

/* ─── Benin 12 departments with SVG path data ─── */
interface DepartmentData {
  id: string;
  name: string;
  path: string;
  labelX: number;
  labelY: number;
  schoolCount: number;
  publicCount: number;
  privateCount: number;
  teacherCount: number;
  learnerCount: number;
}

/**
 * Geographically accurate SVG paths for Benin's 12 departments.
 * Benin's shape: wide in the north (~325km), narrowing in the center (~100km),
 * widening again in the south coastal region.
 * ViewBox: 400 x 700 to capture the characteristic shape.
 *
 * Department layout (north to south):
 *   Top row: ATACORA (NW), ALIBORI (NE - largest)
 *   2nd row: DONGA (W), BORGOU (E - large)
 *   3rd row: (none, these overlap)
 *   Center: COLLINES (W-center), PLATEAU (E-center)
 *   South-center: COUFFO (W), ZOU (center), OUÉMÉ (E)
 *   Coast: MONO (SW), ATLANTIQUE (center-south), LITTORAL (tiny, Cotonou)
 */
const DEPARTMENTS: DepartmentData[] = [
  {
    id: 'alibori',
    name: 'ALIBORI',
    // Largest department, northeast - wide and flat top (Niger border)
    path: 'M120,5 L385,5 C390,5 395,10 395,18 L388,55 L375,95 L355,130 L320,155 L280,170 L240,178 L200,175 L160,165 L130,145 L110,115 L105,80 L108,40 Z',
    labelX: 255, labelY: 85,
    schoolCount: 1245, publicCount: 890, privateCount: 355,
    teacherCount: 4200, learnerCount: 185000,
  },
  {
    id: 'atacora',
    name: 'ATACORA',
    // Northwest - mountainous, borders Togo and Burkina Faso
    path: 'M5,50 L108,40 L105,80 L110,115 L130,145 L115,175 L90,210 L65,235 L40,245 L25,225 L10,185 L3,140 L2,90 Z',
    labelX: 60, labelY: 150,
    schoolCount: 980, publicCount: 720, privateCount: 260,
    teacherCount: 3100, learnerCount: 142000,
  },
  {
    id: 'borgou',
    name: 'BORGOU',
    // East-center, large - borders Nigeria
    path: 'M130,145 L160,165 L200,175 L240,178 L280,170 L320,155 L330,180 L335,215 L325,250 L300,275 L265,290 L230,295 L195,288 L165,270 L140,245 L120,215 L110,185 L115,175 Z',
    labelX: 228, labelY: 225,
    schoolCount: 1680, publicCount: 1200, privateCount: 480,
    teacherCount: 5800, learnerCount: 252000,
  },
  {
    id: 'donga',
    name: 'DONGA',
    // West-center, small - between Atacora and Collines
    path: 'M65,235 L90,210 L115,175 L110,185 L120,215 L140,245 L130,270 L110,290 L85,300 L60,290 L45,270 L40,245 Z',
    labelX: 88, labelY: 258,
    schoolCount: 720, publicCount: 530, privateCount: 190,
    teacherCount: 2400, learnerCount: 108000,
  },
  {
    id: 'collines',
    name: 'COLLINES',
    // Center - hilly region, narrow waist of Benin
    path: 'M85,300 L110,290 L130,270 L140,245 L165,270 L195,288 L200,310 L195,340 L180,365 L155,375 L125,370 L100,355 L80,335 L75,310 Z',
    labelX: 138, labelY: 330,
    schoolCount: 1120, publicCount: 780, privateCount: 340,
    teacherCount: 3900, learnerCount: 175000,
  },
  {
    id: 'plateau',
    name: 'PLATEAU',
    // East-center - borders Nigeria, narrow strip
    path: 'M230,295 L265,290 L300,275 L310,295 L315,325 L305,355 L280,370 L250,375 L225,365 L210,345 L200,310 L195,288 Z',
    labelX: 260, labelY: 335,
    schoolCount: 890, publicCount: 620, privateCount: 270,
    teacherCount: 3200, learnerCount: 148000,
  },
  {
    id: 'zou',
    name: 'ZOU',
    // Center-south - includes Abomey
    path: 'M100,355 L125,370 L155,375 L180,365 L195,340 L210,345 L215,370 L205,400 L185,420 L155,430 L125,425 L100,410 L85,385 L80,365 Z',
    labelX: 150, labelY: 398,
    schoolCount: 1450, publicCount: 1020, privateCount: 430,
    teacherCount: 5100, learnerCount: 223000,
  },
  {
    id: 'couffo',
    name: 'COUFFO',
    // Southwest - small, borders Togo
    path: 'M60,340 L85,335 L80,365 L85,385 L100,410 L95,440 L80,460 L60,465 L42,450 L35,420 L30,390 L35,360 Z',
    labelX: 62, labelY: 405,
    schoolCount: 780, publicCount: 560, privateCount: 220,
    teacherCount: 2700, learnerCount: 118000,
  },
  {
    id: 'oueme',
    name: 'OUÉMÉ',
    // Southeast - includes Porto-Novo (capital)
    path: 'M205,400 L215,370 L225,365 L250,375 L280,370 L290,390 L295,420 L285,450 L265,470 L240,475 L220,465 L205,445 L195,420 Z',
    labelX: 252, labelY: 425,
    schoolCount: 1680, publicCount: 980, privateCount: 700,
    teacherCount: 6200, learnerCount: 298000,
  },
  {
    id: 'atlantique',
    name: 'ATLANTIQUE',
    // South-center - includes Ouidah, wide coastal area
    path: 'M125,425 L155,430 L185,420 L195,420 L205,445 L210,475 L200,500 L180,520 L155,530 L130,525 L110,510 L95,490 L85,465 L95,440 Z',
    labelX: 152, labelY: 480,
    schoolCount: 1920, publicCount: 1050, privateCount: 870,
    teacherCount: 7400, learnerCount: 345000,
  },
  {
    id: 'littoral',
    name: 'LITTORAL',
    // Tiny coastal department - Cotonou (economic capital)
    path: 'M180,520 L200,500 L210,475 L220,480 L225,505 L218,525 L205,540 L188,545 L175,538 Z',
    labelX: 200, labelY: 520,
    schoolCount: 620, publicCount: 250, privateCount: 370,
    teacherCount: 3600, learnerCount: 156000,
  },
  {
    id: 'mono',
    name: 'MONO',
    // Southwest coastal - borders Togo
    path: 'M42,450 L60,465 L80,460 L85,465 L95,490 L100,520 L90,545 L72,555 L52,550 L35,530 L25,500 L28,470 Z',
    labelX: 62, labelY: 510,
    schoolCount: 1020, publicCount: 700, privateCount: 320,
    teacherCount: 3600, learnerCount: 147000,
  },
];

/* ─── Color scale: blue gradient based on school count ─── */
function getDepartmentColor(count: number, maxCount: number): string {
  const ratio = Math.min(count / maxCount, 1);
  // Gradient from light blue (#BFDBFE) to dark navy (#1E3A8A)
  const r = Math.round(191 + (30 - 191) * ratio);
  const g = Math.round(219 + (58 - 219) * ratio);
  const b = Math.round(254 + (138 - 254) * ratio);
  return `rgb(${r},${g},${b})`;
}

type FilterType = 'all' | 'public' | 'private';

export default function BeninMap() {
  const [hoveredDept, setHoveredDept] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  const maxSchoolCount = useMemo(() =>
    Math.max(...DEPARTMENTS.map(d => d.schoolCount)), []);

  const getFilteredCount = useCallback((dept: DepartmentData): number => {
    switch (filter) {
      case 'public': return dept.publicCount;
      case 'private': return dept.privateCount;
      default: return dept.schoolCount;
    }
  }, [filter]);

  const totals = useMemo(() => {
    const schoolKey = filter === 'public' ? 'publicCount' : filter === 'private' ? 'privateCount' : 'schoolCount';
    return {
      schools: DEPARTMENTS.reduce((s, d) => s + d[schoolKey], 0),
      teachers: DEPARTMENTS.reduce((s, d) => s + d.teacherCount, 0),
      learners: DEPARTMENTS.reduce((s, d) => s + d.learnerCount, 0),
    };
  }, [filter]);

  const hovered = useMemo(() =>
    DEPARTMENTS.find(d => d.id === hoveredDept) ?? null,
    [hoveredDept]);

  const selected = useMemo(() =>
    DEPARTMENTS.find(d => d.id === selectedDept) ?? null,
    [selectedDept]);

  const activeDept = selected || hovered;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-slate-900" style={{ color: '#1E3A5F' }}>
          Nos établissements au Bénin
        </h2>
        <p className="mt-1.5 text-sm text-slate-500">
          Explorez la carte pour découvrir les écoles par département
        </p>

        {/* Stats strip */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <BookOpen className="h-4 w-4 text-blue-500" />
            <span className="text-blue-700">{totals.schools.toLocaleString('fr-FR')}</span>
            <span className="text-slate-500 font-normal">écoles</span>
          </div>
          <div className="text-slate-300 hidden sm:inline">•</div>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <GraduationCap className="h-4 w-4 text-emerald-500" />
            <span className="text-emerald-700">{totals.teachers.toLocaleString('fr-FR')}</span>
            <span className="text-slate-500 font-normal">enseignants</span>
          </div>
          <div className="text-slate-300 hidden sm:inline">•</div>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <Users className="h-4 w-4 text-violet-500" />
            <span className="text-violet-700">{totals.learners.toLocaleString('fr-FR')}</span>
            <span className="text-slate-500 font-normal">apprenants</span>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-5 flex justify-center">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {[
            { key: 'all' as FilterType, label: 'Tous statuts' },
            { key: 'public' as FilterType, label: 'Public' },
            { key: 'private' as FilterType, label: 'Privé' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                filter === tab.key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Map + Info Panel */}
      <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6 justify-center">
        {/* SVG Map */}
        <div className="relative w-full max-w-xs sm:max-w-sm">
          <svg
            viewBox="-15 -5 430 570"
            className="w-full h-auto"
            xmlns="http://www.w3.org/2000/svg"
            style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.08))' }}
          >
            {/* Background shadow for depth */}
            <defs>
              <filter id="deptShadow" x="-5%" y="-5%" width="110%" height="110%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.15" />
              </filter>
            </defs>

            {DEPARTMENTS.map(dept => {
              const count = getFilteredCount(dept);
              const isHovered = hoveredDept === dept.id;
              const isSelected = selectedDept === dept.id;
              const fillColor = getDepartmentColor(count, maxSchoolCount);
              const isDark = count / maxSchoolCount > 0.6;

              return (
                <g
                  key={dept.id}
                  onMouseEnter={() => setHoveredDept(dept.id)}
                  onMouseLeave={() => setHoveredDept(null)}
                  onClick={() => setSelectedDept(isSelected ? null : dept.id)}
                  className="cursor-pointer"
                  role="button"
                  aria-label={`Département ${dept.name}`}
                >
                  <path
                    d={dept.path}
                    fill={fillColor}
                    stroke={isHovered || isSelected ? '#ffffff' : 'rgba(255,255,255,0.6)'}
                    strokeWidth={isHovered || isSelected ? 2.5 : 1}
                    className="transition-all duration-200"
                    style={{
                      filter: isHovered || isSelected
                        ? 'brightness(1.15) drop-shadow(0 3px 6px rgba(0,0,0,0.25))'
                        : 'none',
                      transformOrigin: `${dept.labelX}px ${dept.labelY}px`,
                      transform: isHovered || isSelected ? 'scale(1.02)' : 'scale(1)',
                    }}
                  />
                  {/* Department label */}
                  <text
                    x={dept.labelX}
                    y={dept.labelY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isDark ? '#ffffff' : '#1e293b'}
                    fontSize={dept.id === 'littoral' ? 8 : dept.id === 'alibori' || dept.id === 'borgou' ? 11 : 9.5}
                    fontWeight="bold"
                    letterSpacing="0.5"
                    className="pointer-events-none select-none"
                    style={{ textShadow: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 2px rgba(255,255,255,0.5)' }}
                  >
                    {dept.name}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Tooltip on hover */}
          <AnimatePresence>
            {hovered && !selectedDept && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                className="absolute left-1/2 -translate-x-1/2 bottom-2 bg-white rounded-xl border border-slate-200 shadow-lg px-4 py-3 text-center z-10 pointer-events-none min-w-[180px]"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  {hovered.name}
                </p>
                <p className="text-lg font-bold" style={{ color: '#1E3A5F' }}>
                  {getFilteredCount(hovered).toLocaleString('fr-FR')}
                </p>
                <p className="text-[10px] text-slate-500">
                  {filter === 'all' ? 'écoles' : filter === 'public' ? 'écoles publiques' : 'écoles privées'} — tous statuts
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Side info panel */}
        <AnimatePresence mode="wait">
          {activeDept && (
            <motion.div
              key={activeDept.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden"
            >
              <div className="px-5 py-4 text-white" style={{ background: 'linear-gradient(135deg, #1E3A5F, #2563EB)' }}>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">{activeDept.name}</h3>
                </div>
                <p className="mt-1 text-2xl font-extrabold">
                  {activeDept.schoolCount.toLocaleString('fr-FR')}
                  <span className="text-sm font-normal ml-1 text-white/70">écoles</span>
                </p>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-blue-50 p-2.5 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">Public</p>
                    <p className="text-lg font-bold text-blue-700">{activeDept.publicCount.toLocaleString('fr-FR')}</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-2.5 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">Privé</p>
                    <p className="text-lg font-bold text-amber-700">{activeDept.privateCount.toLocaleString('fr-FR')}</p>
                  </div>
                </div>
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5" /> Enseignants
                    </span>
                    <span className="font-bold text-slate-800">{activeDept.teacherCount.toLocaleString('fr-FR')}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" /> Apprenants
                    </span>
                    <span className="font-bold text-slate-800">{activeDept.learnerCount.toLocaleString('fr-FR')}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500">
        <span>Moins</span>
        <div className="flex h-3 w-32 rounded overflow-hidden">
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((ratio, i) => (
            <div
              key={i}
              className="flex-1"
              style={{ backgroundColor: getDepartmentColor(ratio * maxSchoolCount, maxSchoolCount) }}
            />
          ))}
        </div>
        <span>Plus</span>
        <span className="text-slate-400 ml-1">Écoles par département — tous statuts</span>
      </div>
    </div>
  );
}
