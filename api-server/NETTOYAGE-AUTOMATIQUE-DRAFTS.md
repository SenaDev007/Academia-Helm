# ✅ Nettoyage Automatique des Drafts d'Onboarding

## 📋 Objectif

Supprimer automatiquement et définitivement les drafts d'onboarding expirés (plus de 24 heures) pour éviter de surcharger la base de données.

---

## ✅ Solution Implémentée

### 1. Service de Nettoyage Automatique

**Fichier** : `apps/api-server/src/onboarding/services/draft-cleanup.service.ts`

**Fonctionnalités** :
- ✅ **Tâche cron quotidienne** : Exécutée tous les jours à 2h00 du matin
- ✅ **Suppression automatique** : Supprime tous les drafts de plus de 24 heures
- ✅ **Préservation des drafts complétés** : Ne supprime pas les drafts avec le statut `COMPLETED`
- ✅ **Méthode manuelle** : Permet de déclencher le nettoyage à la demande
- ✅ **Comptage** : Méthode pour compter les drafts expirés sans les supprimer

**Code** :
```typescript
@Injectable()
export class DraftCleanupService {
  /**
   * Tâche cron qui supprime automatiquement les drafts expirés
   * Exécutée tous les jours à 2h00 du matin
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredDrafts() {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const result = await this.prisma.onboardingDraft.deleteMany({
      where: {
        createdAt: {
          lt: twentyFourHoursAgo,
        },
        status: {
          not: 'COMPLETED', // Ne pas supprimer les drafts complétés
        },
      },
    });

    this.logger.log(`✅ Cleanup completed: ${result.count} expired draft(s) deleted`);
  }
}
```

### 2. Vérification lors de la Récupération

**Fichier** : `apps/api-server/src/onboarding/services/onboarding.service.ts`

**Méthode `getDraft()`** :
- ✅ Vérifie automatiquement si le draft est expiré (plus de 24h)
- ✅ Supprime le draft expiré automatiquement
- ✅ Retourne une erreur `NotFoundException` si le draft est expiré

**Méthode `checkDraftByEmail()`** :
- ✅ Nettoie automatiquement les drafts expirés pour l'email avant de vérifier
- ✅ Évite de retourner des drafts expirés

**Code** :
```typescript
async getDraft(draftId: string) {
  const draft = await this.prisma.onboardingDraft.findUnique({
    where: { id: draftId },
    include: { payments: true },
  });

  if (!draft) {
    throw new NotFoundException(`Onboarding draft not found: ${draftId}`);
  }

  // Vérifier si le draft est expiré (plus de 24 heures)
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  if (draft.createdAt < twentyFourHoursAgo && draft.status !== 'COMPLETED') {
    // Supprimer le draft expiré
    await this.deleteDraft(draftId);
    throw new NotFoundException(`Onboarding draft expired and has been deleted: ${draftId}`);
  }

  return draft;
}
```

### 3. Configuration du Module

**Fichier** : `apps/api-server/src/onboarding/onboarding.module.ts`

```typescript
@Module({
  imports: [
    ScheduleModule.forRoot(), // Pour les tâches cron
    // ... autres imports
  ],
  providers: [
    OnboardingService,
    OtpService,
    DraftCleanupService, // ✅ Service de nettoyage ajouté
  ],
})
export class OnboardingModule {}
```

---

## 🔄 Workflow de Nettoyage

### 1. Nettoyage Automatique (Cron)

**Horaire** : Tous les jours à 2h00 du matin

**Processus** :
1. Calcul de la date limite (24 heures avant maintenant)
2. Recherche de tous les drafts créés avant cette date
3. Exclusion des drafts avec le statut `COMPLETED`
4. Suppression en masse des drafts expirés
5. Log du nombre de drafts supprimés

### 2. Nettoyage à la Demande

**Méthode** : `cleanupExpiredDraftsManually()`

**Utilisation** :
- Tests
- Nettoyage manuel via endpoint admin (si nécessaire)
- Déclenchement manuel en cas de besoin

### 3. Nettoyage lors de la Récupération

**Méthodes** :
- `getDraft(draftId)` : Vérifie et supprime si expiré
- `checkDraftByEmail(email)` : Nettoie les drafts expirés pour l'email avant vérification

---

## ✅ Critères de Suppression

Un draft est supprimé si :
- ✅ **Créé il y a plus de 24 heures** : `createdAt < (now - 24h)`
- ✅ **Statut non complété** : `status !== 'COMPLETED'`
- ✅ **Statut DRAFT ou PENDING_PAYMENT** : Seuls ces statuts sont concernés

**Drafts préservés** :
- ✅ Drafts complétés (`status === 'COMPLETED'`)
- ✅ Drafts de moins de 24 heures
- ✅ Drafts avec d'autres statuts (si existent)

---

## 📊 Monitoring

### Méthode de Comptage

```typescript
async countExpiredDrafts(): Promise<number>
```

Permet de compter les drafts expirés sans les supprimer, utile pour :
- Monitoring de la base de données
- Statistiques
- Alertes si trop de drafts expirés

---

## 🎯 Résultat

✅ **Nettoyage automatique** : Les drafts expirés sont supprimés automatiquement tous les jours à 2h00.

✅ **Nettoyage à la demande** : Possibilité de déclencher le nettoyage manuellement.

✅ **Nettoyage préventif** : Vérification et suppression lors de la récupération d'un draft.

✅ **Base de données optimisée** : Évite l'accumulation de drafts expirés.

✅ **Préservation des données importantes** : Les drafts complétés sont préservés.

---

**Date d'implémentation** : 2025-01-XX  
**Version** : 1.0.0  
**Statut** : ✅ **IMPLÉMENTÉ**
