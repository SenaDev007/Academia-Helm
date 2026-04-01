import Link from 'next/link';

type Props = {
  href?: string;
  label?: string;
  variant?: 'primary' | 'secondary';
};

export default function SignupCTA({
  href = '/signup',
  label = 'Tester gratuitement Academia Helm',
  variant = 'primary',
}: Props) {
  const cls =
    variant === 'primary'
      ? 'rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800'
      : 'rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50';

  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${cls}`}
    >
      {label}
    </Link>
  );
}

