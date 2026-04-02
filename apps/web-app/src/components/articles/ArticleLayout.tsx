'use client';

import type { Article } from '@/types/article';
import { ArticleHeader } from './ArticleHeader';
import { ShareButtons } from './ShareButtons';
import { motion } from 'framer-motion';
import { ArticleDivider } from './blocks/ArticleBlocks';

interface ArticleLayoutProps {
  article: Article;
  children: React.ReactNode;
}

export function ArticleLayout({ article, children }: ArticleLayoutProps) {
  const articleUrl = `https://academiahelm.com/${article.slug}`;

  return (
    <article className="bg-white">
      <ArticleHeader
        title={article.title}
        description={article.description}
        author={article.author}
        publishedAt={article.publishedAt}
        updatedAt={article.updatedAt}
        readingTime={article.readingTime}
        category={article.category}
        coverImage={article.coverImage}
      />

      <div className="mx-auto max-w-5xl px-4 pb-12 pt-10 md:pb-16">
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
          }}
          className="space-y-10"
        >
          {children}
        </motion.div>

        <ArticleDivider />
        <div className="mx-auto max-w-5xl">
          <ShareButtons url={articleUrl} title={article.title} />
        </div>
      </div>
    </article>
  );
}

