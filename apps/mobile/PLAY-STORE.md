# Déploiement Play Store — Academia Helm (Android)

> Guide complet et pas-à-pas pour publier `com.yehiortech.academiahelm` sur
> le Google Play Store. État au 2026-10-25 — l'APK **debug** a été validée sur
> téléphone (sous l'ancien package `io.academiahelm.mobile`) ; le package a
> depuis été renommé avant toute publication (définitif à vie au premier
> upload) ; ce document couvre tout le reste jusqu'à la mise en production.
>
> Architecture rappel : coquille Capacitor chargeant l'app web LIVE
> (`https://academiahelm.com/portal`). Les mises à jour **web** se propagent
> instantanément ; seuls plugins/config/icônes exigent une nouvelle APK/AAB.

---

## 0. Où en est-on ? (checklist d'état)

| # | Étape | État | Détail |
|---|-------|------|--------|
| 1 | Signature release (`build.gradle` + `keystore.properties`) | ✅ Fait (ce dépôt) | §3 |
| 2 | Keystore de release généré | ✅ Fait | Bundle `download/play-store/` — à **sauvegarder** §3.2 |
| 3 | `assetlinks.json` (App Links vérifiés) | ✅ Fait | `apps/web-app/public/.well-known/` §6.2 |
| 4 | Permission `POST_NOTIFICATIONS` (Android 13+) | ✅ Fait | `AndroidManifest.xml` |
| 5 | Icône Play 512×512 + bannière 1024×500 | ✅ Fait | `apps/mobile/store-assets/` §5.2 |
| 6 | Textes de fiche (FR) | ✅ Rédigés | Annexe A |
| 7 | **Renommage package → `com.yehiortech.academiahelm`** | ✅ Fait (ce dépôt) | §3.5 — définitif au premier upload |
| 8 | **Ré-enregistrement Firebase (FCM)** pour le NOUVEAU package | ⬜ À faire (vous) | §4.3 — requis pour le push |
| 9 | Compte développeur Play Console | ⬜ À faire (vous) | §2 — frais uniques 25 $ |
| 10 | Sauvegarde du keystore (×3) | ⬜ À faire (vous) | §3.2 — **critique** |
| 11 | Installation du keystore sur votre machine | ⬜ À faire (vous) | §3.3 |
| 12 | Construction AAB + test release | ⬜ À faire (vous) | §4 |
| 13 | Captures d'écran téléphone (min. 2) | ⬜ À faire (vous) | §5.2 |
| 14 | Compte démo pour « Accès à l'app » | ⬜ À faire (vous) | §5.3 |
| 15 | Fiche + questionnaires Play Console | ⬜ À faire (vous) | §5 |
| 16 | Upload AAB + piste interne → production | ⬜ À faire (vous) | §5.10 |

---

## 1. Vue d'ensemble du processus

La publication se déroule en quatre phases distinctes, chacune avec ses
propres prérequis. Premièrement, la préparation technique (signature,
visuels, textes) est **déjà finalisée** dans ce dépôt — il ne reste qu'à
récupérer le keystore livré séparément. Deuxièmement, le compte développeur
Google Play doit être créé et vérifié, ce qui prend de quelques heures à
plusieurs semaines selon le type de compte (§2 — anticiper dès maintenant,
c'est le facteur temps dominant). Troisièmement, l'AAB (Android App Bundle,
format obligatoire pour les nouvelles apps) est construit sur votre machine
dans Android Studio — exactement comme l'APK debug que vous avez déjà
produite, avec la commande `bundleRelease` au lieu de `assembleDebug`
(§4). Quatrièmement, la fiche Play Store est remplie dans la Play Console
(fiche, captures, questionnaires de contenu et de sécurité des données —
toutes les réponses sont pré-rédigées dans les annexes), puis l'AAB est
téléversé d'abord sur la **piste interne** pour un dernier test, avant la
soumission en production. La revue Google prend généralement 1 à 7 jours
pour une première publication.

---

## 2. Le compte développeur Play Console

### 2.1 Quel type de compte choisir ?

Deux voies existent, avec une différence de contrainte majeure :

| | **Compte organisation** (recommandé) | Compte personnel |
|---|---|---|
| Frais | 25 $ une seule fois | 25 $ une seule fois |
| Document requis | Numéro **D-U-N-S** (Dun & Bradstreet, gratuit, obtention 1–30 j) | Pièce d'identité personnelle |
| Test obligatoire avant production | Non | **Oui** : 20 testeurs fermés pendant 14 jours consécutifs (règle Google pour les comptes personnels créés après nov. 2023) |
| Nom affiché sur la fiche | Nom de la structure | Votre nom |

**Recommandation** : compte **organisation** au nom de l'entité éditrice
d'Academia Helm. Il évite l'exigence des 20 testeurs × 14 jours (un mois
perdu sinon) et crédibilise la fiche. Si vous n'avez pas de D-U-N-S,
demandez-le dès aujourd'hui sur le site Dun & Bradstreet (recherche « D-U-N-S
request ») — c'est gratuit mais parfois lent ; en attendant, un compte
personnel reste utilisable au prix du délai de test fermé.

### 2.2 Création

1. `play.google.com/console` → « Créer un compte » → payer les 25 $ (carte
   bancaire ; à défaut, une carte prépayée virtuelle fonctionne).
2. Renseigner le **nom développeur** affiché publiquement : par exemple
   « **Yehiortech** » (30 caractères max — cohérent avec le package
   `com.yehiortech.academiahelm`, §3.5).
3. Compléter la vérification d'identité (pièce d'identité / documents
   organisation selon le type choisi) — les nouvelles règles Google exigent
   cette étape avant toute publication.
