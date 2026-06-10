import { Loader2 } from 'lucide-react';

export default function ModuleLoading() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-5 h-5 text-blue-600 animate-spin mr-2" />
      <span className="text-sm text-gray-500">Chargement…</span>
    </div>
  );
}
