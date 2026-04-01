import Anthropic from '@anthropic-ai/sdk';

export type GeneratedSEOArticle = {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  publishedAt: string;
  mdx: string;
};

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function buildSEOArticlePrompt(keyword: string) {
  return `Rédige un article SEO expert sur "${keyword}" ciblant l’Afrique.
Structure :
- Introduction orientée problème
- Sections pédagogiques
- Ton professionnel
- Optimisation SEO
- Ajouter FAQ
- Ajouter appel à l’action vers Academia Helm

Contraintes de sortie :
- 1500 à 2500 mots
- 1 seul H1 (contenant le mot-clé principal)
- H2/H3 hiérarchisés
- Inclure des mots-clés secondaires naturellement (sans bourrage)
- Inclure une section FAQ avec 5 questions/réponses
- Conclure avec un CTA clair : "Tester gratuitement Academia Helm" (lien /signup)

Sortie attendue en MDX avec frontmatter YAML au début :
---
title: ...
description: ...
publishedAt: YYYY-MM-DD
keywords: [ ... ]
pillar: "/gestion-scolaire" | "/logiciel-gestion-ecole" | "/logiciel-ecole-afrique" | "/gestion-etablissement-scolaire"
---

Puis le contenu MDX.`;
}

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY manquant (nécessaire pour générer des articles).');
  }
  return new Anthropic({ apiKey });
}

export async function generateSEOArticle(keyword: string): Promise<GeneratedSEOArticle> {
  const client = getAnthropicClient();
  const prompt = buildSEOArticlePrompt(keyword);

  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    temperature: 0.6,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = res.content
    .map((b) => ('text' in b ? b.text : ''))
    .join('\n')
    .trim();

  // Extract minimal metadata from frontmatter (best-effort)
  const titleMatch = text.match(/^---[\s\S]*?\btitle:\s*(.+)\s*$/m);
  const descMatch = text.match(/^---[\s\S]*?\bdescription:\s*(.+)\s*$/m);
  const dateMatch = text.match(/^---[\s\S]*?\bpublishedAt:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})\s*$/m);
  const keywordsMatch = text.match(/^---[\s\S]*?\bkeywords:\s*\[(.+?)\]\s*$/m);

  const title = (titleMatch?.[1] || keyword).replace(/^["']|["']$/g, '').trim();
  const description = (descMatch?.[1] || `Guide complet sur ${keyword} avec Academia Helm.`)
    .replace(/^["']|["']$/g, '')
    .trim();
  const publishedAt = (dateMatch?.[1] || new Date().toISOString().slice(0, 10)).trim();
  const keywords =
    keywordsMatch?.[1]
      ?.split(',')
      .map((k) => k.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean) || [keyword];

  const slug = slugify(keyword);

  return { slug, title, description, keywords, publishedAt, mdx: text };
}

export async function generateSEOArticleFromPrompt(
  prompt: string,
  opts?: { slugHint?: string; defaultKeyword?: string },
): Promise<GeneratedSEOArticle> {
  const client = getAnthropicClient();

  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    temperature: 0.6,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = res.content
    .map((b) => ('text' in b ? b.text : ''))
    .join('\n')
    .trim();

  const titleMatch = text.match(/^---[\s\S]*?\btitle:\s*(.+)\s*$/m);
  const descMatch = text.match(/^---[\s\S]*?\bdescription:\s*(.+)\s*$/m);
  const dateMatch = text.match(/^---[\s\S]*?\bpublishedAt:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})\s*$/m);
  const keywordsMatch = text.match(/^---[\s\S]*?\bkeywords:\s*\[(.+?)\]\s*$/m);

  const title = (titleMatch?.[1] || opts?.defaultKeyword || opts?.slugHint || 'article')
    .replace(/^["']|["']$/g, '')
    .trim();
  const description = (descMatch?.[1] || 'Article SEO Academia Helm.')
    .replace(/^["']|["']$/g, '')
    .trim();
  const publishedAt = (dateMatch?.[1] || new Date().toISOString().slice(0, 10)).trim();
  const keywords =
    keywordsMatch?.[1]
      ?.split(',')
      .map((k) => k.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean) || (opts?.defaultKeyword ? [opts.defaultKeyword] : []);

  const slug = slugify(opts?.slugHint || title);

  return { slug, title, description, keywords, publishedAt, mdx: text };
}

