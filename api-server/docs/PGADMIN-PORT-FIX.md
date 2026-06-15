# 🔧 Fix Conflit de Port pgAdmin 4

## Problème

pgAdmin 4 est configuré pour utiliser le port **3000**, mais ce port est déjà utilisé par l'API backend Academia Hub.

**Erreur** : "The pgAdmin 4 server could not be contacted"

---

## Solution : Changer le Port de pgAdmin 4

### Option 1 : Via l'Interface pgAdmin (Recommandé)

1. **Ouvrir pgAdmin 4**
2. **Aller dans** : `File` → `Preferences` → `Miscellaneous`
3. **Trouver** : Section "Fixed Port"
4. **Décocher** : "Fixed port number?" OU **Changer le port** de `3000` à `5050` (port par défaut de pgAdmin)
5. **Sauvegarder** et **Redémarrer pgAdmin 4**

---

### Option 2 : Via le Fichier de Configuration

1. **Localiser le fichier de configuration** :
   ```
   C:\Users\HP\AppData\Roaming\pgadmin4\config.json
   ```

2. **Ouvrir** `config.json` dans un éditeur de texte

3. **Modifier** la section `fixed_port` :
   ```json
   {
     "fixed_port": false,
     // OU
     "fixed_port": true,
     "port_number": 5050
   }
   ```

4. **Sauvegarder** et **Redémarrer pgAdmin 4**

---

### Option 3 : Via Variable d'Environnement

1. **Ouvrir** les Variables d'Environnement Windows :
   - `Win + R` → `sysdm.cpl` → Onglet "Avancé" → "Variables d'environnement"

2. **Modifier** la variable `PGADMIN_INT_PORT` :
   - **Ancienne valeur** : `3000`
   - **Nouvelle valeur** : `5050`

3. **Redémarrer** pgAdmin 4

---

## Ports Recommandés

| Service | Port | Description |
|---------|------|-------------|
| **API Backend** | `3000` | NestJS API Server |
| **Web App** | `3001` | Next.js Application |
| **pgAdmin 4** | `5050` | Interface PostgreSQL (recommandé) |
| **PostgreSQL** | `5432` | Base de données |

---

## Vérification

Après le changement :

1. **Redémarrer pgAdmin 4**
2. **Vérifier** que pgAdmin démarre sans erreur
3. **Accéder** à pgAdmin via : `http://localhost:5050` (si port fixe activé)

---

## Note

Si vous choisissez de **désactiver le port fixe** (`fixed_port: false`), pgAdmin utilisera un port aléatoire disponible à chaque démarrage. C'est la solution la plus simple et évite les conflits futurs.
