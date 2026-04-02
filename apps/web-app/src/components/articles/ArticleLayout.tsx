import type { Article } from '@/types/article';
import { ArticleHeader } from './ArticleHeader';
import { ShareButtons } from './ShareButtons';

interface ArticleLayoutProps {
  article: Article;
  children: React.ReactNode;
}

export function ArticleLayout({ article, children }: ArticleLayoutProps) {
  const articleUrl = `https://academiahelm.com/${article.slug}`;

  return (
    <article>
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

      <div className="max-w-4xl mx-auto px-4 prose prose-lg prose-blue">{children}</div>

      <div className="max-w-4xl mx-auto px-4">
        <ShareButtons url={articleUrl} title={article.title} />
      </div>
    </article>
  );
}

