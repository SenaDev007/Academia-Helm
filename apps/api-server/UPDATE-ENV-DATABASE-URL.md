# 🔧 Mise à Jour de DATABASE_URL dans .env

## ✅ Problème Résolu

La base de données est maintenant accessible et les tenants ont été créés avec succès !

## 📋 Action Requise

**IMPORTANT** : Mettez à jour manuellement votre fichier `.env` avec le DATABASE_URL encodé.

### Fichier : `apps/api-server/.env`

Remplacez la ligne `DATABASE_URL` par :

```env
DATABASE_URL=postgresql://postgres:C%40ptain.Yehioracadhub2021@localhost:5432/academia_hub
```

### Note sur l'Encodage

Le caractère `@` dans le mot de passe doit être encodé en `%40` dans l'URL :
- Mot de passe original : `C@ptain.Yehioracadhub2021`
- Mot de passe encodé : `C%40ptain.Yehioracadhub2021`

## ✅ Vérification

Après la mise à jour, testez :

```bash
cd apps/api-server
npx prisma db pull
```

Vous devriez voir :
```
✅ Introspected 278 models successfully
```

## 🎉 Résultat

- ✅ Base de données accessible
- ✅ Migrations appliquées
- ✅ 2 tenants créés :
  - CSPEB-Eveil d'Afrique Education
  - La Persévérance
- ✅ 19 utilisateurs créés (1 PLATFORM_OWNER + 9 × 2)

## 🚀 Test de l'Endpoint

Une fois le serveur API redémarré, testez :

```bash
curl http://localhost:3000/api/public/schools/list
```

Devrait retourner la liste des 2 écoles.
