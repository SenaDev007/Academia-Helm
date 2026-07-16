'use client';

import { CreditCard, Settings } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

/**
 * TransportPayments — Module de paiement Transport
 *
 * ⭐ Task 7-e : Les mocks hardcoded (2 paiements fictifs + KPIs "1 250 000 F CFA" /
 * "175 000 F CFA" / "87.5%") ont été supprimés. Le backend ne expose pas de
 * GET /transport/payments — l'interface affiche donc un placeholder propre
 * "Module de paiement à configurer" en attendant l'endpoint.
 *
 * Si l'API expose un jour `transport/payments`, remplacer le placeholder par un
 * `useModulesList('transport', 'payments', academicYear?.id)` standard.
 */
export default function TransportPayments() {
  const { toast } = useToast();

  const handleNotify = () => {
    toast({
      title: 'Module à configurer',
      description: 'L\'endpoint GET /transport/payments n\'est pas encore exposé par le backend. Contactez l\'administrateur pour activer la collecte des paiements transport.',
    });
  };

  return (
    <div className="space-y-6">
      <Card className="p-12 shadow-sm flex flex-col items-center text-center">
        <div className="p-4 rounded-xl bg-indigo-50 text-indigo-700 mb-6">
          <CreditCard className="w-10 h-10" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Module de paiement à configurer</h3>
        <p className="text-sm text-gray-500 max-w-md mb-6">
          Le suivi des paiements de transport scolaire n'est pas encore activé.
          L'endpoint <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">GET /transport/payments</code>
          {' '}doit être implémenté côté backend pour permettre la collecte et le suivi des recettes.
        </p>
        <Button variant="outline" onClick={handleNotify}>
          <Settings className="w-4 h-4" /> Notifier l'administrateur
        </Button>
      </Card>
    </div>
  );
}