4. Renseigner un **e-mail de contact** public (montré sur la fiche) et un
   téléphone : utiliser `support@academiahelm.com` **après vérification de
   la boîte** (voir note §5.7).

---

## 3. Le keystore de release — l'identité définitive de l'app

### 3.1 Ce qui a été généré

Le keystore a été généré (RSA 2048, validité 10 000 jours, DN
`CN=Academia Helm, OU=Mobile, O=Academia Helm, L=Cotonou, C=BJ`) et livré
dans le dossier `download/play-store/` :

```
download/play-store/
├── academia-helm-release.keystore   ← LE trésor : identité de l'app Android
├── keystore.properties              ← secrets de signature Gradle (à copier)
└── README-SIGNING.txt               ← mot de passe + empreintes + consignes
```

Empreintes du certificat :

| Empreinte | Valeur |
|---|---|
| SHA-1 | `91:52:30:0A:54:EA:E0:77:54:8E:EA:6A:2F:35:BC:58:04:30:00:77` |
| SHA-256 | `21:24:E3:6E:38:33:EA:52:D4:E4:D6:D9:32:E5:1E:F2:35:89:A1:0E:9C:B2:F8:1A:08:AD:22:02:AE:1C:85:52` |

Le mot de passe (identique pour le magasin et la clé) figure dans
`keystore.properties` et `README-SIGNING.txt`. Il n'est volontairement
**jamais commité** dans ce dépôt.

### 3.2 Sauvegarde — à faire AVANT tout le reste

> **⚠️ Règle absolue : perdre ce fichier (ou son mot de passe) rend
> IMPOSSIBLE toute future mise à jour de l'app sur le Play Store.** Google
> ne peut pas le régénérer — seuls un appel API assisté et de longs
> justificatifs permettent parfois un reset, sans garantie.

Sauvegardez le fichier `.keystore` ET son mot de passe en **trois lieux
distincts minimum** : (a) disque externe / clé USB rangée hors site,
(b) coffre numérique (Bitwarden, 1Password, Google Drive privé chiffré —
attacher le fichier en pièce jointe sécurisée), (c) une copie remise à une
second personne de confiance. Le mot de passe doit être conservé
séparément du fichier (un voleur du coffre ne doit pas obtenir les deux).

### 3.3 Installation sur votre machine de build

Sur l'ordinateur où Android Studio est installé :

```bash
cd apps/mobile/android
# 1. copier le keystore dans app/
cp <téléchargements>/academia-helm-release.keystore app/
# 2. copier les secrets de signature à la racine de android/
cp <téléchargements>/keystore.properties .
```

