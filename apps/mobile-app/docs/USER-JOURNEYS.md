# 🗺️ Parcours Utilisateur — Application Mobile Academia Hub

## Vue d'ensemble

Ce document détaille les parcours utilisateur principaux de l'application mobile Academia Hub pour les parents et les élèves.

---

## 👨‍👩‍👧 Parcours Parent

### 1. Première Connexion

**Objectif** : Se connecter à l'application pour la première fois

**Étapes** :
1. **Ouverture de l'app** → Écran de bienvenue
2. **Sélection "Se connecter"** → Écran de connexion
3. **Saisie email/identifiant** → Validation format
4. **Saisie mot de passe** → Affichage/masquage
5. **Sélection établissement** → Si multi-tenant (liste déroulante)
6. **Validation** → Appel API `/api/auth/login`
7. **Chargement** → Indicateur de chargement
8. **Succès** → Redirection vers HomeScreen
9. **Échec** → Message d'erreur clair

**Cas d'erreur** :
- Identifiants incorrects → "Email ou mot de passe incorrect"
- Compte inexistant → "Aucun compte trouvé"
- Erreur réseau → "Vérifiez votre connexion internet"

**Durée estimée** : 30-60 secondes

---

### 2. Consultation des Notes d'un Enfant

**Objectif** : Consulter les notes de son enfant

**Étapes** :
1. **Accueil** → HomeScreen (liste enfants)
2. **Sélection enfant** → Carte enfant (nom, classe, photo)
3. **Navigation "Notes"** → GradesListScreen
4. **Affichage liste** → Notes par période (trimestre)
5. **Filtrage** → Optionnel : matière, période
6. **Sélection note** → GradeDetailScreen
7. **Consultation détail** → Note, commentaire, classement
8. **Retour** → GradesListScreen
9. **Retour accueil** → HomeScreen

**Données affichées** :
- Liste : Matière, Note, Date, Type
- Détail : Tous les détails + commentaire enseignant

**Actions disponibles** :
- ✅ Filtrer par matière/période
- ✅ Trier par date/note
- ✅ Voir détail
- ❌ Modifier (interdit)

**Durée estimée** : 2-3 minutes

---

### 3. Suivi des Paiements

**Objectif** : Consulter l'état des paiements et télécharger un reçu

**Étapes** :
1. **Accueil** → HomeScreen
2. **Badge "Paiements"** → Indicateur paiements en attente
3. **Navigation "Paiements"** → PaymentsListScreen
4. **Affichage liste** → Paiements par date
5. **Filtrage** → Optionnel : statut (payé, en attente)
6. **Sélection paiement** → PaymentDetailScreen
7. **Consultation détail** → Montant, statut, échéance
8. **Téléchargement reçu** → PDF (si payé)
9. **Retour** → PaymentsListScreen

**Données affichées** :
- Liste : Date, Libellé, Montant, Statut
- Détail : Tous les détails + reçu téléchargeable

**Actions disponibles** :
- ✅ Filtrer par statut
- ✅ Télécharger reçu/facture
- ✅ Partager reçu
- ❌ Payer directement (interdit)

**Durée estimée** : 2-3 minutes

---

### 4. Lecture des Messages de l'École

**Objectif** : Lire les messages importants de l'école

**Étapes** :
1. **Accueil** → HomeScreen
2. **Badge "Messages"** → Indicateur messages non lus
3. **Navigation "Messages"** → MessagesListScreen
4. **Affichage liste** → Messages par date (plus récent en premier)
5. **Filtrage** → Optionnel : non lus, type
6. **Sélection message** → MessageDetailScreen
7. **Lecture contenu** → Marqué automatiquement comme lu
8. **Téléchargement pièce jointe** → Si disponible
9. **Retour** → MessagesListScreen

**Données affichées** :
- Liste : Titre, Expéditeur, Date, Type, Extrait
- Détail : Contenu complet + pièces jointes

**Actions disponibles** :
- ✅ Filtrer par type/statut
- ✅ Marquer comme lu
- ✅ Télécharger pièces jointes
- ✅ Partager message

**Durée estimée** : 1-2 minutes

---

### 5. Consultation du Profil

**Objectif** : Consulter et modifier les informations personnelles

**Étapes** :
1. **Accueil** → HomeScreen
2. **Navigation "Profil"** → ProfileScreen
3. **Affichage informations** → Nom, email, téléphone
4. **Liste enfants** → Si parent (noms, classes)
5. **Modification email** → Si autorisé
6. **Paramètres notifications** → Activer/désactiver types
7. **Déconnexion** → Confirmation → LoginScreen

**Données affichées** :
- Informations personnelles
- Liste enfants (si parent)
- Paramètres notifications
- Informations établissement

**Actions disponibles** :
- ✅ Modifier email/téléphone (limité)
- ✅ Gérer notifications
- ✅ Déconnexion
- ❌ Modifier données critiques (interdit)

**Durée estimée** : 1-2 minutes

---

## 🎓 Parcours Élève

### 1. Première Connexion

**Objectif** : Se connecter à l'application

**Étapes** :
1. **Ouverture de l'app** → Écran de bienvenue
2. **Sélection "Se connecter"** → Écran de connexion
3. **Saisie identifiant** → Généralement numéro élève
4. **Saisie mot de passe** → Affichage/masquage
5. **Sélection établissement** → Si multi-tenant
6. **Validation** → Appel API
7. **Succès** → Redirection vers HomeScreen

