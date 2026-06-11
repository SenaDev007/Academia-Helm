import { Loader2 } from 'lucide-react';

export default function PublicLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-6 h-6 text-blue-600 animate-spin mr-3" />
      <span className="text-gray-500">Chargement…</span>
    </div>
  );
}
