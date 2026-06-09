'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, GraduationCap, Users, BookOpen } from 'lucide-react';
import { BENIN_DEPARTMENTS, type DepartmentData as ExternalDepartmentData } from '@/data/benin-departments';

/* ─── Benin 12 departments with exact SVG paths from emp.educmaster.bj ─── */
interface DepartmentData {
  id: string;
  name: string;
  path: string;
  labelX: number;
  labelY: number;
  labelSize: number;
  schoolCount: number;
  publicCount: number;
  privateCount: number;
  teacherCount: number;
  learnerCount: number;
  femalePercent: number;
}

/**
 * Geographically accurate SVG paths for Benin's 12 departments.
 * These paths are extracted from the official MEMP/EducMaster portal (emp.educmaster.bj).
 * ViewBox: 0 0 320 600 — captures Benin's characteristic shape (wide north, narrow center, wider south coast).
 *
 * Department layout (north to south):
 *   Top row: ALIBORI (NE - largest), ATACORA (NW)
 *   2nd row: BORGOU (E - large), DONGA (W - small)
 *   Center: COLLINES (W-center), PLATEAU (E-center)
 *   South-center: ZOU (center-south), COUFFO (SW)
 *   Coast: OUÉMÉ (SE), ATLANTIQUE (center-south coast), LITTORAL (tiny - Cotonou), MONO (SW coast)
 */
