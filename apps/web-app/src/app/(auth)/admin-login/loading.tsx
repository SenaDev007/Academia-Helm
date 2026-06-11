import { Loader2 } from 'lucide-react';

export default function AuthLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <Loader2 className="w-6 h-6 text-[#1A2BA6] animate-spin" />
    </div>
  );
}