Après cela, `app/build.gradle` signe automatiquement tout build `release`
(la lecture de `keystore.properties` y est déjà câblée). Les deux fichiers
sont **gitignorés** — un `git status` propre est le comportement attendu.

### 3.4 Changer le mot de passe (recommandé après réception)

Puisque le mot de passe vous a été transmis via le livrable de préparation,
il est de bonne pratique d'en choisir un vôtre, connu de vous seul :

```bash
keytool -storepasswd -keystore app/academia-helm-release.keystore
keytool -keypasswd -alias academiahelm \
        -keystore app/academia-helm-release.keystore
```

Mettre ensuite à jour `keystore.properties` avec le nouveau mot de passe.
Les empreintes SHA ne changent **pas** (le certificat reste identique).

### 3.5 Identité de l'app — package `com.yehiortech.academiahelm`

Le nom de package (applicationId) est l'identité **définitive** de l'app sur
le Play Store : une fois la première version publiée, il est **impossible à
changer** (ni transfert vers un autre package, ni rachat — il faudrait
publier une app « nouvelle » et perdre les installations).

> ✅ Le renommage `io.academiahelm.mobile` → `com.yehiortech.academiahelm`
> a été effectué le 2026-10-25, **avant toute publication** — au bon moment.

Fichiers impactés (tous déjà mis à jour dans ce dépôt) :

