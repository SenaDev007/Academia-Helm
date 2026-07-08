/**
 * ============================================================================
 * FEDAPAY LOGO — Composant réutilisable
 * ============================================================================
 *
 * Affiche le logo officiel de Fedapay (fichier /public/images/logoFedaPay.webp).
 *
 * Utilisé partout où Fedapay apparaît :
 *   - Paramètres > Finance > Paiements en ligne (PaymentConfigSection)
 *   - Encaissements > Nouveau paiement (NewPaymentModal)
 *   - Encaissements > Liste transactions (TransactionsContent — badge méthode)
 *   - Multi-caisses (CashRegistersContent)
 *   - Comptes élèves (StudentAccountsContent)
 *
 * Props :
 *   - className : classes Tailwind pour dimensionner (ex: "h-6 w-auto")
 *   - variant : "color" (défaut, logo complet) | "mono" (blanc sur fond sombre)
 * ============================================================================
 */
'use client';

import Image from 'next/image';
import { Badge } from '@/components/ui/badge';

interface FedapayLogoProps {
  className?: string;
  /** Hauteur en pixels (raccourci pour className). */
  height?: number;
  /** Variante : color pour fond clair, mono pour fond sombre. */
  variant?: 'color' | 'mono';
  /** Title attribute (accessibilité). */
  title?: string;
}

export function FedapayLogo({
  className,
  height,
  variant = 'color',
  title = 'Fedapay',
}: FedapayLogoProps) {
  const computedClassName = className || (height ? '' : 'h-6 w-auto');
  const style = height ? { height: `${height}px`, width: 'auto' } : undefined;

  // Pour la variante "mono" sur fond sombre, on applique un filtre CSS pour
  // blanchir le logo. Le fichier source reste le même.
  const filter = variant === 'mono' ? 'brightness(0) invert(1)' : undefined;

  return (
    <Image
      src="/images/logoFedaPay.webp"
      alt={title}
      title={title}
      className={computedClassName}
      style={{ ...style, filter }}
      width={120}
      height={32}
      priority={false}
    />
  );
}

/**
 * Labels des méthodes de paiement (hors Fedapay qui a son propre logo).
 */
const METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  WIRE: 'Virement',
  FEEXPAY: 'FeexPay',
  BANK: 'Banque',
  CHECK: 'Chèque',
};

/**
 * Badge affichant la méthode de paiement :
 *   - Pour Fedapay : le logo officiel + le texte "Fedapay" côte à côte
 *     (comme dans le modal Nouveau paiement), dans un badge standard
 *   - Pour les autres méthodes : un badge textuel standard
 *
 * Utilisable partout où une méthode de paiement doit être affichée
 * (TransactionsContent, NewPaymentModal, CashRegistersContent, etc.).
 */
export function PaymentMethodBadge({
  method,
  methodLabel,
}: {
  method?: string;
  /** Libellé personnalisé (si fourni, utilisé pour les méthodes non-Fedapay). */
  methodLabel?: string;
}) {
  if (method === 'FEDAPAY') {
    return (
      <Badge variant="outline" className="gap-1.5">
        <Image
          src="/images/logoFedaPay.webp"
          alt="Fedapay"
          title="Fedapay"
          width={48}
          height={14}
          className="h-3.5 w-auto object-contain"
        />
        <span>Fedapay</span>
      </Badge>
    );
  }
  const label = methodLabel || METHOD_LABELS[method || ''] || method || '—';
  return <Badge variant="outline">{label}</Badge>;
}

export default FedapayLogo;
