/**
 * Aligner le mot de passe du compte Saliou (dawesakpovi@gmail.com /
 * matricule CSPEBE-26-00008) sur tn2t1orm1Fo — les identifiants que
 * l'utilisateur attend pour les DEUX portails.
 */
import pg from 'pg';
import bcrypt from 'bcryptjs';
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const USER_ID = '85256ffe-c532-4aed-813b-06ebaf8937f6';
const NEW_PWD = 'tn2t1orm1Fo';

const hash = await bcrypt.hash(NEW_PWD, 10);
await client.query(`UPDATE users SET "passwordHash" = $1, "updatedAt" = NOW() WHERE id = $2`, [hash, USER_ID]);

// Vérification
const check = await client.query(`SELECT "passwordHash" FROM users WHERE id = $1`, [USER_ID]);
const ok = await bcrypt.compare(NEW_PWD, check.rows[0].passwordHash);
console.log('Mot de passe mis à jour pour', USER_ID, '→', ok ? '✅ tn2t1orm1Fo valide' : '❌ ERREUR');
await client.end();
