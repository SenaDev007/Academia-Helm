/**
 * ============================================================================
 * TAB KEEPER — Garde tous les onglets montés, cache les inactifs
 * ============================================================================
 *
 * Au lieu de détruire/recréer les composants à chaque changement d'onglet
 * (ce qui force un rechargement complet des données depuis le backend),
 * TabKeeper garde TOUS les composants montés en mémoire et cache simplement
 * les inactifs avec `display: none`.
 *
 * Avantages :
 *   - Navigation instantanée entre onglets (pas de re-fetch)
 *   - Les données restent en mémoire (pas de flash de données vides)
 *   - Les formulaires en cours ne sont pas perdus
 *   - Compatible avec TOUS les modules sans modification individuelle
 *
 * Usage :
 *   <TabKeeper activeId={activeTab}>
 *     <TabKeeper.Tab id="dashboard"><Dashboard /></TabKeeper.Tab>
 *     <TabKeeper.Tab id="enrollments"><Enrollments /></TabKeeper.Tab>
 *   </TabKeeper>
 *
 * Ou en mode "children array" :
 *   <TabKeeper
 *     activeId={activeTab}
 *     tabs={[
 *       { id: 'dashboard', content: <Dashboard /> },
 *       { id: 'enrollments', content: <Enrollments /> },
 *     ]}
 *   />
 */

'use client';

import { ReactNode, memo } from 'react';

interface TabKeeperProps {
  activeId: string;
  tabs: Array<{ id: string; content: ReactNode }>;
}

export function TabKeeper({ activeId, tabs }: TabKeeperProps) {
  return (
    <>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          style={{ display: tab.id === activeId ? 'block' : 'none' }}
          aria-hidden={tab.id !== activeId}
        >
          {tab.content}
        </div>
      ))}
    </>
  );
}

/**
 * Version memoisée pour éviter les re-renders inutiles.
 */
export const MemoizedTabKeeper = memo(TabKeeper);

export default TabKeeper;
