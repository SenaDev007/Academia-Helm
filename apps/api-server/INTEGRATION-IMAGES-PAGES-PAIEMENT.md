# Intégration Images Pages de Paiement FedaPay

## 📸 Images Intégrées

Deux images ont été intégrées dans les pages de paiement FedaPay :

1. **Souscription Initiale** : `apps/web-app/public/images/Souscription initiale.jpg`
   - Utilisée pour : Paiement initial onboarding
   - URL : `${FRONTEND_URL}/images/Souscription%20initiale.jpg`

2. **Abonnement Mensuel** : `apps/web-app/public/images/Abonnement mensuel.jpg`
   - Utilisée pour : Renouvellement mensuel/annuel
   - URL : `${FRONTEND_URL}/images/Abonnement%20mensuel.jpg`

## 🔧 Implémentation

### 1. Modification de `createTransaction()`

Ajout du paramètre `imageUrl` dans la méthode `createTransaction()` :

```typescript
async createTransaction(data: {
  amount: number;
  description: string;
  callbackUrl: string;
  metadata?: Record<string, any>;
  customer?: { ... };
  imageUrl?: string; // NOUVEAU
})
```

L'image est ajoutée dans les métadonnées de la transaction :
```typescript
if (data.imageUrl) {
  payload.transaction.metadata = {
    ...payload.transaction.metadata,
    image_url: data.imageUrl,
    logo_url: data.imageUrl, // Fallback pour compatibilité
  };
}
```

### 2. Souscription Initiale

Dans `createOnboardingPaymentSession()` :
```typescript
const imageUrl = `${frontendUrl}/images/Souscription%20initiale.jpg`;

const transaction = await this.createTransaction({
  // ...
  imageUrl, // Image pour la page de paiement
  // ...
});
```

### 3. Renouvellement Mensuel/Annuel

Dans `createRenewalPaymentSession()` :
```typescript
const imageUrl = `${frontendUrl}/images/Abonnement%20mensuel.jpg`;

const transaction = await this.createTransaction({
  // ...
  imageUrl, // Image pour la page de paiement
  // ...
});
```

## 📋 Configuration

### Variables d'Environnement

Assurez-vous que `FRONTEND_URL` est correctement configuré dans `.env` :

```env
FRONTEND_URL=http://localhost:3001  # Dev
# ou
FRONTEND_URL=https://academiahub.com  # Production
```

### Accès aux Images

Les images doivent être accessibles publiquement via le frontend Next.js :
- Chemin : `/images/Souscription initiale.jpg`
- Chemin : `/images/Abonnement mensuel.jpg`

Next.js sert automatiquement les fichiers du dossier `public/images/`.

## ⚠️ Notes Importantes

1. **Encodage URL** : Les espaces dans les noms de fichiers sont encodés en `%20`
2. **Accessibilité** : Les images doivent être accessibles publiquement (pas de protection d'authentification)
3. **Format** : Les images sont en JPG, format supporté par FedaPay
4. **Taille** : Assurez-vous que les images ne sont pas trop lourdes (recommandé < 2MB)

## 🔄 Pages Statiques vs API Dynamique

### Pages Statiques

Si vous utilisez les pages statiques FedaPay (`FEDAPAY_STATIC_PAGE_SUBSCRIPTION_URL`), vous devez configurer l'image directement dans le dashboard FedaPay.

### API Dynamique

Les images sont automatiquement incluses dans les métadonnées de la transaction créée via l'API.

## ✅ Vérification

Pour vérifier que les images sont bien intégrées :

1. Créer une transaction de test
2. Vérifier les métadonnées de la transaction dans FedaPay
3. Vérifier que l'image s'affiche sur la page de paiement

---

**Date** : Intégration images pages de paiement ✅
