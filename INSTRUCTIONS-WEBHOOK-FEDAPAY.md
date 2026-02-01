# Instructions pour configurer le webhook FedaPay avec ngrok

## ✅ Configuration terminée

- ✅ ngrok installé et configuré avec votre authtoken
- ✅ Script helper créé : `start-ngrok.bat`

## 🚀 Étapes pour configurer le webhook

### 1. Démarrer votre serveur backend

Dans un terminal, démarrez votre serveur NestJS :

```bash
cd apps/api-server
npm run start:dev
```

Assurez-vous que le serveur tourne sur le port **3000** (ou notez le port utilisé).

### 2. Démarrer ngrok

Dans un **nouveau terminal**, démarrez ngrok :

```bash
# Option 1 : Utiliser le script helper (recommandé)
.\start-ngrok.bat 3000

# Option 2 : Utiliser directement
"C:\Users\HP\Downloads\ngrok-v3-stable-windows-386\ngrok.exe" http 3000
```

### 3. Récupérer l'URL publique ngrok

ngrok affichera quelque chose comme :

```
Session Status                online
Account                       votre-email@example.com
Version                       3.35.0
Region                        United States (us)
Forwarding                    https://abc123.ngrok-free.app -> http://localhost:3000

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

**Copiez l'URL** : `https://abc123.ngrok-free.app` (la vôtre sera différente)

### 4. Construire l'URL complète du webhook

L'URL complète du webhook sera :

```
https://abc123.ngrok-free.app/api/billing/fedapay/webhook
```

Remplacez `abc123.ngrok-free.app` par votre URL ngrok.

### 5. Configurer le webhook dans FedaPay Sandbox

1. **Aller dans FedaPay Sandbox** : https://sandbox.fedapay.com/webhooks
2. **Cliquer sur "+ Nouveau webhook"**
3. **Remplir le formulaire** :
   - **URL** : `https://abc123.ngrok-free.app/api/billing/fedapay/webhook`
     (remplacez par votre URL ngrok)
   - **Désactiver la vérification SSL** : ✅ **ACTIVER** (ngrok gère HTTPS)
   - **Désactiver le webhook lorsque l'application génère des erreurs** : ✅ **ACTIVER**
   - **Entêtes HTTP** : Laisser vide
   - **Type d'événements** : Sélectionner **"Sélectionner les événements à recevoir"**
     - ✅ Cocher `transaction.approved`
     - ✅ Cocher `transaction.declined`
4. **Cliquer sur "Créer"**

### 6. Récupérer le secret webhook

Après création du webhook :

1. **Ouvrir les détails du webhook** dans FedaPay
2. **Copier le "Webhook Secret"** (commence par `whsec_`)
3. **Ajouter dans `apps/api-server/.env`** :

```env
FEDAPAY_WEBHOOK_SECRET=whsec_votre_secret_ici
```

### 7. Redémarrer le serveur backend

Après avoir ajouté le secret, redémarrer le serveur :

```bash
# Arrêter le serveur (Ctrl+C)
# Puis redémarrer
cd apps/api-server
npm run start:dev
```

### 8. Tester le webhook

1. **Effectuer un paiement de test** via l'onboarding
2. **Vérifier les logs du backend** pour voir la réception du webhook
3. **Vérifier dans FedaPay** que le webhook a été appelé (section "Logs" ou "Événements")
4. **Vérifier l'interface ngrok** : http://localhost:4040 (logs des requêtes)

## 📋 Checklist

- [ ] Serveur backend démarré sur le port 3000
- [ ] ngrok démarré et URL publique récupérée
- [ ] Webhook créé dans FedaPay avec l'URL ngrok
- [ ] Événements `transaction.approved` et `transaction.declined` sélectionnés
- [ ] Secret webhook récupéré et ajouté dans `.env`
- [ ] Serveur backend redémarré
- [ ] Test de paiement effectué

## ⚠️ Notes importantes

- **Gardez ngrok actif** pendant les tests (ne fermez pas le terminal)
- **L'URL ngrok change** à chaque redémarrage (version gratuite)
- **En production**, utilisez votre domaine réel, pas ngrok
- **L'interface web ngrok** est disponible sur http://localhost:4040 pour voir les logs

## 🔧 Commandes utiles

```bash
# Démarrer ngrok pour le port 3000
.\start-ngrok.bat 3000

# Voir les logs ngrok dans le navigateur
# Ouvrir http://localhost:4040

# Vérifier la configuration ngrok
"C:\Users\HP\Downloads\ngrok-v3-stable-windows-386\ngrok.exe" config check
```

## 🎯 Prochaines étapes

Une fois le webhook configuré et testé :

1. ✅ Vérifier que les paiements activent bien les tenants
2. ✅ Vérifier les logs dans FedaPay
3. ✅ Vérifier les logs dans ngrok (http://localhost:4040)
4. ✅ Vérifier les logs du backend

---

**Date** : Configuration ngrok terminée ✅
