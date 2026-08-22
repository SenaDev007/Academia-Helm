-- ⭐ Add content column to educast_engagement for comments
--    When type='COMMENT', the content field holds the comment text.
--    When type='VIEW' or 'LIKE', content is NULL.

ALTER TABLE "educast_engagement" ADD COLUMN IF NOT EXISTS "content" TEXT;
