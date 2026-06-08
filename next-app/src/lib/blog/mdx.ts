import path from 'path';
import fs from 'fs/promises';
import matter from 'gray-matter';
import { compileMDX } from 'next-mdx-remote/rsc';

export type BlogFrontmatter = {
  title: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  keywords?: string[];
  pillar?:
    | '/gestion-scolaire'
    | '/logiciel-gestion-ecole'
    | '/logiciel-ecole-afrique'
    | '/gestion-etablissement-scolaire';
};

export type BlogMdxPost = {
  slug: string;
  frontmatter: BlogFrontmatter;
  content: string;
};

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

async function safeReadDir(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

export async function getAllBlogSlugs(): Promise<string[]> {
  const files = await safeReadDir(BLOG_DIR);
  return files
    .filter((f) => f.toLowerCase().endsWith('.mdx'))
    .map((f) => f.replace(/\.mdx$/i, ''))
    .sort();
}

export async function getBlogPostBySlug(slug: string): Promise<BlogMdxPost | null> {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = matter(raw);
    const frontmatter = parsed.data as Partial<BlogFrontmatter>;
    if (!frontmatter?.title || !frontmatter?.description || !frontmatter?.publishedAt) {
      return null;
    }
    return {
      slug,
      frontmatter: frontmatter as BlogFrontmatter,
      content: parsed.content,
    };
  } catch {
    return null;
  }
}

export async function renderBlogMdx(source: string) {
  const compiled = await compileMDX({
    source,
    options: { parseFrontmatter: false },
  });
  return compiled.content;
}

