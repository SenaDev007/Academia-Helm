/**
 * T57 — Créer un membre QA COORDONNATEUR dans le patronat NATIONAL réel
 * (PESP Bénin — tenant 97c57b3c) pour tester le vrai périmètre national
 * (4 enfants, données réelles) sans toucher au compte du promoteur.
 */
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const NAT_TENANT = '97c57b3c-8d92-4d3f-b1c8-76c2f9c1c9ac';
const NAT_PATRONAT = '62df0f31-94bc-4260-886d-d7ee255d964f';
const EMAIL = `qa.t57.natcoord.${Date.now().toString(36)}@academiahelm.test`;
const PASSWORD = 'T57Qa#2026NatCoord';
const hash = await bcrypt.hash(PASSWORD, 10);

const userId = randomUUID();
const linkId = randomUUID();

await client.query(
  `INSERT INTO users (id, "tenantId", email, "passwordHash", "firstName", "lastName", role, status, "createdAt", "updatedAt")
   VALUES ($1, $2, $3, $4, 'QA', 'T57 NationalCoord', 'PATRONAT_COORDONNATEUR', 'active', NOW(), NOW())`,
  [userId, NAT_TENANT, EMAIL, hash],
);
await client.query(
  `INSERT INTO patronat_users (id, "patronatId", "tenantId", "userId", role, "isActive", "createdAt", "updatedAt")
   VALUES ($1, $2, $3, $4, 'COORDONNATEUR', true, NOW(), NOW())`,
  [linkId, NAT_PATRONAT, NAT_TENANT, userId],
);

console.log(`✅ Membre QA national créé : ${EMAIL}`);
console.log(`   user=${userId} link=${linkId}`);
console.log(`   PASSWORD=${PASSWORD}`);
await client.end();
