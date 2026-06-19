import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
        <p className="text-slate-600 font-medium">Vérification du lien de signature...</p>
      </div>
    </div>
  );
}