| Fichier | Rôle |
|---|---|
| `apps/mobile/capacitor.config.ts` | `appId` Capacitor (génère l'identité native) |
| `android/app/build.gradle` | `namespace` + `applicationId` (l'identité Play Store) |
| `android/app/src/main/java/com/yehiortech/acadiahelm/MainActivity.java` | package Java (arborescence déplacée) |
| `android/app/src/main/res/values/strings.xml` | `package_name` + schéma d'URL personnalisé |
| `android/app/google-services.json` | package Firebase (à re-télécharger, voir §4.3) |
| `apps/web-app/public/.well-known/assetlinks.json` | App Links vérifiés (web, déployé Vercel) |

Conséquences pratiques :

- **Le keystore reste valable** — il signe le nouveau package sans changement
  (les empreintes SHA sont indépendantes du nom de package).
- **L'APK debug déjà installée** sur votre téléphone porte l'ANCIEN package :
  après rebuild, l'app s'installe comme une **application différente** (deux
  icônes). Désinstallez l'ancienne : `adb uninstall io.academiahelm.mobile`.
- **FCM exige le ré-enregistrement Firebase** du nouveau package (§4.3).
- **App Links** : `assetlinks.json` a été mis à jour puis redéployé — la
  vérification Android fonctionne pour le nouveau package.

---

## 4. Construire l'AAB et tester le build release

### 4.1 Build de l'AAB (format Play Store)

```bash
cd apps/mobile
npx cap sync android          # ⚠️ OBLIGATOIRE ici : capacitor.config.ts a changé (appId)
cd android
./gradlew bundleRelease       # Windows : gradlew.bat bundleRelease
```

Résultat : `app/build/outputs/bundle/release/app-release.aab` — c'est **ce
fichier** que l'on téléverse sur la Play Console (jamais d'APK pour une
première publication : l'AAB est obligatoire pour les nouvelles apps).

### 4.2 Tester la version signée avant l'upload

Un test local du build release signé évite de découvrir un problème devant
les réviseurs Google. Générer l'APK release (mêmes sources, même signature)
et l'installer par-dessus la version debug — **désinstallez d'abord la
debug** si Android refuse la signature différente :

```bash
cd apps/mobile/android
./gradlew assembleRelease
adb uninstall io.academiahelm.mobile        # enlever l'ANCIENNE app debug (autre package)
adb install -r app/build/outputs/apk/release/app-release.apk
```

Vérifications attendues sur le téléphone : démarrage → écran de chargement
logo/spinner → portail ; login école + login parent ; zone de statut navy ;
retour de paiement FedaPay. Tout ce qui a été validé en debug doit se
reproduire à l'identique — seule la signature change.

### 4.3 ⚠️ AVANT le build : ré-enregistrer l'app dans Firebase (FCM)

Le renommage du package (§3.5) invalide l'enregistrement Firebase : le
fichier `google-services.json` du dépôt a été mis à jour pour que le build
passe, mais la console Firebase ne connaît pas encore
`com.yehiortech.academiahelm` — sans enregistrement, l'obtention du jeton
FCM échoue silencieusement (notifications jamais reçues, sans crash).

Procédure (~5 minutes, à faire une seule fois) :

1. Console **Firebase** → projet `academia-helm-35536` (celui du web —
   même projet, la clé serveur côté api-server ne change donc PAS).
2. ⚙️ **Paramètres du projet → Général → Vos applications → Ajouter une
   application** → icône Android.
3. Nom du package Android : `com.yehiortech.academiahelm` (exactement).
4. *(Recommandé)* Ajouter les empreintes du keystore (§3.1) : SHA-1
   `91:52:30:0A:54:EA:E0:77:54:8E:EA:6A:2F:35:BC:58:04:30:00:77` et SHA-256
   `21:24:E3:6E:38:33:EA:52:D4:E4:D6:D9:32:E5:1E:F2:35:89:A1:0E:9C:B2:F8:1A:08:AD:22:02:AE:1C:85:52`.
5. **Télécharger `google-services.json`** → remplacer
   `apps/mobile/android/app/google-services.json` (le nouveau fichier
   contient le client du nouveau package — c'est lui qui fait foi).
6. *(Après activation de Play App Signing, §5.9)* revenir ajouter l'empreinte
   SHA de la clé Google dans ce même enregistrement.

Ne pas créer de NOUVEAU projet Firebase — tout l'existant (clé serveur,
configuration) resterait derrière. On ajoute simplement une application au
projet existant ; l'ancien client `io.academiahelm.mobile` peut rester, il ne
gêne pas (l'app debug obsolète sur votre téléphone continuera même à
recevoir ses propres notifications tant qu'elle est installée).

---

## 5. La Play Console pas à pas

### 5.1 Créer l'application

Play Console → « Créer une application » :

| Champ | Valeur |
|---|---|
| Nom de l'app | `Academia Helm` |
| Langue par défaut | `fr-FR` (français) |
| App ou jeu | **App** |
| Gratuit ou payant | **Gratuit** (l'app elle-même ne se vend pas) |

> Le nom de package `com.yehiortech.academiahelm` n'est PAS demandé à la
> création : il est lu automatiquement dans l'AAB au premier upload — et il
> s'y fixe définitivement (d'où le renommage avant publication, §3.5).

Le **nom développeur** (renseigné à la création du compte, §2.2) est affiché
sur la fiche sous le titre : utiliser l'identité éditrice, par exemple
**Yehiortech** (cohérent avec le package `com.yehiortech.…` — 30 caractères
max). Il est modifiable plus tard sans nouvelle revue.

### 5.2 Fiche Play (présence sur le Play Store)

Menu **Présence sur le Play Store → Fiche principale**. Tous les textes
prêts à copier sont en **Annexe A**. Les visuels :

| Élément | Source | Spécifications |
|---|---|---|
| Icône app (fiche Play) | `apps/mobile/store-assets/play-icon-512.png` | 512×512 PNG 32 bits **fond transparent** (logo flottant, artwork centré pour le masque squircle Play — transparence autorisée par la spéc officielle) — ✅ logo original (2026-11-19) |
| Icône launcher (installation) | `android/app/src/main/res/mipmap-*` + `values/ic_launcher_background.xml` | **fond BLANC #FFFFFF plein** (choix promoteur 2026-11-19) — fond PLEIN obligatoire pour le launcher : transparent = composité blanc/noir selon l'appareil. Le Play 512 reste transparent (masque squircle Play). |
| Bannière (feature graphic) | `apps/mobile/store-assets/feature-graphic-1024x500.jpg` | 1024×500, JPEG 24 bits sans alpha — ✅ fournie (2026-11-19) |
| Captures téléphone | À faire §5.2.1 | **min. 2**, JPEG/PNG 16:9 ou 9:16 |
| Captures tablette 7″/10″ | Optionnelles | recommandé plus tard |

#### 5.2.1 Prendre les captures d'écran (5 minutes)

Sur le téléphone où l'APK debug/release est installée : naviguer dans les
écrans les plus parlants (sélection de portails, tableau de bord, notes,
finances) et capturer avec **Power + Volume bas**. Les fichiers PNG
apparaissent dans Galerie/Photos ; les transférer vers l'ordinateur et les
téléverser telles quelles (une résolution 1080×1920 ou supérieure est idéale ;
le minimum absolu est 320 px de côté). Six captures variées donnent une fiche
professionnelle : portails, connexion, tableau de bord, vie scolaire,
examens/notes, finances.

### 5.3 Accès à l'app (App access)

Les réviseurs Google doivent pouvoir explorer l'app derrière le login.
Menu **Configurer l'accès à l'app** → « Tout le contenu est protégé par un
compte » → ajouter un identifiant :

- **Préparer un compte de démonstration** : de préférence un compte
  enseignant ou membre de direction sur un tenant de test, avec des données
  factices (pas de vrais élèves — la fiche et les captures finissent en
  partie publiques). Si aucun n'existe, créer p.ex.
  `demo-mobile@<école-test>` avec un mot de passe simple et le mentionner.
- Renseigner : identifiant, mot de passe, et une note d'instructions en
  anglais simple, par exemple : *“Log in with these credentials, then pick
  any portal from the /portal screen. All features are web-driven.”*

### 5.4 Questionnaire de classification du contenu

Menu **Politique de l'app → Classification du contenu** ; répondre
honnêtement (réponses attendues pour notre cas) :

| Question | Réponse |
|---|---|
| Violence / effrayant / nudité / jeu d'argent / drogues / langage grossier / humour contesté | **Non** à toutes ces questions |
| Contenu contrôlé ou marchandise dangereuse | **Non** |
| Les utilisateurs peuvent-ils interagir ou partager du contenu ? | **Oui** — messagerie/notifications internes à l'école entre comptes créés par l'établissement |
| L'app permet-elle aux utilisateurs de discuter librement (chat) ? | **Oui, restreint** : communication encadrée école ↔ familles au sein de comptes identifiés |
| Contenu généré par les utilisateurs non modéré ? | **Non** — contenu sous le contrôle de l'administration scolaire |

Résultat attendu : **3+ (Tout public)** — cohérent avec une app de gestion
scolaire. Déclarer les interactions utilisateur de façon véridique évite
un rejet pour déclaration inexacte.

### 5.5 Déclaration de sécurité des données (Data safety)

Menu **Politique de l'app → Sécurité des données**. Les réponses exactes
sont en **Annexe B** — résumé : données collectées via la plateforme
(adresses e-mail, noms, identifiants de comptes, photos d'élèves,
identifiants d'appareil Firebase) ; **aucun partage tiers** ; chiffrement
HTTPS en transit ; suppression possible via la politique de confidentialité.

### 5.6 Audience cible et catégories

- **Audience cible** : tranches d'âge — cocher **18–24 et +** seulement.
  « L'app est-elle destinée aux enfants ? » → **Non** (utilisateur :
  directions, enseignants, parents). Cela exclut l'app des exigences
  « Families », plus lourdes à respecter.
- **Catégorie** : **Éducation** (sous-catégorie propose « Éducation »
  simple).
- **Tags** (mots-clés de recherche) : gestion scolaire, école, notes,
  bulletins, frais de scolarité, enseignant, parent, établissement.

### 5.7 Politique de confidentialité

Exigée pour toute app. La nôtre existe déjà :

```
https://academiahelm.com/legal/privacy
```

La page mentionne le RGPD, le droit de suppression et un e-mail de contact.
**Point à vérifier avant soumission** : la page indique
`support@academiahub.com` (Hub, pas Helm). S'assurer que cette adresse
existe réellement et est suivie — sinon corriger la page vers
`support@academiahelm.com` et renseigner la même adresse comme e-mail de
contact Play Console. Les réviseurs testent parfois ces adresses.

### 5.8 Pays et disponibilité

**Sélection des pays** : restreindre au **Bénin** pour le lancement (revue
plus simple, retours maîtrisés), puis étendre (Togo, Côte d'Ivoire, Sénégal,
Niger, Burkina…) depuis « Pays et régions » sans nouvelle revue de contenu.
Les prix ne s'appliquent pas (app gratuite).

### 5.9 Play App Signing (à l'upload du premier AAB)

À la première soumission d'un AAB, Google propose le programme **Play App
Signing** (obligatoire pour les nouvelles apps) : Google garde la clé de
signature *finale* (« app signing key ») et re-signe vos paquets ; votre
keystore devient la clé d'*upload*.

- Choisir **« Laisser Google générer et gérer la clé de signature »**
  (option par défaut, la plus robuste — aucune action sur votre keystore).
- Conséquence : l'empreinte **du binaire distribué** est celle de la clé
  Google, différente de celle de notre keystore d'upload.
- **Après l'upload**, récupérer l'empreinte réelle : Play Console →
  **Configuration → Signature de l'app** → « Certificat de clé de signature
  de l'app » → copier le **SHA-256**. Puis :
  1. l'ajouter dans `apps/web-app/public/.well-known/assetlinks.json`
     (tableau `sha256_cert_fingerprints` — garder aussi l'empreinte actuelle ;
     les deux coexistent) et déployer sur Vercel ;
  2. l'ajouter dans la console **Firebase** (Projet academia-helm-35536 →
     Paramètres → Empreintes de certificat SHA) — utile pour les services
     Firebase, FCM fonctionnant sans elle.

### 5.10 Téléverser et publier

1. **Tester en interne d'abord** : menu Test → **Test interne** → créer une
   version → téléverser `app-release.aab` → ajouter votre Gmail comme
   testeur → lien d'installation → installer depuis le Play Store et
   vérifier sur votre téléphone. Ce circuit valide le binaire signé *par
   Google* (App Links compris).
2. **Production** : menu Production → créer une version → téléverser le même
   AAB → notes de version (Annexe A.4) → « Envoyer pour examen ».
3. Reveux Google : typiquement **1 à 7 jours** pour une première version ;
   un rapport pré-lancement automatique est généré sur la piste interne.
   En cas de rejet, la console indique la politique en cause et le mail
   associé — corriger puis resoumettre (le §7 traite le seul risque
   identifié d'avance).

---

## 6. App Links (liens profonds vérifiés) — déjà publiés

### 6.1 Ce qui est en place

L'app déclare `academiahelm.com` et `enseignant.academiahelm.com` en liens
vérifiés (`AndroidManifest.xml`, `autoVerify="true"`). Le fichier
`/.well-known/assetlinks.json` est commité dans
`apps/web-app/public/.well-known/assetlinks.json` avec l'empreinte
SHA-256 du keystore, et le middleware Next.js sert ce chemin **tel quel sur
tous les domaines** (exclusion ajoutée au matcher). Après le déploiement
Vercel de ce commit, vérifier :

```
https://academiahelm.com/.well-known/assetlinks.json          → 200 + JSON
https://enseignant.academiahelm.com/.well-known/assetlinks.json → 200 + JSON
```

### 6.2 Vérifier sur un téléphone (après installation via Play)

```bash
adb shell pm verify-app-links --re-verify com.yehiortech.academiahelm
adb shell pm get-app-links com.yehiortech.academiahelm
# attendu : domain_status=verified pour les deux domaines
```

Un lien https://academiahelm.com/… reçu par mail/WhatsApp s'ouvre alors
dans l'app au lieu du navigateur. **Rappel §5.9** : après l'activation de
Play App Signing, ajouter l'empreinte de la clé Google au JSON avant de
considérer cette vérification comme définitive.

---

## 7. Conformité aux politiques Google — analyse

### 7.1 Paiements dans l'app (FedaPay / FeexPay / Mobile Money)

Deux situations bien distinctes :

- **Frais de scolarité, cantine, boutique, documents scolaires** : paiement
  de **services réels** (biens et prestations du monde physique) via la
  passerelle dans le WebView → **autorisé** sans Play Billing (comme un
  voyage Uber payé dans l'app).
- **Abonnement enseignant (2 000 XOF/mois)** : accès à un service numérique
  → les règles Google exigent en théorie Google Play Billing pour ce type
  de bien consommé dans l'app. Deux amortisseurs de risque : (a) le compte
  marchand Play Billing n'est pas ouvert aux développeurs du Bénin, ce qui
  rend Play Billing pratiquement indisponible pour vous ; (b) l'app
  n'existe que depuis la V1 et la revue est essentiellement automatisée.
  **Décision V1 : conserver le paiement web dans le WebView** (statu quo),
  et documenter le plan B.

**Plan B (si rejet un jour)** — modèle « Netflix » : ouvrir le *seul* flux
d'abonnement enseignant dans le **navigateur externe** au lieu du WebView.
L'helper natif existe déjà (`is-native-app.ts` utilisé pour masquer la
bannière PWA) : au clic « Payer », si `isNativeApp()`, rediriger vers
`window.open(url_paiement, '_system'|'_blank')` au lieu de la navigation
Capacitor ; le retour éventuel passe par un App Link (déjà vérifiés, §6).
Les autres paiements (frais réels) restent dans l'app.

### 7.2 Notifications push

Le plugin FCM est intégré et `POST_NOTIFICATIONS` est déclaré dès la V1 ;
le pont web (enregistrement du jeton vers `api-server`) reste à implémenter
— **non bloquant** pour la publication, et deployable côté web plus tard
sans nouvelle APK : les notifications deviendront simplement actives.

### 7.3 Contenu / comptes

L'app héberge du contenu généré par les écoles (photos d'élèves, notes) :
c'est couvert par la Data Safety (Annexe B) et la politique de
confidentialité. Les comptes sont créés par l'administration de chaque
établissement — aucun compte enfant autonome.

---

## 8. Après la publication — cycle de mise à jour

| Changement | Action | Délai |
|---|---|---|
| Bug / fonctionnalité **web** | rien à faire (déploiement Vercel) | immédiat |
| Config Capacitor / plugins / icônes | bump `versionCode` (build.gradle) → `npx cap sync android` → `bundleRelease` → nouvelle version sur la piste interne puis production | revue Google : heures → 3 j |
| Correctif urgent | piste production, « mise à jour expéditive » | minutes–heures |

Règles d'incrémentation : `versionCode` = entier qui **augmente toujours**
(1 → 2 → 3…) ; `versionName` = affichage (« 1.0.1 », « 1.1.0 »…). Conserver
le keystore et le même compte Play Console pour toutes les versions — c'est
la paire (applicationId, clé d'upload) qui identifie la continuité de l'app.

---

## Annexe A — Fiche Play Store prête à copier

> Tous les champs de la fiche principale (Play Console → Présence sur le
> Play Store → Fiche principale), dans l'ordre du formulaire, avec les
> limites de caractères. Rédigés pour `com.yehiortech.academiahelm`,
> éditeur **Yehiortech**, langue `fr-FR`.

### A.0 Champs d'identité (formulaire fiche)

| Champ | Valeur | Limite |
|---|---|---|
| Titre de l'app | `Academia Helm` | 30 ✅ (13) |
| Description courte | voir A.2 | 80 ✅ |
| Description complète | voir A.3 | 4000 ✅ (~1500) |
| Éditeur (nom développeur) | `Yehiortech` | 30 ✅ (9) |
| Adresse e-mail | `support@academiahelm.com` (après vérif. §5.7) | — |
| Téléphone | facultatif | — |
| Site web | `https://academiahelm.com` | — |

### A.1 Titre (max 30)

```
Academia Helm
```

### A.2 Description courte (max 80)

```
Écoles, enseignants, parents : toute la vie scolaire dans une seule app.
```

### A.3 Description complète (max 4000)

```
Academia Helm est la plateforme complète de gestion scolaire pensée pour
les écoles d'Afrique de l'Ouest. Directions, enseignants, parents et élèves
se retrouvent dans une application unique, simple et sécurisée.

POUR LES ÉCOLES ET LES DIRECTIONS
• Gestion des élèves : inscriptions, réinscriptions, dossiers complets
• Finances : frais de scolarité, encaissements, relances, rapports en temps réel
• Personnel : contrats, paie, congés, documents RH
• Examens et notes : bulletins, moyennes, classements, conseils de classe
• Communication : messages, e-mails et notifications aux familles
• Boutique, cantine et économat : ventes, stocks, achats
• Multi-sites : plusieurs campus gérés dans un même établissement

POUR LES ENSEIGNANTS
• Cahiers de textes et cahiers de notes numériques
• Saisie des notes et génération des bulletins
• Emplois du temps et organisation pédagogique
• Bibliothèque de ressources pédagogiques (schémas, illustrations)

POUR LES PARENTS ET LES ÉLÈVES
• Suivi des notes et des bulletins en ligne
• Suivi des frais de scolarité et paiements par mobile money
• Informations et notifications de l'école en temps réel
• Documents scolaires disponibles à tout moment

POURQUOI ACADEMIA HELM
• Conçue pour la réalité des établissements africains : multi-sites,
  mobile money, connexion lentement compensée par le mode hors-ligne
• Une seule app pour tous les rôles de la communauté éducative
• Données protégées : chaque école dispose de son espace sécurisé
• Évolutive : de nouvelles fonctions arrivent régulièrement sans
  réinstallation

Pour utiliser l'application, votre établissement doit être inscrit sur la
plateforme Academia Helm. Contactez-nous depuis notre site pour créer le
compte de votre école.

Academia Helm est éditée par Yehiortech.
```

### A.4 Notes de version — v1.0.0 (première version)

```
Première version publique d'Academia Helm sur Android.
• Tous les portails : école, enseignant, parent/élève
• Paiement des frais par mobile money (FedaPay, FeexPay)
• Mode hors-ligne partiel et reprise de session automatique
• Liens de l'école ouvrant directement dans l'app
```

### A.5 Identité de contact (fiche)

| Champ | Valeur |
|---|---|
| Éditeur (nom développeur) | `Yehiortech` |
| Site web | `https://academiahelm.com` |
| E-mail | `support@academiahelm.com` (après vérification §5.7) |
| Téléphone | facultatif |
| Package (lecture auto par l'AAB) | `com.yehiortech.academiahelm` |

---

## Annexe B — Réponses « Sécurité des données » (exactes)

Questionnaire Play Console → Politique de l'app → Sécurité des données :

**1. Collectez-vous des données ?** — **Oui**

**2. Quelles données ?** (ajouter une entrée par type) :

| Type | Données | Collectée ? | Partagée ? | Traitement facultatif ? |
|---|---|---|---|---|
| Informations personnelles | Adresse e-mail, Nom | Oui — créée et utilisée pour la fonctionnalité de l'app | Non | Non (requis pour la connexion) |
| Identifiants d'utilisateur | Identifiant de compte (profil école/enseignant/parent) | Oui — fonctionnalité de l'app | Non | Non |
| Photos et vidéos | Photos d'élèves / pièces jointes | Oui — fonctionnalité de l'app | Non | Non |
| Identifiants d'appareil ou autres | Jeton de notification Firebase | Oui — fonctionnalité de l'app | Non | Oui (notifications) |

**3. Les données sont-elles chiffrées en transit ?** — **Oui** (HTTPS
obligatoire, tout le trafic passe par academiahelm.com et son API).

**4. Les utilisateurs peuvent-ils demander la suppression ?** — **Oui** ;
URL de suppression : `https://academiahelm.com/legal/privacy` (droit RGPD,
e-mail support). Cocher la case correspondante pour chaque type collecté.

**5. Données éphémères / stockage local ?** — Non applicable (les données
vivent sur la plateforme de l'école, pas dans le stockage de l'app).

Règle d'or : rester **conservateur** (déclarer « collecté » dès que la
données transite par la plateforme) — une déclaration trop large ne coûte
rien, une déclaration lacunaire peut coûter un rejet.
