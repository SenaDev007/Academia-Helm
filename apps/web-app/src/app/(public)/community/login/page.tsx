import { LoginForm } from '@/components/community/LoginForm';

export const metadata = {
  title: 'Connexion — Academia Community',
  description: 'Connectez-vous à l\u2019espace communautaire Academia Helm.',
};

export default function CommunityLoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b2f73] via-[#0D1F6E] to-[#1d4fa5] flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <a href="/" className="flex items-center justify-center gap-2.5 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#f5b335] flex items-center justify-center text-[#0b2f73] font-black text-xl">
            A
          </div>
          <span className="text-white font-bold text-lg">
            Academia <span className="text-[#f5b335]">Community</span>
          </span>
        </a>

        <div className="bg-white rounded-2xl shadow-2xl p-7">
          <h1 className="text-xl font-black text-slate-800 mb-1">Bon retour !</h1>
          <p className="text-[12.5px] text-slate-500 mb-6">
            Vos canaux vous attendent — conseils du jour, discussions et support.
          </p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
