import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin mr-2" />
      Chargement de SaisieMaster…
    </div>
  );
}