const DEPARTMENTS: DepartmentData[] = [
  {
    id: 'alibori',
    name: 'ALIBORI',
    path: 'M 122.5 101.3 L 132.4 101.9 L 148.5 85.8 L 151.3 85.4 L 160.1 78.6 L 159.3 74.7 L 163.2 68.3 L 165.4 67.6 L 165.6 65.1 L 167.2 64.2 L 166.1 63.0 L 168.9 60.4 L 168.4 58.2 L 169.9 57.0 L 167.9 54.6 L 169.6 52.4 L 171.9 52.2 L 172.1 50.4 L 174.4 50.0 L 167.9 37.7 L 166.8 24.4 L 175.0 24.1 L 179.6 21.0 L 182.6 22.3 L 194.4 19.4 L 196.1 21.8 L 199.9 13.9 L 202.1 15.4 L 205.3 11.4 L 210.0 10.0 L 219.7 21.0 L 225.9 23.0 L 230.1 30.5 L 237.2 36.6 L 240.6 37.7 L 244.5 43.8 L 246.8 44.2 L 250.6 53.8 L 254.9 58.8 L 260.5 58.4 L 266.6 61.8 L 269.5 61.1 L 274.2 66.1 L 274.6 69.0 L 277.6 69.5 L 276.7 74.1 L 282.3 77.0 L 276.7 85.6 L 271.3 114.5 L 292.1 130.0 L 292.2 139.4 L 296.2 141.8 L 296.9 150.2 L 294.8 159.1 L 297.1 161.7 L 298.0 166.1 L 154.6 149.6 L 122.5 101.3 Z',
    labelX: 220.2, labelY: 95.3, labelSize: 9,
    schoolCount: 1713, publicCount: 1444, privateCount: 269,
    teacherCount: 7244, learnerCount: 252544, femalePercent: 44.2,
  },
  {
    id: 'atacora',
    name: 'ATACORA',
    path: 'M 154.6 149.6 L 140.3 213.9 L 64.2 232.9 L 46.6 222.3 L 16.2 200.8 L 16.7 186.9 L 19.1 182.3 L 18.8 168.2 L 25.6 160.9 L 26.5 155.0 L 28.1 154.1 L 26.8 149.4 L 29.8 140.1 L 32.4 138.7 L 35.0 133.5 L 37.8 134.0 L 39.8 137.8 L 42.7 136.6 L 47.7 139.1 L 42.2 128.6 L 49.3 125.8 L 51.4 126.9 L 51.5 121.1 L 49.2 118.1 L 50.9 116.6 L 60.4 118.9 L 63.2 117.8 L 61.2 112.1 L 67.8 114.7 L 69.3 112.3 L 66.7 108.3 L 73.6 104.4 L 73.2 100.9 L 79.2 97.1 L 83.5 99.3 L 84.3 97.5 L 84.6 99.2 L 87.8 99.5 L 88.7 97.5 L 94.7 104.9 L 115.9 101.1 L 122.5 101.3 L 154.6 149.6 Z',
    labelX: 79.3, labelY: 189.2, labelSize: 9,
    schoolCount: 1276, publicCount: 1105, privateCount: 171,
    teacherCount: 4828, learnerCount: 183526, femalePercent: 44.8,
  },
  {
    id: 'borgou',
    name: 'BORGOU',
    path: 'M 185.7 318.3 L 140.3 213.9 L 154.6 149.6 L 298.0 166.1 L 298.4 168.0 L 301.5 168.7 L 303.3 170.7 L 303.8 180.7 L 301.0 188.2 L 300.4 195.2 L 298.5 198.0 L 289.0 192.8 L 284.0 196.1 L 279.3 210.8 L 282.0 216.4 L 288.2 219.2 L 287.0 225.6 L 282.7 228.3 L 281.3 239.4 L 276.9 243.9 L 277.1 245.6 L 272.7 248.9 L 257.2 252.4 L 255.0 258.9 L 259.0 264.3 L 253.6 268.5 L 249.1 268.7 L 247.7 274.1 L 237.1 288.6 L 239.5 303.6 L 236.2 308.3 L 233.6 320.1 L 215.8 324.6 L 207.9 324.6 L 185.7 318.3 Z',
    labelX: 206.1, labelY: 217.4, labelSize: 9,
    schoolCount: 1705, publicCount: 1416, privateCount: 289,
    teacherCount: 6957, learnerCount: 278899, femalePercent: 44.3,
  },
  {
    id: 'donga',
    name: 'DONGA',
    path: 'M 140.3 213.9 L 185.7 318.3 L 95.8 349.2 L 95.5 328.6 L 93.8 320.5 L 90.0 313.7 L 83.4 308.9 L 77.5 302.0 L 75.7 298.4 L 73.6 284.0 L 70.9 284.2 L 68.7 279.2 L 71.6 274.0 L 72.4 268.8 L 71.1 258.0 L 72.1 254.8 L 70.2 236.6 L 64.2 232.9 L 140.3 213.9 Z',
    labelX: 98.1, labelY: 264.4, labelSize: 9,
    schoolCount: 909, publicCount: 798, privateCount: 111,
    teacherCount: 3543, learnerCount: 140697, femalePercent: 44.6,
  },
  {
    id: 'collines',
    name: 'COLLINES',
    path: 'M 185.7 318.3 L 207.9 324.6 L 204.8 324.6 L 202.2 345.6 L 199.9 352.0 L 201.5 357.6 L 202.1 376.2 L 200.2 382.1 L 198.0 383.9 L 196.1 391.9 L 196.1 397.0 L 201.7 404.7 L 194.6 434.2 L 199.0 442.9 L 161.5 461.6 L 97.0 447.3 L 96.5 390.5 L 94.7 389.4 L 96.3 381.5 L 99.0 377.3 L 95.7 372.3 L 95.8 349.2 L 185.7 318.3 Z',
    labelX: 149.7, labelY: 395, labelSize: 9,
    schoolCount: 1196, publicCount: 1017, privateCount: 179,
    teacherCount: 4595, learnerCount: 199070, femalePercent: 46.0,
  },
  {
    id: 'plateau',
    name: 'PLATEAU',
    path: 'M 164.1 525.0 L 161.5 523.2 L 161.5 461.6 L 199.0 442.9 L 199.9 444.8 L 197.6 457.3 L 201.1 467.8 L 205.0 470.3 L 205.6 477.9 L 200.7 479.1 L 202.9 505.8 L 201.0 508.9 L 202.4 513.8 L 197.7 522.5 L 200.6 525.0 L 164.1 525.0 Z',
    labelX: 192, labelY: 499.2, labelSize: 8,
    schoolCount: 928, publicCount: 798, privateCount: 130,
    teacherCount: 3499, learnerCount: 139758, femalePercent: 47.4,
  },
  {
    id: 'zou',
    name: 'ZOU',
    path: 'M 161.5 461.6 L 161.5 523.2 L 138.6 530.3 L 97.3 489.0 L 98.5 467.9 L 97.0 447.3 L 161.5 461.6 Z',
    labelX: 131, labelY: 499.2, labelSize: 9,
    schoolCount: 1407, publicCount: 1177, privateCount: 230,
    teacherCount: 5633, learnerCount: 217438, femalePercent: 47.2,
  },
  {
    id: 'couffo',
    name: 'COUFFO',
    path: 'M 138.6 530.3 L 127.8 542.4 L 94.5 537.6 L 92.8 536.3 L 94.5 534.4 L 93.4 533.7 L 93.6 526.9 L 91.8 525.8 L 89.4 518.4 L 97.3 518.4 L 97.3 489.0 L 138.6 530.3 Z',
    labelX: 107.5, labelY: 522.7, labelSize: 7,
    schoolCount: 866, publicCount: 742, privateCount: 124,
    teacherCount: 3819, learnerCount: 128404, femalePercent: 47.0,
  },
  {
    id: 'mono',
    name: 'MONO',
    path: 'M 127.8 542.4 L 123.6 584.9 L 96.4 590.0 L 102.4 587.3 L 112.4 585.5 L 110.5 575.7 L 108.3 573.4 L 109.8 571.8 L 106.0 566.2 L 102.6 564.6 L 102.0 560.2 L 94.8 554.0 L 93.8 551.4 L 95.1 550.6 L 91.2 547.3 L 93.0 543.0 L 95.4 542.6 L 94.5 537.6 L 127.8 542.4 Z',
    labelX: 102.8, labelY: 567, labelSize: 7,
    schoolCount: 795, publicCount: 670, privateCount: 125,
    teacherCount: 3346, learnerCount: 124836, femalePercent: 47.8,
  },
  {
    id: 'atlantique',
    name: 'ATLANT.',
    path: 'M 161.5 523.2 L 164.1 525.0 L 170.9 555.5 L 151.0 580.9 L 123.6 584.9 L 127.8 542.4 L 138.6 530.3 L 161.5 523.2 Z',
    labelX: 149.7, labelY: 560.3, labelSize: 7,
    schoolCount: 1639, publicCount: 1085, privateCount: 554,
    teacherCount: 8210, learnerCount: 372636, femalePercent: 48.2,
  },
  {
    id: 'oueme',
    name: 'OUEME',
    path: 'M 170.9 555.5 L 164.1 525.0 L 201.3 525.7 L 199.7 538.1 L 202.6 540.4 L 205.0 540.1 L 204.3 547.3 L 199.2 552.7 L 201.2 558.5 L 197.6 563.5 L 197.5 576.5 L 170.9 555.5 Z',
    labelX: 187, labelY: 550.9, labelSize: 7,
    schoolCount: 1406, publicCount: 883, privateCount: 523,
    teacherCount: 6324, learnerCount: 302843, femalePercent: 47.6,
  },
  {
    id: 'littoral',
    name: 'LITTORAL',
    path: 'M 197.5 576.5 L 173.6 579.0 L 170.9 580.6 L 151.0 580.9 L 170.9 555.5 L 197.5 576.5 Z',
    labelX: 176, labelY: 572, labelSize: 6,
    schoolCount: 769, publicCount: 297, privateCount: 472,
    teacherCount: 5236, learnerCount: 202289, femalePercent: 48.8,
  },
];

