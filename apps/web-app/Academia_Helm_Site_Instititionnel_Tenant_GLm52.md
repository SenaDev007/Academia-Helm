# Academia Helm — Spécification du Site Institutionnel Intelligent des Écoles (Tenant Website)

## Destination
**IA de développement : Z.ai (GLM 5.2)**

## Objectif

Chaque école créée sur Academia Helm possède automatiquement un sous-domaine, par exemple :

`https://cspeb-eveildafrique.academiahelm.com`

Ce sous-domaine ne doit pas être uniquement une porte d'entrée vers les portails de connexion.

Il doit devenir un véritable **site institutionnel intelligent**, entièrement administrable depuis Academia Helm.

---

## Vision

Chaque tenant dispose automatiquement :

- d'un site institutionnel professionnel ;
- d'un portail public ;
- des portails sécurisés (École, Enseignant, Parent, Élève) ;
- d'un CMS intégré permettant au promoteur et aux administrateurs de gérer l'intégralité du contenu.

Le site doit respecter la charte graphique Academia Helm tout en permettant la personnalisation de l'identité visuelle de chaque établissement.

---

## Architecture

### Espace public

- Présentation de l'école
- Admissions
- Vie scolaire
- Actualités
- Agenda
- Galerie
- Contact
- FAQ
- Résultats
- Témoignages

### Espaces privés

- Portail École
- Portail Enseignant
- Portail Parent
- Portail Élève

Ces espaces doivent rester totalement indépendants.

---

## CMS intégré

Créer un module :

Administration
→ Site Institutionnel

Sous-onglets :

- Informations générales
- Identité visuelle
- Hero Banner
- Chiffres clés
- Mot du Promoteur
- Mot du Directeur
- Présentation
- Niveaux scolaires
- Admissions
- Corps enseignant
- Vie scolaire
- Actualités
- Agenda
- Galerie
- Témoignages
- FAQ
- Contact
- Réseaux sociaux
- SEO
- Footer
- Paramètres

Chaque bloc doit pouvoir être :

- créé
- modifié
- supprimé
- activé / désactivé
- réordonné
- prévisualisé

---

## Synchronisation automatique

Le site doit consommer les données des modules :

- Élèves
- Personnel
- Communication
- Admissions
- Examens
- Bibliothèque
- EduCast
- ORION
- Paramètres

Sans duplication des données.

---

## Design

Respecter la palette Academia Helm :

- Bleu institutionnel
- Bleu numérique
- Blanc

Design :

- premium
- moderne
- responsive
- animations discrètes
- UX fluide
- mobile first

---

## IA

Prévoir un assistant IA propre à chaque école capable de répondre aux questions des visiteurs en utilisant uniquement les données configurées par l'établissement.

---

## SEO

Prévoir :

- URL propres
- Sitemap
- Robots.txt
- Open Graph
- Meta tags
- Schema.org
- Optimisation Lighthouse

---

## Contraintes

- Architecture multi-tenant
- Respect du RBAC
- Isolation complète des données
- Aucun contenu codé en dur

---

## Critères d'acceptation

- Chaque école possède automatiquement son site.
- Le CMS pilote 100 % du contenu.
- Le sous-domaine est opérationnel.
- Les portails privés restent indépendants.
- Toutes les données proviennent des modules existants.
- Le site respecte la charte graphique Academia Helm.
- Le site est responsive, performant et SEO-friendly.

---

## Instruction finale pour Z.ai (GLM 5.2)

Auditer l'architecture existante avant tout développement.

Réutiliser les composants existants lorsque cela est pertinent.

Créer une architecture modulaire, évolutive et maintenable.

Ne casser aucune fonctionnalité existante.

Respecter intégralement le multi-tenant, le RBAC et la charte graphique Academia Helm.

L'objectif est que chaque tenant bénéficie automatiquement d'un site institutionnel de qualité internationale, administrable sans connaissances techniques.
