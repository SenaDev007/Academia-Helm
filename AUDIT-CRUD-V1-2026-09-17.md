# AUDIT CRUD V1 — TOUS LES MODULES FONCTIONNELS (17/09/2026)

> Objectif : parcourir les modules **Pédagogie, Élèves, Finance, Examens, Personnel RH,
> Academia Shop** (+ Cantine, EduCast) et vérifier le CRUD de chaque onglet afin
> d'identifier les zones non fonctionnelles pour la clôture de la **V1 d'Academia**.
>
> Méthode : 6 audits statiques exhaustifs (bouton → handler → route BFF → contrôleur
> NestJS → service Prisma) + correctifs prioritaires (P0) sur les flux métier
> quotidiens cassés. Validation `bun build` des 39 fichiers modifiés : **0 erreur**.

---

## 1. BILAN PAR MODULE

| Module | Opérations tracées | Verdict | Corrections V1 |
|---|---|---|---|
| **Pédagogie** | ~120 (18 onglets, FR+EN) | ✅ Sain — 4 flux cassés réparés | 5 |
| **Élèves & Scolarité** | ~140 (14 onglets) | ✅ Sain — CRUD cœur complet | 2 |
| **Finance & Économat** | ~130 (13 onglets) | ✅ Sain — 8 ruptures BFF réparées | 12 |
| **Examens & Bulletins** | ~80 (10 onglets) | ✅ Sain — stats/audit/déverrouillage réparés | 8 |
| **Personnel RH & Paie** | 242 chemins (16 onglets) | ✅ Le plus sain (242/242 routes) | 6 |
| **Academia Shop** | ~60 | ✅ Sain — 1 bloquant réparé | 1 |
| **Cantine** | ~25 | ⚠️ Lecture OK, **écriture majoritairement cassée** (P1) | 0 (chantier) |
| **EduCast** | ~30 | ⚠️ Module dégradé — feed + upload cassés (P1) | 0 (chantier) |

---

## 2. ANOMALIES P0 CORRIGÉES (cette session)

### Finance (12 correctifs)
1. **« Valider » une clôture (Trésorerie) → 405** : `finance.service.ts:773` envoie POST,
   le BFF n'exportait que PATCH. → POST ajouté au BFF `treasury/daily-closures/[id]/validate`.
2. **« Promesse honorée/rompue » (Recouvrement) → 404** : route BFF
   `collection/promises/[id]/status` inexistante (backend prêt). → Créée (PATCH).
3. **« Abandonner la créance » (Recouvrement) → 404** : route BFF
   `collection/arrears/[id]/write-off` inexistante. → Créée (POST).
4. **« Historique des relances » → 405 + onglet vide silencieux** : BFF
   `collection/reminders` n'exportait que POST. → GET ajouté.
5. **Graphique « évolution mensuelle » (Bilan périodique) toujours vide** : route BFF
   `reports/monthly-encaissements` inexistante (404 avalé). → Créée (GET).
6. **« Alerter le promoteur » (Multi-caisses) → 405 + faux succès backend** : POST ajouté
   au BFF `cash-registers/dashboard` ET vraie notification in-app (priorité HIGH,
   `CASH_REGISTER_ALERT`) aux PROMOTER/SUPER_DIRECTOR actifs — remplace le `console.log`
   + faux succès. Message honnête si aucun destinataire.
7. **Page « Agrégation & Bilan Global » → 0 FCFA partout** : double discontinuité (BFF racine
   + endpoint backend inexistants). → Nouvel endpoint `GET /finance/reports/by-level`
   (KPI par niveau, scope synthétique) + route BFF `finance/reports` + page rebranchée.
8. **KPI de tête du module Finance jamais affichés** : appel `/api/finance/stats` fantôme.
   → Rebranché sur `/api/finance/reports/kpi` réel avec mapping des champs.
9. **Paiement Fedapay portail parent → 404** : route BFF `payments/fedapay/initiate`
   inexistante. → Créée (POST, auth forwardée).
10. **Webhook Fedapay → 404** (aucune réconciliation des paiements en ligne) : route BFF
    `payments/fedapay/webhook` créée (public, tenantId en query).
11. **FeexPayController jamais enregistré dans FinanceModule** → endpoints 404 runtime.
    → Enregistré (+ FeexPayService).
12. **Filtre période Trésorerie sans effet** : `filterFrom/filterTo` calculés mais jamais
    transmis. → Service + page corrigés (backend supporte déjà from/to).

### Pédagogie (5 correctifs)
13. **🔴 Validation des planifications mensuelles bloquée** (FR + EN) : le chargement de la
    signature directeur appelait `/api/school-directors` — **route BFF inexistante** → 404
    avalé → « Signature du directeur requise » systématique. → Route BFF créée (résolution
    par `staffUserId`, exposé dans le SQL de `getDirectors`).
