/**
 * Icon System - Academia Hub
 * 
 * Charte Iconographique Officielle v1.0
 * 
 * POSITIONNEMENT :
 * - Institutionnel
 * - Premium
 * - Sobre
 * - Intemporel
 * - Autorité silencieuse
 * 
 * RÈGLE D'OR :
 * Une icône = une fonction. Jamais une émotion.
 * 
 * INTERDICTIONS STRICTES :
 * - ❌ Aucun emoji Unicode
 * - ❌ Aucune icône importée directement depuis lucide-react
 * - ❌ Aucune icône cartoon ou fantaisie
 * - ❌ Aucune icône colorée par défaut
 * - ❌ Aucun dégradé
 * - ❌ Aucune animation décorative
 */

import {
  // Modules principaux
  LayoutDashboard,
  GraduationCap,
  Users,
  School,
  ClipboardCheck,
  FileBarChart,
  Wallet,
  CreditCard,
  Briefcase,
  CalendarCheck,
  Utensils,
  ShoppingBag,
  Megaphone,
  FileText,
  Settings,
  
  // Modules supplémentaires
  BookOpen,
  Beaker,
  Bus,
  Activity,
  Shield,
  Video,
  
  // ORION & Direction
  Compass,
  BarChart3,
  Layers,
  TrendingUp,
  Clock,
  Eye,
  
  // Alertes & KPI
  Info,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  XCircle,
  
  // Navigation & Actions (utilitaires)
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Plus,
  Minus,
  Edit,
  Trash2,
  Save,
  Download,
  Upload,
  Lock,
  Unlock,
  RefreshCw,
  Check,
  LogOut,
  LogIn,
  User,
  UserPlus,
  Mail,
  Phone,
  Bell,
  
  // Icônes supplémentaires pour landing page
  Wifi,
  ShieldCheck,
  Tag,
  Building2,
  FileSpreadsheet,
  Network,
  Globe,
  Sparkles,
  ArrowRight,
  Play,
  MessageCircle,
  Send,
  Star,
  
  // Social Media Icons
  Facebook,
  Linkedin,
  Youtube,
  
  // Type from lucide-react
  LucideIcon,
} from 'lucide-react';

/**
 * Mapping officiel des icônes par module
 * 
 * RÉFÉRENCE UNIQUE - À NE JAMAIS CONTOURNER
 */
export const IconMapping = {
  // Modules principaux
  dashboard: LayoutDashboard,
  scolarite: GraduationCap,
  students: Users,
  classes: School,
  exams: ClipboardCheck,
  grades: FileBarChart,
  finance: Wallet,
  payments: CreditCard,
  rh: Briefcase,
  attendance: CalendarCheck,
  canteen: Utensils,
  shop: ShoppingBag,
  communication: Megaphone,
  reports: FileText,
  settings: Settings,
  
  // Modules supplémentaires
  library: BookOpen,
  /** Alias camelCase (config / JSON) */
  bookOpen: BookOpen,
  laboratory: Beaker,
  transport: Bus,
  infirmary: Activity,
  qhse: Shield,
  educast: Video,
  
  // ORION & Direction
  orion: Compass,
  analysis: BarChart3,
  synthesis: Layers,
  trends: TrendingUp,
  history: Clock,
  view: Eye,
  
  // Alertes & KPI
  info: Info,
  warning: AlertCircle,
  critical: AlertTriangle,
  success: CheckCircle,
  error: XCircle,
  
  // Navigation & Actions (utilitaires)
  menu: Menu,
  close: X,
  chevronRight: ChevronRight,
  chevronLeft: ChevronLeft,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  search: Search,
  filter: Filter,
  add: Plus,
  remove: Minus,
  edit: Edit,
  delete: Trash2,
  save: Save,
  download: Download,
  upload: Upload,
  lock: Lock,
  unlock: Unlock,
  refresh: RefreshCw,
  check: Check,
  logout: LogOut,
  login: LogIn,
  user: User,
  userPlus: UserPlus,
  mail: Mail,
  phone: Phone,
  bell: Bell,
  shield: Shield,
  
  // Icônes supplémentaires pour landing page
  wifiOff: Wifi,
  shieldCheck: ShieldCheck,
  tag: Tag,
  building: Building2,
  spreadsheet: FileSpreadsheet,
  network: Network,
  globe: Globe,
  sparkles: Sparkles,
  arrowRight: ArrowRight,
  playCircle: Play,
  messageCircle: MessageCircle,
  send: Send,
  star: Star,
  x: X, // Utilisé pour fermer et pour le réseau social X
  
  // Social Media Icons
  facebook: Facebook,
  linkedin: Linkedin,
  twitter: X, // X (anciennement Twitter) - utilise l'icône X de Lucide
  youtube: Youtube,
} as const;

/**
 * Type pour les noms d'icônes valides
 */
export type IconName = keyof typeof IconMapping;

/**
 * Tailles officielles (en pixels)
 * 
 * RÈGLES STRICTES :
 * - Menu principal : 20px
 * - Sous-menu : 16px
 * - Dashboard / KPI : 24px
 * - Bouton action : 16px
 * - Alertes : 18px
 */
export type IconSize = 'menu' | 'submenu' | 'dashboard' | 'action' | 'alert';

/**
 * Mapping des tailles officielles en pixels
 */
export const IconSizes: Record<IconSize, number> = {
  menu: 20,        // Menu principal
  submenu: 16,     // Sous-menu
  dashboard: 24,   // Dashboard / KPI
  action: 16,      // Bouton action
  alert: 18,       // Alertes
};

/**
 * Récupère une icône par son nom
 */
export function getIcon(name: IconName): LucideIcon {
  const Icon = IconMapping[name];
  if (!Icon) {
    console.warn(`Icon "${name}" not found, using default`);
    return LayoutDashboard;
  }
  return Icon;
}
