'use client';

/**
 * ============================================================================
 * AggregationPageShell — Shared wrapper for aggregation pages
 * ============================================================================
 *
 * Wraps aggregation page content in a `ModuleContainer` with the parent
 * module's sub-modules tab bar visible, so the user sees the same tab
 * navigation as on the module dashboard.
 *
 * PROBLEM SOLVED:
 *   Before: aggregation pages returned raw content (no ModuleContainer),
 *   causing the parent module's tab bar to disappear when the user clicked
 *   the "Agrégation" tab.
 *
 *   After: aggregation pages use this shell, which renders ModuleContainer
 *   with the same subModules list as the parent module dashboard. The tab
 *   bar stays visible, and the "Agrégation" tab is highlighted as active.
 *
 * Usage:
 *   <AggregationPageShell
 *     moduleTitle="Finances & Économat"
 *     moduleDescription="..."
 *     moduleIcon="finance"
 *     tabs={FINANCE_SUBMODULE_TABS}
 *     activeTabId="aggregation"
 *   >
 *     (aggregation page content goes here)
 *   </AggregationPageShell>
 * ============================================================================
 */

import { ReactNode } from 'react';
import { ModuleContainer } from '@/components/modules/blueprint';

export interface AggregationTab {
  id: string;
  label: string;
  path?: string;
  href?: string;
  icon?: any;
  roles?: readonly string[];
}

export interface AggregationPageShellProps {
  /** Parent module title (shown in ModuleHeader) */
  moduleTitle: string;
  /** Parent module description (shown in ModuleHeader) */
  moduleDescription: string;
  /** Parent module icon name (e.g. 'finance', 'bookOpen', 'graduationCap') */
  moduleIcon?: string;
  /** Tab list from the parent module (FINANCE_SUBMODULE_TABS, PEDAGOGY_SUBMODULE_TABS, etc.) */
  tabs: readonly AggregationTab[];
  /** ID of the aggregation tab to highlight as active (default: 'aggregation') */
  activeTabId?: string;
  /** The aggregation page content */
  children: ReactNode;
}

export function AggregationPageShell({
  moduleTitle,
  moduleDescription,
  moduleIcon,
  tabs,
  activeTabId = 'aggregation',
  children,
}: AggregationPageShellProps) {
  // Normalize tabs: accept both `path` and `href` keys for flexibility
  const subModules = tabs.map((t) => {
    const Icon = t.icon;
    return {
      id: t.id,
      label: t.label,
      href: t.path || t.href || '#',
      icon: Icon ? (typeof Icon === 'function' ? <Icon className="w-4 h-4" /> : Icon) : undefined,
    };
  });

  return (
    <ModuleContainer
      header={{
        title: moduleTitle,
        description: moduleDescription,
        icon: moduleIcon,
      }}
      subModules={{
        modules: subModules,
        activeModuleId: activeTabId,
      }}
      content={{
        layout: 'custom',
        children,
      }}
    />
  );
}
