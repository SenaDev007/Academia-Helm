/**
 * ============================================================================
 * MODULE TABS - ONGLETS DE MODULE
 * ============================================================================
 * 
 * Composant standard pour la navigation par onglets dans les modules
 * 
 * ============================================================================
 */

'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

export interface ModuleTabsProps {
  tabs: TabItem[];
  defaultTab?: string;
  onTabChange?: (tabId: string) => void;
}

export function ModuleTabs({ tabs, defaultTab, onTabChange }: ModuleTabsProps) {
  return (
    <Tabs defaultValue={defaultTab || tabs[0]?.id} onValueChange={onTabChange}>
      <TabsList className="mb-6">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            disabled={tab.disabled}
            className="relative"
          >
            {tab.label}
            {tab.badge && (
              <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                {tab.badge}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
