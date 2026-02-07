# 🔧 Installation du Windows SDK pour Visual Studio Build Tools

**Date** : 2025-01-17

---

## 📋 Problème

Visual Studio Build Tools est installé mais il manque le **Windows SDK** nécessaire pour compiler `better-sqlite3`.

**Erreur** :
```
gyp ERR! find VS - found VC++ toolset: v143
gyp ERR! find VS - missing any Windows SDK
```

---

## ✅ Solution : Installer le Windows SDK

### Méthode 1 : Via Visual Studio Installer (Recommandé)

1. **Ouvrir Visual Studio Installer**
   - Recherchez "Visual Studio Installer" dans le menu Démarrer
   - Ou allez dans : `C:\Program Files (x86)\Microsoft Visual Studio\Installer\vs_installer.exe`

2. **Modifier Visual Studio Build Tools 2022**
   - Cliquez sur **Modifier** à côté de "Visual Studio Build Tools 2022"

3. **Installer le Windows SDK**
   - Cochez **"Développement Desktop en C++"** (Desktop development with C++)
   - Dans les composants, assurez-vous que **"Windows 10 SDK"** ou **"Windows 11 SDK"** est coché
   - Cliquez sur **Modifier** pour installer

4. **Redémarrer** votre terminal après l'installation

### Méthode 2 : Installer Windows SDK Séparément

1. **Télécharger Windows SDK**
   - Allez sur : https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/
   - Téléchargez le **Windows 11 SDK** (ou Windows 10 SDK)

2. **Installer le SDK**
   - Exécutez l'installateur
   - Cochez au minimum :
     - **Windows SDK**
     - **MSVC v143 - VS 2022 C++ x64/x86 build tools**

3. **Redémarrer** votre terminal

---

## 🧪 Vérification

Après l'installation, testez la compilation :

```bash
cd apps/api-server
npm rebuild better-sqlite3
```

Si ça fonctionne, vous verrez :
```
✅ better-sqlite3 rebuilt successfully
```

---

## ⚠️ Note Importante

**Le projet Academia Hub utilise PostgreSQL, pas SQLite.**

Donc `better-sqlite3` n'est **pas nécessaire** pour faire fonctionner l'application. Vous pouvez continuer à utiliser `--ignore-scripts` lors de l'installation des dépendances.

---

## 🎯 Recommandation

**Pour le développement** : Continuez avec `npm install --ignore-scripts` (déjà fait ✅)

**Si vous voulez compiler better-sqlite3** : Installez le Windows SDK selon la méthode 1 ci-dessus.

---

**Dernière mise à jour** : 2025-01-17
