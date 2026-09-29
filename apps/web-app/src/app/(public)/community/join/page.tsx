import { Suspense } from 'react';
import { JoinForm } from '@/components/community/JoinForm';

export const metadata = {
  title: 'Rejoindre Academia Community — Academia Helm',
  description:
    'Rejoignez la communauté des dirigeants d\u2019établissements scolaires : conseils quotidiens, formations, support et entraide — directement dans Academia Helm.',
};

export default function CommunityJoinPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b2f73] via-[#0D1F6E] to-[#1d4fa5] py-12 px-4">
      <div className="max-w-md mx-auto">
        {/* Logo */}
        <a href="/" className="flex items-center justify-center gap-2.5 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#f5b335] flex items-center justify-center text-[#0b2f73] font-black text-xl">
            A
          </div>
          <span className="text-white font-bold text-lg">
            Academia <span className="text-[#f5b335]">Community</span>
          </span>
        </a>

        <div className="bg-white rounded-2xl shadow-2xl p-7">
          <h1 className="text-xl font-black text-slate-800 mb-1">Créer votre compte membre</h1>
          <p className="text-[12.5px] text-slate-500 mb-6">
            Bienvenue dans le réseau des écoles qui pilotent leur croissance. Gratuit, sans engagement.
          </p>
          <Suspense fallback={<div className="py-10 text-center text-slate-400 text-sm">Chargement…</div>}>
            <JoinForm />
          </Suspense>
        </div>

        <p className="text-center text-[11px] text-blue-200 mt-6">
          En créant votre compte, vous acceptez d&apos;échanger dans le respect de la charte de la communauté.
        </p>
      </div>
    </div>
  );
}
