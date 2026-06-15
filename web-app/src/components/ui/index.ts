/**
 * ============================================================================
 * DESIGN SYSTEM - EXPORTS CENTRALISÉS
 * ============================================================================
 * 
 * Point d'entrée unique pour tous les composants UI standards
 * 
 * ============================================================================
 */

// Cards
export { StatCard } from './cards/StatCard';
export type { StatCardProps } from './cards/StatCard';

export { InfoCard } from './cards/InfoCard';
export type { InfoCardProps } from './cards/InfoCard';

export { AlertCard } from './cards/AlertCard';
export type { AlertCardProps, AlertSeverity } from './cards/AlertCard';

export { ActionCard } from './cards/ActionCard';
export type { ActionCardProps } from './cards/ActionCard';

// Tables
export { DataTable } from './tables/DataTable';
export type { DataTableProps, Column } from './tables/DataTable';

export { TableToolbar } from './tables/TableToolbar';
export type { TableToolbarProps } from './tables/TableToolbar';

export { TableActions } from './tables/TableActions';
export type { TableActionsProps, TableAction } from './tables/TableActions';

// Forms
export { FormSection } from './forms/FormSection';
export type { FormSectionProps } from './forms/FormSection';

export { FormField } from './forms/FormField';
export type { FormFieldProps } from './forms/FormField';

export { FormActions } from './forms/FormActions';
export type { FormActionsProps } from './forms/FormActions';

// Navigation
export { ModuleTabs } from './navigation/ModuleTabs';
export type { ModuleTabsProps, TabItem } from './navigation/ModuleTabs';

export { Breadcrumbs } from './navigation/Breadcrumbs';
export type { BreadcrumbsProps, BreadcrumbItem } from './navigation/Breadcrumbs';

// Feedback
export { EmptyState } from './feedback/EmptyState';
export type { EmptyStateProps } from './feedback/EmptyState';

export { LoadingState } from './feedback/LoadingState';
export type { LoadingStateProps } from './feedback/LoadingState';

export { ErrorState } from './feedback/ErrorState';
export type { ErrorStateProps } from './feedback/ErrorState';

// ORION
export { OrionPanel } from './orion/OrionPanel';
export type { OrionPanelProps } from './orion/OrionPanel';

export { OrionAlertItem } from './orion/OrionAlertItem';
export type { OrionAlertItemProps } from './orion/OrionAlertItem';

export { OrionSummary } from './orion/OrionSummary';
export type { OrionSummaryProps, OrionMetric } from './orion/OrionSummary';

// Modals
export { ModalBlueprint } from './modals/ModalBlueprint';
export type { ModalBlueprintProps, ModalType } from './modals/ModalBlueprint';
