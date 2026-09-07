# Academia Community — Application mobile (Flutter)

Application mobile officielle de **Academia Community**, l'espace communautaire
d'Academia Helm. Architecture calquée sur **yeshua-connect-mobile**
(flutter_riverpod + go_router + dio) :

| Couche | Contenu |
|---|---|
| `lib/core/config` | URL API via `--dart-define` (zéro fichier à modifier) |
| `lib/core/router` | GoRouter exposé en **Provider** + `refreshListenable` (pont Riverpod → Listenable) |
| `lib/data/api` | dio + JWT Bearer (`Authorization`), token persisté `shared_preferences` |
| `lib/data/models` | Membres, canaux (GLOBAL/ÉCOLE + groupes), messages (réactions, sondages), événements |
| `lib/data/repositories` | Auth (login + **pont comptes écoles**), canaux, messages, événements |
| `lib/state` | StateNotifiers : session, canaux (polling 20 s), chat (polling 10 s `since=`), events (30 s) |
| `lib/ui` | Splash → Login → Home (Discussions / Lives / Profil) → Chat ; bulles, réactions, sondages |

## Spécificité v2 — canaux dynamiques par école

- **Toutes les écoles** : les canaux globaux (annonces, conseils quotidiens,
  formation, discussion, support, témoignages, sondages)
- **Votre école** : salon de l'école (annonces générales de l'établissement) +
  groupe **administrateurs** 🛡️ + groupe **enseignants** 👨‍🏫 — visibles selon
  votre rattachement
- **Lives & formations** : dispatch par audience (toutes les écoles / une
  école / un groupe) — badge EN DIRECT, lien de rejointe
- **Pont comptes écoles** : les administrateurs et enseignants se connectent
  avec leurs identifiants Academia Helm — l'API provisionne automatiquement
  écoles + groupes (`viaAppLink`)

## Build

```sh
# API par défaut : https://api.academiahelm.com/api
flutter pub get
flutter run

# APK release avec URL explicite :
flutter build apk --release \
  --dart-define=API_BASE_URL=https://<votre-api>.up.railway.app/api
```

## Extensions prévues (README uniquement — non incluses v1)

- `url_launcher` : ouverture directe des liens de lives (YouTube/Meet/Zoom)
- `flutter_secure_storage` : stockage durci du token
- FCM : notifications push des lives et annonces de votre école