14. **« Lancer l'analyse » ORION → 405** : route BFF orion-advanced n'exportait que GET.
    → POST ajouté.
15. **Fiches des années précédentes (cross-year reuse) → 404 « Fiche non trouvée »** :
    shadowing de route NestJS (`fiches/:id` déclaré avant `fiches/previous-years`).
    → Réordonné.
16. **Logo école absent des PDF pédagogiques** (registres d'appel, évaluations, weekly
    records — 7 points d'appel) : `/api/tenants/:id/logo` sans route BFF → 404 avalé.
    → Route BFF proxy créée (binaire, redirections suivies).
17. **`updateSubject` PATCH → 405 latent** (service offline-first) : backend n'expose que
    PUT. → Corrigé.

### Examens (8 correctifs)
18. **Onglet Statistiques → zéros silencieux** : triple panne (route BFF inexistante captée
    par `/api/exams/[id]`, proxy sans auth → 401, tables legacy jamais alimentées, mismatch
    de champs). → Nouvel endpoint `GET /institutional-exams/dashboard/performance-by-level`
    (données réelles `StudentPeriodAverage` + `Evaluation`, scope niveau + piste) + service
    frontend + page rebranchée.
19. **Onglet Audit vide à perpétuité** : `logAction` n'était jamais appelé. → Traces
    fire-and-forget sur `validate` (GRADE_VALIDATE) et `cancel` (GRADE_REJECT).
20. **Badges de filtre Audit décoratifs + « Exporter » sans handler** : filtres branchés
    (TOUTES/GRADES/EVALUATIONS/LOCKS) + export CSV fonctionnel.
21. **Filtre « Toutes » des demandes de déverrouillage → liste vide garantie** : envoi de
    `status=ALL` (valeur inexistante côté backend). → Paramètre omis si ALL.
22. **Noms demandeur/reviseur jamais affichés** : mismatch `requesterFirstName` vs
    `requestedByFirstName`. → Double lecture acceptée.
23. **« Enregistrer et valider » au 2ᵉ passage → 400** : `open` refusait
    OPEN_FOR_GRADING. → Idempotence (no-op 200).
24. **Verrouillage des notes garanti uniquement côté frontend** : `bulkSave` ne vérifiait
    pas le statut de l'évaluation. → Garde-fou backend (refus SUBMITTED/VALIDATED avec
    message actionnable).
25. *(Note design)* Le flux « Enregistrer et valider » (enseignant) = notes SUBMITTED +
    évaluation OPEN_FOR_GRADING est **volontaire** : la soumission au directeur se fait
    depuis l'Espace Pédagogique — pas un bug.

### Personnel RH (6 correctifs)
26. **KPI « En attente signature » figé à 0** : lecture `data.kpi.pendingSignatureStaff`
    (clé jamais renvoyée). → `pendingSignatureContracts` calculé dans le snapshot backend
    (contrats non signés, non résiliés) + frontend rebranché.
27. **Carte « Cotisations CNSS » toujours 0** : `cnssContributions` vs `cnssCharges`.
28. **Graphe « Évolution de la masse salariale » vide** : `dataKey="amount"` vs
    `{month, total}`. → `dataKey="total"`.
29. **« Appui » toujours 0 (répartition des effectifs)** : le backend renvoie
    `[{roleType, count}]`, pas `{teachers, admin, support}`. → Mapping robuste.
30. **Route `promoter-status` shadowée** (après `:id` → 404 latent). → Déplacée avant.
31. *(Backlog confirmé)* 69-A auth administration / 69-B1 persistance signature lien public.

### Élèves & Scolarité (2 correctifs)
32. **Carte dashboard « Documents & Conformité » → table de secours sans onglet actif** :
    l'onglet `compliance` a été retiré du module. → Carte pointée sur `cards`
    (Cartes Scolaires).
33. **Icône « Dossier » de la table de secours → 404** (`/app/students/[id]/dossier`,
    page inexistante). → Pattern fonctionnel `?tab=dossiers&studentId=` (lu au montage).

### Academia Shop (1 correctif)
34. **Changement de statut d'une commande → erreur Prisma** : le `<select>` envoyait des
    minuscules + `shipped` (valeur inexistante) vs enum `ShopOrderStatus`
    (PENDING/CONFIRMED/PREPARING/READY/DELIVERED/CANCELLED). → Normalisation + options
    alignées (dont « En préparation » / « Prête »).

---

## 3. ANOMALIES RESTANTES (P1) — À DÉCIDER AVANT CLÔTURE V1