/* ─── Color scale: blue gradient based on school count (matching emp.educmaster.bj) ─── */
const COLOR_SCALE = [
  '#c8d6ea', // lightest — lowest count
  '#a8bedb',
  '#7c9bc8',
  '#5d82b8',
  '#3a619e',
  '#1a3666', // darkest — highest count
];

function getDepartmentColorIndex(count: number, maxCount: number): number {
  const ratio = Math.min(count / maxCount, 1);
  return Math.min(Math.floor(ratio * COLOR_SCALE.length), COLOR_SCALE.length - 1);
}

function getDepartmentColor(count: number, maxCount: number): string {
  return COLOR_SCALE[getDepartmentColorIndex(count, maxCount)];
}

type FilterType = 'all' | 'public' | 'private';

interface BeninMapProps {
  onDepartmentSelect?: (dept: ExternalDepartmentData | null) => void;
  selectedDepartment?: ExternalDepartmentData | null;
  filter?: FilterType;
}

/** Map internal department IDs to external department codes for cross-referencing */
const INTERNAL_TO_EXTERNAL_CODE: Record<string, string> = {
  alibori: 'AL',
  atacora: 'AT',
  borgou: 'BO',
  donga: 'DO',
  collines: 'CO',
  plateau: 'PL',
  zou: 'ZO',
  couffo: 'KO',
  mono: 'MO',
  atlantique: 'AQ',
  oueme: 'OU',
  littoral: 'LI',
};

