# 📱 Guide UX Offline - Academia Hub

**Date** : Documentation UX mode offline  
**Statut** : ✅ **Guide UX documenté**

---

## 🎯 Principe Fondamental

**UX non anxiogène** : Informer clairement sans inquiéter  
**Messages professionnels** : Ton clair, positif, rassurant

---

## 🎨 Composants UX Offline

### 1. Badge OFFLINE / ONLINE

**Position** : En haut à droite de l'interface (fixe)

**Design** :

```tsx
// Badge ONLINE (vert)
<Badge variant="success" className="fixed top-4 right-4">
  <Wifi className="w-4 h-4 mr-1" />
  En ligne
</Badge>

// Badge OFFLINE (orange)
<Badge variant="warning" className="fixed top-4 right-4">
  <WifiOff className="w-4 h-4 mr-1" />
  Mode hors connexion
</Badge>
```

**Couleurs** :
- **ONLINE** : `green-500` (vert) - "En ligne"
- **OFFLINE** : `orange-500` (orange) - "Mode hors connexion"

**Animation** : Transition douce (fade in/out)

---

### 2. Indicateur "X actions en attente"

**Position** : À côté du badge offline (si actions en attente)

**Design** :

```tsx
<Badge variant="info" className="fixed top-4 right-28">
  <Clock className="w-4 h-4 mr-1" />
  {pendingOperationsCount} action{pendingOperationsCount > 1 ? 's' : ''} en attente
</Badge>
```

**Couleurs** :
- **Actions en attente** : `blue-500` (bleu) - "X actions en attente"
- **Aucune action** : Masqué

**Comportement** :
- Mis à jour en temps réel lors actions offline
- Clickable pour voir détail des actions
- Disparaît après sync réussie

---

### 3. Bouton "Synchroniser maintenant"

**Position** : Dans la barre de navigation (si mode offline)

**Design** :

```tsx
<Button
  variant="primary"
  onClick={handleSyncNow}
  disabled={isSyncing}
  className="fixed top-4 right-4 z-50"
>
  {isSyncing ? (
    <>
      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      Synchronisation...
    </>
  ) : (
    <>
      <RefreshCw className="w-4 h-4 mr-2" />
      Synchroniser maintenant
    </>
  )}
</Button>
```

**Couleurs** :
- **Disponible** : `blue-600` (bleu primaire)
- **Synchronisation** : `blue-400` (bleu clair) + spinner
- **Désactivé** : `gray-400` (gris) si aucune action en attente

**Comportement** :
- Désactivé si aucune action en attente
- Désactivé pendant synchronisation
- Animation spinner pendant sync

---

### 4. Message Clair Post-Sync

**Position** : Notification toast (coin bas droit)

**Design** :

```tsx
// Succès
<Toast variant="success">
  <CheckCircle className="w-5 h-5 mr-2" />
  <div>
    <div className="font-semibold">Synchronisation réussie</div>
    <div className="text-sm">{successCount} action{successCount > 1 ? 's' : ''} synchronisée{successCount > 1 ? 's' : ''}</div>
  </div>
</Toast>

// Conflit
<Toast variant="warning">
  <AlertTriangle className="w-5 h-5 mr-2" />
  <div>
    <div className="font-semibold">Conflits détectés</div>
    <div className="text-sm">{conflictCount} action{conflictCount > 1 ? 's' : ''} nécessite{conflictCount > 1 ? 'nt' : ''} votre attention</div>
  </div>
</Toast>

// Erreur
<Toast variant="error">
  <XCircle className="w-5 h-5 mr-2" />
  <div>
    <div className="font-semibold">Erreur de synchronisation</div>
    <div className="text-sm">Veuillez réessayer plus tard</div>
  </div>
</Toast>
```

**Durée d'affichage** :
- **Succès** : 3 secondes (auto-close)
- **Conflit** : 5 secondes (auto-close) + bouton "Voir détails"
- **Erreur** : 5 secondes (auto-close) + bouton "Réessayer"

---

## 💬 Messages Professionnels

### Messages Offline

| Contexte | Message | Ton |
|----------|---------|-----|
| **Mode offline détecté** | "Vous êtes en mode hors connexion. Vos actions seront synchronisées à la reconnexion." | Neutre, informatif |
| **Action interdite** | "Cette action nécessite une connexion internet. Veuillez vous connecter pour continuer." | Courtois, clair |
| **Actions en attente** | "X actions en attente de synchronisation. Vos données sont enregistrées localement." | Rassurant |

### Messages Post-Sync