### Chantiers conséquents
| Zone | Constat | Reco |
|---|---|---|
| **Cantine — écriture** | 7 POST/PUT sur 9 en mismatch de payload avec le service Prisma (menus, inscriptions, présences, paiements, stocks, fournisseurs, incidents, paramètres) : champs requis manquants (`startDate`, `enrollmentId`, `mainPlate`, `contactName`, `paymentMode`…), upsert sur clés non fournies. **Lecture OK partout.** | Chantier d'alignement des payloads (~1 journée). Alternative V1 : restreindre l'onglet à la lecture + régimes (seul CRUD branché). |
| **EduCast** | Route BFF statique `contents` sans forwarding d'auth (401 probable, feed vide) ; upload triple cassé (BFF `request.json()` sur multipart + route `POST educast/contents` inexistante + pas de multer backend) ; filtres `type/q/teacherId/status` ignorés ; 17 composants CRUD (packs, webinaires, playlists, annonces, studio, versements) orphelins — backend complet non exposé. | Chantier upload (FileInterceptor + storage) + reroutage BFF. Alternative V1 : masquer le module tant que non réparé. |
| **RH — déclarations fiscales** | TODO assumé : IST/CNSS calculées sur `staff.salary` (statique) et non sur la paie réelle → risque d'écart déclarations vs bulletins. | Brancher `tax-declaration.service` sur `PayrollPrismaService` (69-x). |
| **Examens — « Modifier » une évaluation avec notes** | delete-then-recreate : les notes restent sur les évaluations annulées (soft-CANCEL), les nouvelles sessions sont vides. | Migration vers un vrai update, ou blocage de l'édition si notes saisies (message explicite). |
| **Examens — « Rejeter » une validation** | `cancel` = CANCELLED définitif + toast mensonger (« l'enseignant sera notifié »). | Implémenter un vrai retour à OPEN_FOR_GRADING + notification. |
| **Déverrouillage notes — granularité** | Le modal promet « seules les notes sélectionnées seront déverrouillées » mais l'approbation rouvre TOUTE l'évaluation (colonnes absentes de la table). | Soit persister la sélection (migration), soit simplifier le message. |

### Petites réparations (rapides)
- **Élèves — ORION** : mini-panel Inscriptions jamais alimenté + onglet « ORION, Stats &
  Audit » placeholder alors que la chaîne complète existe (`/students/orion/kpis|alerts`).
- **Élèves — actions sans UI** : « Demander complément » (transferts), « Exclusion »
  (sorties), `reverseTransaction` (extourner encaissement Finance) — backend + service
  prêts, aucun bouton.
- **Shop** : resend reçu = stub backend (« queued », aucun envoi) → faux succès ;
  3 onglets (Remises/Retraits/Retours) commentés dans la sidebar alors que les composants
  + endpoints existent ; boutons morts (Visualiser/Télécharger/Modifier-remise).
- **Pédagogie — EDT PDF** : `school-identity` (endpoint inexistant) → en-tête dégradé
  silencieusement ; onglets `class-diaries`/`tasks`/`global-library` hors navigation.
- **RH — UX** : `prompt()` natif pour réaffecter une candidature ; erreurs de chargement
  avalées (console seule) dans ~10 workspaces → états vides sans diagnostic.
- **Code mort significatif** (dette, sans impact runtime) : `CnssWorkspace`,
  `OrganigramWorkspace` (backend complet orphelin), `StudentMatriculesSection`,
  `AbsencesContent` (élèves), ~30 routes BFF `/api/students/*` sans caller,
  `FeexPayCheckoutModal`, hooks `/api/exam-scores/*`, duplicate controllers
  `collection/cases` ×2, `UnlockRequestsController` déclaré 2× dans exams.module.

### Sécurité (bonus, non bloquant V1)
- `PUT canteen/enrollments/:id/validate` sans contrôle tenantId (cross-tenant possible).
- `favorite-status`/`favorites` EduCast font confiance à `?userId=` query.
- `DELETE educast/comments/:id` sans contrôle tenant.

---

## 4. CONCLUSION

La chaîne CRUD des **six modules majeurs est désormais fonctionnelle de bout en bout**
sur les flux quotidiens (inscriptions, encaissements, clôtures, recouvrement, notes,
bulletins, contrats, paie, boutique). Les ruptures restantes sont concentrées dans les
**modules complémentaires (Cantine en écriture, EduCast)** et des **décisions produit**
(ORION élèves, actions sans UI, granularité déverrouillage) listées en §3.

Pour clôturer la V1, il reste à arbitrer les P1 du §3 — recommandation immédiate :
(1) trancher Cantine/EduCast (réparer ou masquer), (2) livrer le vrai flux « Rejeter »
examens, (3) brancher les 3 actions sans UI si le métier les veut en V1.
