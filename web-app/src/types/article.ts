export interface Article {
  id: string;
  slug: string;
  title: string;
  description: string;
  content?: string;
  coverImage: {
    url: string;
    alt: string;
    credit?: string;
  };
  author: {
    name: string;
    role: string;
    avatar?: string;
  };
  category: string;
  tags: string[];
  publishedAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  readingTime: number; // en minutes
  status: 'published' | 'draft' | 'archived';
  seo: {
    title: string;
    description: string;
    canonical: string;
    ogImage?: string;
  };
}

