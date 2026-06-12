'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Network, Building2, Users, ChevronRight, ChevronDown,
  Loader2, RefreshCw, Crown, UserCheck, UserX, LayoutGrid,
  GraduationCap, Briefcase, UserCog, Shield, DollarSign,
  Monitor, Megaphone, Heart, BookOpen, FlaskConical, Bus,
  UtensilsCrossed, Wrench, Lock, Sparkles, Plus, X,
  Search, Eye,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const PRIMARY = '#1A2BA6';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrganigramStaff {
  id: string;
  firstName: string;
  lastName: string;
  position: string | null;
  employeeNumber: string;
  phone: string | null;
  email: string | null;
}

interface OrganigramNode {
  id: string;
  title: string;
  type: string;       // ROOT, DEPARTMENT, SERVICE, POSITION
  level: number;
  order: number;
  schoolLevelCode: string | null;
  staffId: string | null;
  metadata: any;
  isActive: boolean;
  staff?: OrganigramStaff | null;
  children: OrganigramNode[];
}

interface OrganigramStats {
  totalNodes: number;
  departments: number;
  services: number;
  positions: number;
  assignedPositions: number;
  unassignedPositions: number;
  occupancyRate: number;
}

// ─── Icon mapping ─────────────────────────────────────────────────────────────

const DEPARTMENT_ICONS: Record<string, any> = {
  'Gouvernance et Direction': Crown,
  'Direction Pédagogique': GraduationCap,
  'Départements Disciplinaires': BookOpen,
  'Vie Scolaire et Discipline': Shield,
  'Administration': Building2,
  'Département Financier et Comptable': DollarSign,
  'Ressources Humaines': Users,
  'Informatique et Transformation Digitale': Monitor,
  'Communication et Marketing': Megaphone,
  'Santé et Bien-être': Heart,
  'Bibliothèque et Documentation': BookOpen,
  'Laboratoires': FlaskConical,
  'Transport Scolaire': Bus,
  'Restauration': UtensilsCrossed,
  'Patrimoine et Maintenance': Wrench,
  'Sécurité': Lock,
  'Entretien et Hygiène': Sparkles,
};

// ─── School Level Filter Options ──────────────────────────────────────────────

