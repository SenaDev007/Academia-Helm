/* eslint-disable no-console */
import path from 'path';
import fs from 'fs/promises';
import { generateSEOArticle } from '../src/lib/ai/content-generator';

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function fileExists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const keyword = process.argv.slice(2).join(' ').trim();
  if (!keyword) {
    console.error('Usage: npx tsx scripts/generate-articles.ts "<keyword>"');
    process.exit(1);
  }

  const outDir = path.join(process.cwd(), 'content', 'blog');
  await ensureDir(outDir);

  const article = await generateSEOArticle(keyword);
  const outFile = path.join(outDir, `${article.slug}.mdx`);
  if (await fileExists(outFile)) {
    console.error(`Article existe déjà: ${outFile}`);
    process.exit(2);
  }

  await fs.writeFile(outFile, article.mdx, 'utf8');
  console.log(`✅ Article généré: content/blog/${article.slug}.mdx`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
