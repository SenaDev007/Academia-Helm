import { Loader2 } from 'lucide-react';

export default function PublicPageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-[#1A2BA6] animate-spin mx-auto mb-3" />
        <span className="text-sm text-gray-500">Chargement…</span>
      </div>
    </div>
  );
}
