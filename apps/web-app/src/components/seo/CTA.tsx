import Link from 'next/link';

type Props = {
  href?: string;
  title?: string;
  description?: string;
  ctaLabel?: string;
};

export default function CTA({
  href = '/signup',
  title = 'Tester gratuitement Academia Helm',
  description = 'Démarrez en quelques minutes. Démonstration, support et accompagnement inclus.',
  ctaLabel = 'Tester gratuitement Academia Helm',
}: Props) {
  return (
    <section className="mt-12 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <p className="mt-1 text-gray-700">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={href}
            className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {ctaLabel}
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Parler à un expert
          </Link>
        </div>
      </div>
    </section>
  );
}

