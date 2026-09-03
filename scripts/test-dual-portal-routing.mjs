/**
 * Test logique du routage post-login (fix double-casquette).
 * Compile le VRAI role-portal-map.ts du repo web-app avec esbuild,
 * stubbe l'import '@/lib/tenant/constants', puis simule la décision
 * exacte du layout/page corrigés pour les scénarios clés.
 */
import { getEffectivePortal } from './compiled-role-portal-map.mjs';

const scenarios = [
  // [nom, role DB, portalType session, user.portal, résultat attendu, UI attendue]
  ['Saliou double-casquette login PORTAIL ENSEIGNANT (matricule)', 'DIRECTEUR_MAT_PRI', 'TEACHER', 'TEACHER', 'TEACHER', '/app/teacher (UI enseignant)'],
  ['Saliou double-casquette login PORTAIL ÉCOLE (email)', 'DIRECTEUR_MAT_PRI', 'SCHOOL', 'SCHOOL', 'SCHOOL', 'Dashboard pilotage (UI école)'],
  ['Saliou double-casquette login STANDARD (legacy)', 'DIRECTEUR_MAT_PRI', null, 'SCHOOL', 'SCHOOL', 'Dashboard pilotage (UI école)'],
  ['Enseignant pur login PORTAIL ENSEIGNANT', 'TEACHER', 'TEACHER', 'TEACHER', 'TEACHER', '/app/teacher (UI enseignant)'],
  ['Enseignant pur login STANDARD (session legacy sans portal)', 'TEACHER', null, null, 'TEACHER', '/app/teacher (UI enseignant)'],
  ['Enseignant pur login STANDARD (user.portal=SCHOOL défaut proxy)', 'TEACHER', null, 'SCHOOL', 'SCHOOL', 'Dashboard pilotage (comportement inchangé — portail choisi prévaut)'],
  ['Directeur pur login PORTAIL ÉCOLE', 'DIRECTOR', 'SCHOOL', 'SCHOOL', 'SCHOOL', 'Dashboard pilotage (UI école)'],
  ['Directeur pur session legacy', 'DIRECTOR', null, null, 'SCHOOL', 'Dashboard pilotage (UI école)'],
  ['Parent login PORTAIL PARENT', 'PARENT', 'PARENT', 'PARENT', 'PARENT', '/app/parent (UI parent)'],
  ['Personnel double-casquette admin+parent login PORTAIL PARENT', 'SECRETAIRE', 'PARENT', 'PARENT', 'PARENT', '/app/parent (UI parent)'],
  ['Censeur session legacy', 'CENSEUR', null, null, 'SCHOOL', 'Dashboard pilotage (UI école)'],
  ['Rôle inconnu session legacy', 'RESP_SCOLARITE', null, null, 'SCHOOL', 'Dashboard pilotage (défaut SCHOOL)'],
  ['Surveillant login PORTAIL ENSEIGNANT (admin rejeté côté backend si pas profil Teacher)', 'SURVEILLANT', 'TEACHER', 'TEACHER', 'TEACHER', '/app/teacher (backend garantit profil Teacher)'],
];

let failures = 0;
console.log('─'.repeat(100));
for (const [name, role, portalType, userPortal, expected, uiLabel] of scenarios) {
  // Réplique EXACTE de la décision corrigée dans /app/page.tsx et /app/layout.tsx
  const effective = getEffectivePortal(role, portalType || userPortal);
  const target =
    effective === 'PARENT' ? '/app/parent' :
    effective === 'TEACHER' ? '/app/teacher' :
    'dashboard école';
  const ok = effective === expected;
  if (!ok) failures++;
  console.log(`${ok ? '✅' : '❌'} ${name}`);
  console.log(`   role=${role} | session.portalType=${portalType || '—'} | user.portal=${userPortal || '—'} → effectivePortal=${effective} → ${ok ? uiLabel : `ATTENDU ${expected} (${uiLabel})`}`);
}
console.log('─'.repeat(100));
console.log(`${scenarios.length - failures}/${scenarios.length} scénarios OK`);
process.exit(failures > 0 ? 1 : 0);
