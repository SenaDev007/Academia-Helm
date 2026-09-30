# Academia Helm : moteur de distinctions

Génère les certificats, tableaux d'honneur et diplômes de fin de cycle en PDF A4 paysage,
pour le maternel, le primaire et le secondaire. Un seul moteur, trois identités visuelles.

Stack : TypeScript, React (rendu HTML), Lucide (icônes), Chromium via puppeteer-core, pdf-lib, qrcode.

## Installation

    npm install
    npm run demo        # génère tous les modèles dans ./out

Local : Chromium embarqué par @sparticuz/chromium, rien à installer.
Pour utiliser ton propre Chrome : `CHROMIUM_PATH=/usr/bin/google-chrome npm run demo`.

## Ce que le moteur produit

| Niveau | Distinctions | Univers visuel |
|---|---|---|
| Maternel | Étoile d'Or, Étoile d'Argent, Étoile de Bronze, Petit Explorateur, Diplôme de fin de maternelle | Police Fredoka, cadre arrondi, bulles et icônes d'éveil, une couleur vive par mention |
| Primaire | Félicitations, Encouragements, Honneur, Courage, Fin de cycle | Police Nunito, médaille et ruban, bandeau, bleus profonds et couleurs franches |
| Secondaire | Félicitations, Encouragements, Honneur, Prix du Progrès, Assiduité, Comportement, Fin de cycle | Polices Playfair et Lora, triple filet, guilloché vectoriel, sceau, tons académiques |

Chaque niveau a aussi un tableau collectif de classe (9 élèves par page, pagination automatique).

## Utilisation

Un certificat :

    import { generateDistinctionPdf } from '@yehi-or/helm-distinctions';
    const pdf = await generateDistinctionPdf({ code: 'PRI_FELIC', school, student, period, results, verification });

Une classe entière (règles, certificats, PDF d'impression, tableau collectif) :

    import { buildClassPack } from '@yehi-or/helm-distinctions';
    const pack = await buildClassPack({ level: 'primaire', school, className, periodId, period, base: 20, students, secret, verifyBaseUrl });
    // pack.files, pack.mergedPdf, pack.boardPdf, pack.records (à enregistrer en base), pack.skipped

Exemple complet d'API Next.js : `examples/next-route.ts`. Schéma PostgreSQL : `sql/schema.sql`.

## Règles de distinction

Les seuils sont en pourcentage de la base de notation, donc valables sur 10, 20 ou 100.
Valeurs par défaut dans `src/rules.ts`, remplaçables par école via le paramètre `rules`.

- Maternel : 90 / 75 / 60 / 0 (aucun enfant exclu)
- Primaire : 80 / 70 / 60 / 50 (sous 50 %, pas de document public)
- Secondaire : 80 / 70 / 60 (sous 60 %, pas de mention)
- Prix du Progrès : gain d'au moins 10 points de pourcentage entre deux périodes
- Assiduité : zéro absence non justifiée et zéro retard
- Comportement : conduite à 90 % ou plus

## Personnaliser

- Couleurs, icônes, libellés et messages : `src/themes.ts` (une entrée par distinction)
- Mise en page : `src/css.ts` et `src/templates/`
- Icônes : ajoute le nom dans `IconName` (types.ts) et dans `src/icons.tsx`

## Vérification anti-fraude

Chaque certificat porte un QR code et un code `AH-2025-XXXX-XXXX-XXXX` calculé par HMAC-SHA256
à partir de l'école, l'élève, la période, le type et l'année. Stocke-le dans `distinctions.verification_code`
et expose une page publique `/verifier/[code]`. `checkVerificationCode` contrôle un code sans accès base.

## Déploiement (Vercel)

- Route en `runtime = 'nodejs'`, `maxDuration = 60`, mémoire de 1024 Mo ou plus.
- Ajoute `@sparticuz/chromium` et `puppeteer-core` dans `serverExternalPackages` (next.config).
- Les polices sont embarquées en base64 et les images converties en data URI : aucun appel réseau pendant le rendu.
- Pour les grosses écoles, lance la génération dans une tâche de fond (file d'attente) et stocke les fichiers.

## Performance

Toute une classe passe dans un seul rendu Chromium puis le PDF est découpé par élève.
Le navigateur reste ouvert entre deux appels (`closeBrowser()` à l'arrêt du process).
