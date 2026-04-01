import SignupCTA from './SignupCTA';

type Props = {
  ctaLabel?: string;
};

export default function StickyCTA({ ctaLabel }: Props) {
  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 md:hidden">
      <div className="rounded-2xl border border-blue-200/60 bg-white/95 p-2 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <p className="text-xs font-semibold text-gray-900">Prêt à tester ?</p>
          <span className="text-[11px] text-gray-600">Gratuit</span>
        </div>
        <div className="px-2 pb-2">
          <div className="w-full">
            <SignupCTA label={ctaLabel} />
          </div>
        </div>
      </div>
    </div>
  );
}