export default function BeninMap({ onDepartmentSelect, selectedDepartment, filter: externalFilter }: BeninMapProps) {
  const [hoveredDept, setHoveredDept] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [internalFilter, setInternalFilter] = useState<FilterType>('all');

  // Use external filter when provided, otherwise use internal state
  const filter = externalFilter ?? internalFilter;

  // Sync external selectedDepartment with internal selected state
  useEffect(() => {
    if (selectedDepartment) {
      const match = DEPARTMENTS.find(d => {
        const code = INTERNAL_TO_EXTERNAL_CODE[d.id];
        return code && code === selectedDepartment.code;
      });
      setSelectedDept(match?.id ?? null);
    } else {
      setSelectedDept(null);
    }
  }, [selectedDepartment]);

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

  // Compute color based on filter
  const getDeptFillColor = useCallback((dept: DepartmentData) => {
    const count = getFilteredCount(dept);
    return getDepartmentColor(count, maxSchoolCount);
  }, [getFilteredCount, maxSchoolCount]);

  const publicPercent = (dept: DepartmentData) =>
    dept.schoolCount > 0 ? ((dept.publicCount / dept.schoolCount) * 100).toFixed(1) : '0';
  const privatePercent = (dept: DepartmentData) =>
    dept.schoolCount > 0 ? ((dept.privateCount / dept.schoolCount) * 100).toFixed(1) : '0';

  // Progress bar dots for department navigation (like emp.educmaster.bj)
  const activeDeptIndex = activeDept ? DEPARTMENTS.findIndex(d => d.id === activeDept.id) + 1 : 0;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-slate-900" style={{ color: '#1E3A5F' }}>
          La maternelle et le primaire en un coup d&apos;œil
        </h2>

        {/* Stats strip */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <BookOpen className="h-4 w-4 text-blue-500" />
            <span className="text-blue-700">{totals.schools.toLocaleString('fr-FR')}</span>
            <span className="text-slate-500 font-normal">écoles</span>
          </div>
          <div className="text-slate-300 hidden sm:inline">•</div>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <Users className="h-4 w-4 text-violet-500" />
            <span className="text-violet-700">{totals.learners.toLocaleString('fr-FR')}</span>
            <span className="text-slate-500 font-normal">apprenants</span>
          </div>
          <div className="text-slate-300 hidden sm:inline">•</div>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <GraduationCap className="h-4 w-4 text-emerald-500" />
            <span className="text-emerald-700">{totals.teachers.toLocaleString('fr-FR')}</span>
            <span className="text-slate-500 font-normal">enseignants</span>
          </div>
        </div>
      </div>

      {/* Filter tabs — only show when no external filter is provided */}
      {!externalFilter && (
      <div className="mb-5 flex justify-center">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {[
            { key: 'all' as FilterType, label: 'Tous' },
            { key: 'public' as FilterType, label: 'Public' },
            { key: 'private' as FilterType, label: 'Privé' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setInternalFilter(tab.key)}
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
      )}

      {/* Map + Info Panel — same row layout as emp.educmaster.bj */}
      <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6 justify-center">
        {/* SVG Map */}
        <div className="relative w-full max-w-xs sm:max-w-sm">
          <svg
            viewBox="0 0 320 600"
            className="w-full h-auto"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Carte du Bénin par département"
            style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.08))' }}
          >
            {DEPARTMENTS.map(dept => {
              const isHovered = hoveredDept === dept.id;
              const isSelected = selectedDept === dept.id;
              const fillColor = getDeptFillColor(dept);
              const isDark = getDepartmentColorIndex(dept.schoolCount, maxSchoolCount) >= 4;

              return (
                <g
                  key={dept.id}
                  onMouseEnter={() => setHoveredDept(dept.id)}
                  onMouseLeave={() => setHoveredDept(null)}
                  onClick={() => {
                    const newSelectedId = isSelected ? null : dept.id;
                    setSelectedDept(newSelectedId);
                    if (onDepartmentSelect) {
                      if (newSelectedId) {
                        const code = INTERNAL_TO_EXTERNAL_CODE[newSelectedId];
                        const externalDept = code
                          ? BENIN_DEPARTMENTS.find(d => d.code === code) ?? null
                          : null;
                        onDepartmentSelect(externalDept);
                      } else {
                        onDepartmentSelect(null);
                      }
                    }
                  }}
                  className="cursor-pointer"
                  role="button"
                  aria-label={`Département ${dept.name}`}
                >
                  <path
                    d={dept.path}
                    fill={fillColor}
                    stroke={isHovered || isSelected ? '#ffffff' : '#fff'}
                    strokeWidth={isHovered || isSelected ? 2.5 : 1.2}
                    className="transition-all duration-200"
                    style={{
                      filter: isHovered || isSelected
                        ? 'brightness(1.15) drop-shadow(0 3px 6px rgba(0,0,0,0.25))'
                        : 'none',
                    }}
                  />
                  {/* Department label */}
                  <text
                    x={dept.labelX}
                    y={dept.labelY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isDark ? '#ffffff' : '#1e293b'}
                    fontSize={dept.labelSize}
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
        </div>

        {/* Side info panel — styled like emp.educmaster.bj */}
        <AnimatePresence mode="wait">
          {activeDept ? (
            <motion.div
              key={activeDept.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden"
            >
              {/* Progress dots */}
              <div className="flex items-center justify-center gap-1.5 px-5 pt-4 pb-2" aria-hidden>
                {DEPARTMENTS.map((_, i) => (
                  <span
                    key={i}
                    className={`inline-block h-1.5 w-1.5 rounded-full transition-colors ${
                      i + 1 === activeDeptIndex ? 'bg-blue-600 scale-125' : 'bg-slate-300'
                    }`}
                  />
                ))}
              </div>

              {/* Department eyebrow */}
              <div className="px-5 pb-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Département <span className="text-slate-500">({activeDeptIndex}/12)</span>
                </p>
              </div>

              {/* Department name */}
              <div className="px-5 pb-3">
                <h3 className="text-xl font-extrabold uppercase tracking-wide" style={{ color: '#1a3666' }}>
                  {activeDept.name}
                </h3>
              </div>

              {/* Stats table */}
              <div className="px-5 pb-3">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-2 text-slate-500 font-medium">Écoles</td>
                      <td className="py-2 text-right font-bold text-slate-800">
                        {activeDept.schoolCount.toLocaleString('fr-FR')}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-2 text-slate-500 font-medium">Apprenants</td>
                      <td className="py-2 text-right font-bold text-slate-800">
                        {activeDept.learnerCount.toLocaleString('fr-FR')}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-2 text-slate-500 font-medium">Enseignants</td>
                      <td className="py-2 text-right font-bold text-slate-800">
                        {activeDept.teacherCount.toLocaleString('fr-FR')}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-500 font-medium">% Filles</td>
                      <td className="py-2 text-right font-bold text-slate-800">
                        {activeDept.femalePercent.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} %
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Public / Private split */}
              <div className="px-5 pb-4 flex items-center gap-4 text-xs">
                <span>
                  <strong className="text-slate-700">Public</strong>{' '}
                  {activeDept.publicCount.toLocaleString('fr-FR')} · {publicPercent(activeDept)} %
                </span>
                <span>
                  <strong className="text-slate-700">Privé</strong>{' '}
                  {activeDept.privateCount.toLocaleString('fr-FR')} · {privatePercent(activeDept)} %
                </span>
              </div>

              {/* Color indicator bar */}
              <div
                className="h-1.5"
                style={{ backgroundColor: getDeptFillColor(activeDept) }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty-panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white/80 shadow-sm overflow-hidden"
            >
              <div className="p-6 text-center">
                <MapPin className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-600">
                  Survolez ou cliquez sur un département
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  pour voir les statistiques détaillées
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500">
        <span>Moins</span>
        <div className="flex h-3 w-32 rounded overflow-hidden">
          {COLOR_SCALE.map((color, i) => (
            <div
              key={i}
              className="flex-1"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <span>Plus</span>
        <span className="text-slate-400 ml-1">Écoles par département</span>
      </div>
    </div>
  );
}
