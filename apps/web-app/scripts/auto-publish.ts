/* eslint-disable no-console */
import path from 'path';
import fs from 'fs/promises';
import { pickNextKeywords } from '../src/lib/seo/keyword-strategy';
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
  const perDay = Number(process.env.SEO_ARTICLES_PER_DAY || 3);
  const limit = Number.isFinite(perDay) && perDay > 0 ? Math.min(perDay, 10) : 3;

  const outDir = path.join(process.cwd(), 'content', 'blog');
  await ensureDir(outDir);

  const keywords = pickNextKeywords(limit);
  if (!keywords.length) {
    console.log('Aucun mot-clé à traiter.');
    return;
  }

  let generated = 0;
  for (const item of keywords) {
    const article = await generateSEOArticle(item.keyword);
    const outFile = path.join(outDir, `${article.slug}.mdx`);
    if (await fileExists(outFile)) {
      console.log(`⏭️  Déjà présent: ${article.slug}`);
      continue;
    }
    await fs.writeFile(outFile, article.mdx, 'utf8');
    console.log(`✅ Publié: content/blog/${article.slug}.mdx`);
    generated += 1;
  }

  console.log(`Terminé. Articles créés: ${generated}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