| Résultat | Message | Ton |
|----------|---------|-----|
| **Succès complet** | "Synchronisation réussie. Toutes vos actions ont été synchronisées." | Positif, rassurant |
| **Succès partiel** | "Synchronisation réussie. X actions synchronisées, Y nécessitent votre attention." | Positif, informatif |
| **Conflits** | "Conflits détectés lors de la synchronisation. Veuillez consulter les détails pour résoudre." | Neutre, professionnel |
| **Erreur** | "Une erreur est survenue lors de la synchronisation. Veuillez réessayer." | Neutre, rassurant |

---

## 🎨 Exemple de Layout

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Academia Hub                    [Badge OFFLINE]      │
│                                    [X actions en attente]   │
│                                    [Sync maintenant]        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                    Contenu application                      │
│                                                              │
│                                                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                                        [Toast notification]
```

---

## 🔄 Flux Utilisateur

### Scénario 1 : Passage Offline → Online

```
1. Utilisateur perd connexion
   ↓
2. Badge "Mode hors connexion" apparaît (orange)
   ↓
3. Indicateur "X actions en attente" apparaît (si actions)
   ↓
4. Bouton "Synchroniser maintenant" activé
   ↓
5. Utilisateur clique "Synchroniser maintenant"
   ↓
6. Spinner + "Synchronisation..." affichés
   ↓
7. Toast "Synchronisation réussie" (succès)
   ↓
8. Badge "En ligne" apparaît (vert)
   ↓
9. Indicateurs disparaissent
```

---

### Scénario 2 : Actions Offline

```
1. Utilisateur crée/modifie données offline
   ↓
2. Badge "Mode hors connexion" visible
   ↓
3. Indicateur "X actions en attente" mis à jour
   ↓
4. Message rassurant : "Données enregistrées localement"
   ↓
5. Bouton "Synchroniser maintenant" activé
   ↓
6. (Optionnel) Sync automatique à la reconnexion
```

---

### Scénario 3 : Conflit lors Sync

```
1. Utilisateur synchronise actions
   ↓
2. Conflits détectés côté serveur
   ↓
3. Toast "Conflits détectés" (orange/warning)
   ↓
4. Badge "X actions en attente" reste (conflits)
   ↓
5. Bouton "Voir détails" → Modal conflits
   ↓
6. Options utilisateur : Annuler, Ressaisir, Validation
```

---

## 🎯 Composants React (Exemple)

### Hook `useOfflineSync`

```typescript
export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingOperations, setPendingOperations] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Détection connexion
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Récupérer actions en attente
  useEffect(() => {
    if (!isOnline) {
      // Récupérer depuis SQLite
      const fetchPendingOperations = async () => {
        const pending = await offlineDb.getPendingOperations();
        setPendingOperations(pending);
      };
      fetchPendingOperations();
    }
  }, [isOnline]);

  // Synchroniser maintenant
  const syncNow = async () => {
    setIsSyncing(true);
    try {
      const result = await offlineSyncService.sync();
      // Afficher toast selon résultat
      if (result.success) {
        showToast('success', 'Synchronisation réussie');
      } else if (result.conflicts > 0) {
        showToast('warning', 'Conflits détectés');
      } else {
        showToast('error', 'Erreur de synchronisation');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    isOnline,
    pendingOperationsCount: pendingOperations.length,
    isSyncing,
    syncNow,
  };
}
```

---

### Composant `OfflineStatusBadge`

```tsx
export function OfflineStatusBadge() {
  const { isOnline, pendingOperationsCount, isSyncing, syncNow } = useOfflineSync();

  return (
    <div className="fixed top-4 right-4 flex items-center gap-2 z-50">
      {!isOnline ? (
        <>
          <Badge variant="warning">
            <WifiOff className="w-4 h-4 mr-1" />
            Mode hors connexion
          </Badge>
          {pendingOperationsCount > 0 && (
            <Badge variant="info">
              <Clock className="w-4 h-4 mr-1" />
              {pendingOperationsCount} action{pendingOperationsCount > 1 ? 's' : ''} en attente
            </Badge>
          )}
          <Button
            variant="primary"
            onClick={syncNow}
            disabled={isSyncing || pendingOperationsCount === 0}
            size="sm"
          >
            {isSyncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Synchronisation...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Synchroniser maintenant
              </>
            )}
          </Button>
        </>
      ) : (
        <Badge variant="success">
          <Wifi className="w-4 h-4 mr-1" />
          En ligne
        </Badge>
      )}
    </div>
  );
}
```

---

## ✅ Checklist UX Offline

- [ ] Badge OFFLINE/ONLINE visible
- [ ] Indicateur actions en attente (si applicable)
- [ ] Bouton "Synchroniser maintenant" (si applicable)
- [ ] Messages professionnels et non anxiogènes
- [ ] Toast notifications post-sync
- [ ] Animation transitions douces
- [ ] Désactivation boutons interdits offline
- [ ] Modal détails conflits (si applicable)

---

**Le guide UX offline est maintenant documenté !** ✅