**Cas d'erreur** : Identiques au parcours parent

**Durée estimée** : 30-60 secondes

---

### 2. Consultation de ses Notes

**Objectif** : Consulter ses propres notes

**Étapes** :
1. **Accueil** → HomeScreen (résumé notes récentes)
2. **Navigation "Notes"** → GradesListScreen
3. **Affichage liste** → Notes par période
4. **Filtrage** → Optionnel : matière, période
5. **Sélection note** → GradeDetailScreen
6. **Consultation détail** → Note, commentaire, classement
7. **Retour** → GradesListScreen

**Données affichées** :
- Liste : Matière, Note, Date, Type
- Détail : Tous les détails + commentaire

**Actions disponibles** :
- ✅ Filtrer par matière/période
- ✅ Trier par date/note
- ✅ Voir détail
- ❌ Modifier (interdit)

**Durée estimée** : 1-2 minutes

---

### 3. Consultation de l'Emploi du Temps

**Objectif** : Voir son emploi du temps de la semaine

**Étapes** :
1. **Accueil** → HomeScreen
2. **Navigation "Emploi du temps"** → ScheduleScreen
3. **Affichage semaine** → Vue hebdomadaire
4. **Navigation** → Semaine précédente/suivante
5. **Consultation cours** → Détails (salle, enseignant)
6. **Retour** → HomeScreen

**Données affichées** :
- Vue hebdomadaire : Jours, Heures, Matières, Salles
- Détails : Enseignant, Type de cours

**Actions disponibles** :
- ✅ Navigation semaines
- ✅ Voir détails cours
- ❌ Modifier (interdit)

**Durée estimée** : 1 minute

---

### 4. Consultation des Absences

**Objectif** : Voir ses absences et retards

**Étapes** :
1. **Accueil** → HomeScreen
2. **Navigation "Absences"** → AbsencesListScreen
3. **Affichage liste** → Absences et retards par date
4. **Filtrage** → Optionnel : type (absence, retard)
5. **Consultation détail** → Date, heure, justification
6. **Retour** → AbsencesListScreen

**Données affichées** :
- Liste : Date, Type, Justification
- Statistiques : Nombre d'absences, retards

**Actions disponibles** :
- ✅ Filtrer par type
- ✅ Voir statistiques
- ❌ Justifier (interdit dans l'app)

**Durée estimée** : 1 minute

---

### 5. Consultation des Messages

**Objectif** : Lire les messages de l'école

**Étapes** :
1. **Accueil** → HomeScreen
2. **Badge "Messages"** → Indicateur messages non lus
3. **Navigation "Messages"** → MessagesListScreen
4. **Affichage liste** → Messages par date
5. **Sélection message** → MessageDetailScreen
6. **Lecture contenu** → Marqué automatiquement comme lu
7. **Retour** → MessagesListScreen

**Données affichées** :
- Liste : Titre, Expéditeur, Date, Type
- Détail : Contenu complet

**Actions disponibles** :
- ✅ Filtrer par type/statut
- ✅ Marquer comme lu
- ✅ Télécharger pièces jointes

**Durée estimée** : 1-2 minutes

---

## 🔔 Parcours Notifications

### Réception d'une Notification Push

**Objectif** : Être informé d'un événement important

**Étapes** :
1. **Réception notification** → Push notification
2. **Ouverture notification** → Redirection vers écran concerné
3. **Affichage contenu** → Détails de l'événement
4. **Action** → Consultation complète

**Types de notifications** :
- Nouvelle note → GradesListScreen
- Paiement en attente → PaymentsListScreen
- Message important → MessagesListScreen
- Absence enregistrée → AbsencesListScreen

**Durée estimée** : 10-30 secondes

---

## 📊 Matrice des Parcours

| Parcours | Parent | Élève | Durée |
|----------|--------|-------|-------|
| Connexion | ✅ | ✅ | 30-60s |
| Consultation notes | ✅ | ✅ | 1-3 min |
| Suivi paiements | ✅ | ❌ | 2-3 min |
| Messages | ✅ | ✅ | 1-2 min |
| Emploi du temps | ❌ | ✅ | 1 min |
| Absences | ✅ | ✅ | 1 min |
| Profil | ✅ | ✅ | 1-2 min |

---

## 🎯 Objectifs UX par Parcours

### Simplicité

- **Maximum 3 clics** pour accéder à une information
- **Navigation intuitive** : Retour, breadcrumbs
- **Feedback visuel** : Chargement, succès, erreur

### Rassurance

- **Messages clairs** : Pas de jargon technique
- **États vides** : Messages rassurants
- **Erreurs** : Messages compréhensibles avec solutions

### Performance

- **Chargement rapide** : < 2 secondes
- **Cache intelligent** : Données récentes en cache
- **Offline limité** : Consultation des dernières données

---

## 📝 Résumé

### Parcours Principaux

- ✅ **Connexion** : Simple et sécurisée
- ✅ **Consultation notes** : Rapide et claire
- ✅ **Suivi paiements** : Transparent et rassurant
- ✅ **Messages** : Accessible et lisible
- ✅ **Emploi du temps** : Pratique et visuel
- ✅ **Absences** : Informative et claire

### Principes UX

- **Simplicité** : Maximum 3 clics
- **Rassurance** : Messages clairs
- **Performance** : Chargement rapide
- **Accessibilité** : Respect des guidelines

---

**Version** : 1.0  
**Dernière mise à jour** : 2025

