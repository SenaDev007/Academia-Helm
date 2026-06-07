# 📋 Résumé Architecture Offline-First — Academia Hub

## 🎯 Principe Non Négociable

> **Le client peut TOUT faire offline.  
> Le serveur consolide et valide.  
> PostgreSQL est la source de vérité finale.**

---

## 🏗️ Architecture en Bref

### Client (Web/Desktop/Mobile)

```
UI → Business Logic → Outbox → SQLite Local
                      ↓
                  [Si online] → Sync → Serveur
```

### Serveur (API SaaS)

```
/sync → Validation → Conflict Check → PostgreSQL
```

---

## 📊 Composants Clés

### 1. Base Locale SQLite

- **Schéma complet** : Toutes les tables métier
- **Métadonnées sync** : `_version`, `_last_sync`, `_is_dirty`, `_deleted`
- **Isolation** : Par tenant

### 2. Outbox Pattern

- **Tout événement** → Outbox
- **Aucun appel API direct** depuis business logic
- **Statuts** : PENDING → SYNCING → SYNCED / FAILED

### 3. Mode Offline Total

- **Aucune action ne doit échouer** hors ligne
- **UI reflète l'état offline**
- **Synchronisation automatique** à la reconnexion

### 4. Détection Connexion

- **Listener réseau** : online/offline events
- **Ping serveur** : Vérification réelle
- **Sync automatique** : Dès reconnexion

### 5. Synchronisation

- **Client** : Envoie batch d'événements
- **Serveur** : Valide, résout conflits, écrit PostgreSQL
- **Réponse** : Succès, conflits, erreurs

---

## 🔄 Flux de Synchronisation

### Envoi (Client → Serveur)

1. Récupérer événements PENDING
2. Marquer comme SYNCING
3. Envoyer batch au serveur
4. Traiter la réponse

### Réception (Serveur → Client)

1. Valider chaque événement
2. Vérifier conflits (version)
3. Appliquer si valide
4. Retourner résultat structuré

### Traitement Réponse (Client)

1. Marquer SYNCED les succès
2. Résoudre conflits (serveur = source de vérité)
3. Gérer erreurs
4. Mettre à jour sync state

---

## 🔒 Sécurité

- **JWT** : Authentification chaque requête
- **Validation** : Métier stricte côté serveur
- **Traçabilité** : Journalisation complète
- **Isolation** : Par tenant strictement

---

## 📋 Checklist Rapide

### Client

- [ ] SQLite local avec schéma complet
- [ ] Outbox Pattern implémenté
- [ ] Service sync avec auto-sync
- [ ] Détection réseau
- [ ] UI offline

### Serveur

- [ ] Endpoint /sync
- [ ] Validation métier
- [ ] Gestion conflits
- [ ] Journalisation
- [ ] Tests

---

## 📝 Documentation Complète

- **`OFFLINE-FIRST-ARCHITECTURE.md`** : Architecture détaillée
- **`OFFLINE-FIRST-IMPLEMENTATION.md`** : Guide d'implémentation

---

**Version** : 1.0  
**Dernière mise à jour** : 2025

