// Apply migration 20260901120000_add_message_reactions to Neon
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS "chat_message_reactions" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "chat_message_reactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_message_reactions_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE,
  CONSTRAINT "chat_message_reactions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "chat_message_reactions_message_user_emoji_idx"
  ON "chat_message_reactions" ("messageId", "userId", "emoji");

CREATE INDEX IF NOT EXISTS "chat_message_reactions_messageId_idx"
  ON "chat_message_reactions" ("messageId");

ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "isImportant" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS "chat_messages_isImportant_idx"
  ON "chat_messages" ("isImportant") WHERE "isImportant" = TRUE;
`;

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    console.log('Connecting to Neon...');
    await client.connect();
    console.log('✅ Connected');

    console.log('Applying migration: chat_message_reactions + isImportant...');
    await client.query(MIGRATION_SQL);
    console.log('✅ Migration applied');

    // Verify reactions table
    const tableCheck = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'chat_message_reactions'
    `);
    console.log(`✅ Table 'chat_message_reactions' exists: ${tableCheck.rows.length > 0}`);

    // Verify isImportant column
    const colCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'chat_messages' AND column_name = 'isImportant'
    `);
    console.log(`✅ Column 'chat_messages.isImportant' exists: ${colCheck.rows.length > 0}`);

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}
main();
