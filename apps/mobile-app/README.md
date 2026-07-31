# Academia Helm Mobile — DÉPLACÉ

L'application mobile a été déplacée vers un repo dédié :

**https://github.com/SenaDev007/Academia-Helm-mobile**

Ce dossier contient la dernière version connue mais n'est plus maintenu ici.
Pour travailler sur l'app mobile, clonez le repo dédié.

## Pourquoi la séparation ?

- Le repo principal (Academia-Helm) contient le web + API + desktop
- Le repo mobile (Academia-Helm-mobile) est indépendant pour faciliter
  le développement avec Android Studio / Flutter
- L'app mobile se connecte à la même API (api.academiahelm.com)
  et partage la même base Neon PostgreSQL

## Configuration API

L'app mobile utilise :
- API_BASE_URL : https://api.academiahelm.com/api
- Endpoints sync : /api/sync/pull + /api/sync/push
- Auth : JWT (même que le web)
