import type { BlogFAQ } from '@/content/blog/posts';

/**
 * Extraction best-effort de la FAQ depuis un MDX généré :
 * attend une section "## FAQ" puis des "### Question" suivies d'un paragraphe réponse.
 */
export function extractFaqFromMdx(mdx: string): BlogFAQ[] {
  const lines = mdx.split(/\r?\n/);
  const faq: BlogFAQ[] = [];

  let inFaq = false;
  let currentQ: string | null = null;
  let answerLines: string[] = [];

  const flush = () => {
    if (!currentQ) return;
    const answer = answerLines.join('\n').trim();
    if (answer) faq.push({ question: currentQ.trim(), answer });
    currentQ = null;
    answerLines = [];
  };

  for (const line of lines) {
    if (line.trim().toLowerCase() === '## faq') {
      inFaq = true;
      continue;
    }
    if (!inFaq) continue;

    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      flush();
      currentQ = h3[1];
      continue;
    }

    if (line.startsWith('## ') && line.trim().toLowerCase() !== '## faq') {
      // nouvelle section => fin FAQ
      flush();
      break;
    }

    if (currentQ) {
      answerLines.push(line);
    }
  }
  flush();

  return faq.slice(0, 8);
}