const SCHOOL_LEVEL_OPTIONS = [
  { code: 'ALL', label: 'Organigramme Complet', shortLabel: 'Complet' },
  { code: 'MAT', label: 'Maternelle', shortLabel: 'Maternelle' },
  { code: 'PRI', label: 'Primaire', shortLabel: 'Primaire' },
  { code: 'SEC', label: 'Secondaire', shortLabel: 'Secondaire' },
  { code: 'MAT_PRI', label: 'Maternelle + Primaire', shortLabel: 'Mat. + Pri.' },
  { code: 'ADMIN', label: 'Organigramme Administratif', shortLabel: 'Administratif' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function OrganigramWorkspace() {
  const { tenant } = useModuleContext();
  const [tree, setTree] = useState<OrganigramNode[]>([]);
  const [stats, setStats] = useState<OrganigramStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [schoolLevelCode, setSchoolLevelCode] = useState('ALL');
  const [viewMode, setViewMode] = useState<'tree' | 'cards'>('tree');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isSeeded, setIsSeeded] = useState(true);

  const fetchTree = useCallback(async () => {
    if (!tenant?.id) {
      setTree([]);
      setIsSeeded(false);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const queryParams: Record<string, string> = {};
      if (schoolLevelCode && schoolLevelCode !== 'ALL') {
        queryParams.schoolLevelCode = schoolLevelCode;
      }
      const data = await hrFetch<OrganigramNode[]>(hrUrl('organigram/tree', queryParams));
      setTree(data);
      setIsSeeded(data.length > 0);

      // Auto-expand root and first level
      const expanded = new Set<string>();
      if (data.length > 0) {
        expanded.add(data[0].id);
        data[0].children?.forEach(c => expanded.add(c.id));
      }
      setExpandedNodes(expanded);
    } catch (err) {
      console.error('Error fetching organigram:', err);
      setTree([]);
      setIsSeeded(false);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, schoolLevelCode]);

  const fetchStats = useCallback(async () => {
    if (!tenant?.id) return;
    try {
      const data = await hrFetch<OrganigramStats>(hrUrl('organigram/stats'));
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, [tenant?.id]);

  useEffect(() => { fetchTree(); fetchStats(); }, [fetchTree, fetchStats]);

  const handleSeed = async () => {
    if (!tenant?.id) {
      toast({ variant: 'error', title: 'Veuillez sélectionner un établissement avant d\'initialiser l\'organigramme.' });
      return;
    }
    try {
      setSeeding(true);
      const result = await hrFetch<{ created: number }>(hrUrl('organigram/seed'), { method: 'POST' });
      if (result.created === 0) {
        toast({ variant: 'info', title: 'L\'organigramme est déjà initialisé.' });
      } else {
        toast({ variant: 'success', title: `Organigramme initialisé : ${result.created} postes créés` });
      }
      fetchTree();
      fetchStats();
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('Tenant ID requis') || msg.includes('établissement')) {
        toast({ variant: 'error', title: 'Veuillez sélectionner un établissement avant d\'initialiser l\'organigramme.' });
      } else {
        toast({ variant: 'error', title: 'Erreur lors de l\'initialisation', description: msg || 'Une erreur inattendue est survenue. Veuillez réessayer.' });
      }
    } finally {
      setSeeding(false);
    }
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const getColor = (node: OrganigramNode): string => {
    if (node.metadata?.color) return node.metadata.color;
    if (node.type === 'ROOT') return PRIMARY;
    if (node.type === 'DEPARTMENT') return '#4F46E5';
    if (node.type === 'SERVICE') return '#0891B2';
    return '#64748B';
  };

  const getNodeIcon = (node: OrganigramNode) => {
    if (node.type === 'ROOT') return Building2;
    if (node.type === 'DEPARTMENT') {
      return DEPARTMENT_ICONS[node.title] || Briefcase;
    }
    if (node.type === 'SERVICE') return Users;
    return UserCheck;
  };

  // Filter nodes by search
  const matchesSearch = (node: OrganigramNode): boolean => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (node.title.toLowerCase().includes(q)) return true;
    if (node.staff && `${node.staff.firstName} ${node.staff.lastName}`.toLowerCase().includes(q)) return true;
    return node.children?.some(c => matchesSearch(c)) || false;
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" style={{ color: PRIMARY }} />
          <p className="text-sm text-slate-500 font-medium">Chargement de l&apos;organigramme…</p>
        </div>
      </div>
    );
  }

  // Not seeded yet — show seed button
  if (!isSeeded && tree.length === 0) {
    const noTenant = !tenant?.id;
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center">
          <Network className="h-10 w-10 text-slate-300" />
        </div>
        <div className="text-center space-y-2 max-w-md">
          <h3 className="text-lg font-bold text-slate-800">
            {noTenant ? 'Aucun établissement sélectionné' : 'Organigramme non initialisé'}
          </h3>
          <p className="text-sm text-slate-500">
            {noTenant
              ? 'Veuillez sélectionner un établissement dans le sélecteur en haut de page pour accéder à l\'organigramme.'
              : 'Initialisez l\'organigramme professionnel de votre établissement avec la structure complète couvrant les départements, services et postes.'}
          </p>
        </div>
        {!noTenant && (
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white rounded-xl shadow-sm hover:opacity-90 disabled:opacity-50 transition"
            style={{ backgroundColor: PRIMARY }}
          >
            {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Network className="h-4 w-4" />}
            Initialiser l&apos;organigramme
          </button>
        )}
        {!noTenant && (
          <p className="text-[10px] text-slate-400 mt-2">
            Structure complète : 17 départements, 40+ services, 100+ postes
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI Strip */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Départements', value: stats.departments, icon: Building2, color: '#4F46E5' },
            { label: 'Services', value: stats.services, icon: Users, color: '#0891B2' },
            { label: 'Postes', value: stats.positions, icon: Briefcase, color: '#64748B' },
            { label: 'Pourvus', value: stats.assignedPositions, icon: UserCheck, color: '#059669' },
            { label: 'Vacants', value: stats.unassignedPositions, icon: UserX, color: '#DC2626' },
            { label: 'Taux occupation', value: `${stats.occupancyRate}%`, icon: LayoutGrid, color: PRIMARY },
            { label: 'Total nœuds', value: stats.totalNodes, icon: Network, color: '#7C3AED' },
          ].map((k, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
              <div className="flex items-center gap-2">
                <k.icon className="h-3.5 w-3.5 shrink-0" style={{ color: k.color }} />
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{k.label}</p>
              </div>
              <p className="text-lg font-bold text-slate-900 mt-1">{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-grow md:flex-grow-0 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un poste ou employé…"
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10 shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10 shadow-sm"
            value={schoolLevelCode}
            onChange={(e) => setSchoolLevelCode(e.target.value)}
          >
            {SCHOOL_LEVEL_OPTIONS.map(opt => (
              <option key={opt.code} value={opt.code}>{opt.label}</option>
            ))}
          </select>
          <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <button
              onClick={() => setViewMode('tree')}
              className={cn('px-3 py-2.5 text-xs font-semibold transition', viewMode === 'tree' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50')}
            >
              Arbre
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={cn('px-3 py-2.5 text-xs font-semibold transition', viewMode === 'cards' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50')}
            >
              Cartes
            </button>
          </div>
        </div>
        <button
          onClick={() => { fetchTree(); fetchStats(); }}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Actualiser
        </button>
      </div>

      {/* Organigram Content */}
      {tree.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-xl border border-slate-200">
          <Network className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">Aucun nœud trouvé pour ce filtre</p>
          <p className="text-xs text-slate-400 mt-1">Essayez un autre niveau scolaire</p>
        </div>
      ) : viewMode === 'tree' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 overflow-x-auto">
          {tree.map(rootNode => (
            <TreeNode
              key={rootNode.id}
              node={rootNode}
              expandedNodes={expandedNodes}
              onToggle={toggleNode}
              getColor={getColor}
              getNodeIcon={getNodeIcon}
              searchQuery={searchQuery}
              matchesSearch={matchesSearch}
              depth={0}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tree[0]?.children
            ?.filter(d => matchesSearch(d))
            .map(dept => (
              <DepartmentCard
                key={dept.id}
                node={dept}
                getColor={getColor}
                getNodeIcon={getNodeIcon}
                searchQuery={searchQuery}
                matchesSearch={matchesSearch}
              />
            ))}
        </div>
      )}
    </div>
  );
}

// ─── Tree Node Component ─────────────────────────────────────────────────────

function TreeNode({
  node,
  expandedNodes,
  onToggle,
  getColor,
  getNodeIcon,
  searchQuery,
  matchesSearch,
  depth,
}: {
  node: OrganigramNode;
  expandedNodes: Set<string>;
  onToggle: (id: string) => void;
  getColor: (n: OrganigramNode) => string;
  getNodeIcon: (n: OrganigramNode) => any;
  searchQuery: string;
  matchesSearch: (n: OrganigramNode) => boolean;
  depth: number;
}) {
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const color = getColor(node);
  const Icon = getNodeIcon(node);
  const filteredChildren = node.children?.filter(c => matchesSearch(c)) || [];
  const isHighlighted = searchQuery && (
    node.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (node.staff && `${node.staff.firstName} ${node.staff.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (searchQuery && !matchesSearch(node)) return null;

  return (
    <div className={cn(depth === 0 && 'mb-2')}>
      {/* Node Row */}
      <div
        className={cn(
          'flex items-center gap-2 py-2 px-3 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors group',
          isHighlighted && 'bg-amber-50 ring-1 ring-amber-200',
          depth === 0 && 'bg-slate-50 hover:bg-slate-100',
        )}
        style={{ marginLeft: depth > 0 ? `${depth * 24}px` : 0 }}
        onClick={() => hasChildren && onToggle(node.id)}
      >
        {/* Expand/Collapse toggle */}
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
          )
        ) : (
          <div className="w-4 shrink-0" />
        )}

        {/* Color indicator */}
        <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: color }} />

        {/* Icon */}
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
            node.type === 'ROOT' && 'w-9 h-9',
            node.type === 'DEPARTMENT' && 'w-8 h-8',
            node.type === 'SERVICE' && 'w-7 h-7',
            node.type === 'POSITION' && 'w-6 h-6',
          )}
          style={{ backgroundColor: color + '15', color }}
        >
          <Icon className={cn(
            node.type === 'ROOT' ? 'h-5 w-5' :
            node.type === 'DEPARTMENT' ? 'h-4 w-4' :
            node.type === 'SERVICE' ? 'h-3.5 w-3.5' :
            'h-3 w-3',
          )} />
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              'font-semibold truncate',
              node.type === 'ROOT' && 'text-base text-slate-900',
              node.type === 'DEPARTMENT' && 'text-sm text-slate-800',
              node.type === 'SERVICE' && 'text-sm text-slate-700',
              node.type === 'POSITION' && 'text-[13px] text-slate-600',
            )}>
              {node.title}
            </span>
            {node.type === 'DEPARTMENT' && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border"
                style={{ borderColor: color + '40', color, backgroundColor: color + '10' }}>
                {filteredChildren.length} services
              </span>
            )}
          </div>
          {/* Assigned staff */}
          {node.staff && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0"
                style={{ backgroundColor: color + '15', color }}>
                {node.staff.firstName?.[0]}{node.staff.lastName?.[0]}
              </div>
              <span className="text-[11px] text-slate-500 font-medium truncate">
                {node.staff.firstName} {node.staff.lastName}
              </span>
              <span className="text-[9px] text-slate-400">· {node.staff.employeeNumber}</span>
            </div>
          )}
        </div>

        {/* Type badge */}
        {node.type !== 'ROOT' && (
          <span className={cn(
            'text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0',
            node.type === 'DEPARTMENT' && 'bg-indigo-50 text-indigo-600',
            node.type === 'SERVICE' && 'bg-cyan-50 text-cyan-600',
            node.type === 'POSITION' && node.staff ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400',
          )}>
            {node.type === 'DEPARTMENT' ? 'Dépt.' :
             node.type === 'SERVICE' ? 'Serv.' :
             node.staff ? 'Pourvu' : 'Vacant'}
          </span>
        )}
      </div>

      {/* Children */}
      <AnimatePresence>
        {isExpanded && filteredChildren.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            {filteredChildren.map(child => (
              <TreeNode
                key={child.id}
                node={child}
                expandedNodes={expandedNodes}
                onToggle={onToggle}
                getColor={getColor}
                getNodeIcon={getNodeIcon}
                searchQuery={searchQuery}
                matchesSearch={matchesSearch}
                depth={depth + 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Department Card Component ───────────────────────────────────────────────

function DepartmentCard({
  node,
  getColor,
  getNodeIcon,
  searchQuery,
  matchesSearch,
}: {
  node: OrganigramNode;
  getColor: (n: OrganigramNode) => string;
  getNodeIcon: (n: OrganigramNode) => any;
  searchQuery: string;
  matchesSearch: (n: OrganigramNode) => boolean;
}) {
  const color = getColor(node);
  const Icon = getNodeIcon(node);
  const totalPositions = node.children?.reduce((sum, s) => sum + (s.children?.length || 0), 0) || 0;
  const filledPositions = node.children?.reduce((sum, s) =>
    sum + (s.children?.filter(p => p.staff).length || 0), 0) || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100" style={{ backgroundColor: color + '08' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '15', color }}>
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm text-slate-800 truncate">{node.title}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {filledPositions}/{totalPositions} postes pourvus
            </p>
          </div>
        </div>
      </div>

      {/* Services list */}
      <div className="p-3 space-y-2">
        {node.children?.filter(s => matchesSearch(s)).map(service => (
          <div key={service.id} className="space-y-1.5">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50">
              <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-700">{service.title}</span>
              <span className="text-[9px] text-slate-400 ml-auto">
                {service.children?.filter(p => p.staff).length || 0}/{service.children?.length || 0}
              </span>
            </div>
            <div className="space-y-1 pl-3">
              {service.children?.filter(p => matchesSearch(p)).map(position => (
                <div key={position.id}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px]',
                    position.staff ? 'bg-white border border-slate-100' : 'bg-slate-50/50 border border-dashed border-slate-200',
                  )}
                >
                  {position.staff ? (
                    <>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold shrink-0"
                        style={{ backgroundColor: color + '15', color }}>
                        {position.staff.firstName?.[0]}{position.staff.lastName?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-slate-700 font-medium">{position.staff.firstName} {position.staff.lastName}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <UserX className="h-3 w-3 text-slate-300 shrink-0" />
                      <span className="text-slate-400">{position.title}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
