/**
 * BillingHistoryPage
 *
 * Page d'historique de facturation :
 * - Liste des factures
 * - Lien vers les reçus PDF
 *
 * La génération PDF, la numérotation et l'archivage légal
 * sont gérés côté backend. Ici on expose une lecture claire et institutionnelle.
 */

'use client';

import { useEffect, useState } from 'react';
import type { Invoice, Receipt } from '@/types';
import { getBillingHistory } from '@/services/billing.service';
import { FileText, Loader, AlertCircle, Download } from 'lucide-react';

interface BillingState {
  invoices: Invoice[];
  receipts: Receipt[];
  loading: boolean;
  error?: string;
}

export default function BillingHistoryPage() {
  const [state, setState] = useState<BillingState>({
    invoices: [],
    receipts: [],
    loading: true,
  });

  useEffect(() => {
    async function load() {
      try {
        const data = await getBillingHistory();
        setState({
          invoices: data.invoices || [],
          receipts: data.receipts || [],
          loading: false,
        });
      } catch (error: any) {
        setState({
          invoices: [],
          receipts: [],
          loading: false,
          error: error.message || 'Erreur lors du chargement de la facturation',
        });
      }
    }
    load();
  }, []);

  const { invoices, receipts, loading, error } = state;

  const receiptByInvoiceId = new Map<string, Receipt>(
    receipts.map((r) => [r.invoiceId, r]),
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 mb-1">Facturation</h1>
          <p className="text-sm text-slate-600">
            Historique des factures et reçus de votre abonnement Academia Helm.
          </p>
        </div>
        <div className="hidden md:flex items-center text-slate-500 text-xs">
          <FileText className="w-5 h-5 mr-2" />
          <span>
            Les numéros de factures et de reçus sont uniques et archivés par le
            système. Aucune modification a posteriori.
          </span>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 flex items-center justify-center">
          <Loader className="w-6 h-6 text-navy-900 animate-spin mr-3" />
          <span className="text-slate-600 text-sm">
            Chargement de l&apos;historique de facturation...
          </span>
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
          <div>
            <p className="text-sm text-red-800">{error}</p>
            <p className="text-xs text-red-700 mt-1">
              Si le problème persiste, contactez le support Academia Helm.
            </p>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-navy-900">
              Historique des factures
            </h2>
            <p className="text-xs text-slate-500">
              Chaque facture est liée à un paiement et à un reçu PDF
              téléchargeable.
            </p>
          </div>

          {invoices.length === 0 ? (
            <div className="p-6 text-sm text-slate-600">
              Aucune facture disponible pour le moment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-slate-700">
                      Facture
                    </th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-700">
                      Date d&apos;émission
                    </th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-700">
                      Montant
                    </th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-700">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-700">
                      Reçu
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => {
                    const receipt = receiptByInvoiceId.get(invoice.id);
                    const issuedDate = new Date(
                      invoice.issuedAt || invoice.createdAt,
                    ).toLocaleDateString();

                    const isPaid = invoice.status === 'PAID';

                    return (
                      <tr
                        key={invoice.id}
                        className="border-b border-gray-100 last:border-0"
                      >
                        <td className="px-6 py-3 align-top">
                          <div className="font-semibold text-navy-900">
                            {invoice.number}
                          </div>
                          <div className="text-xs text-slate-500">
                            {invoice.description}
                          </div>
                        </td>
                        <td className="px-6 py-3 align-top text-slate-700">
                          {issuedDate}
                        </td>
                        <td className="px-6 py-3 align-top text-slate-700">
                          {invoice.amount.toLocaleString()} {invoice.currency}
                        </td>
                        <td className="px-6 py-3 align-top">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                              isPaid
                                ? 'bg-green-50 text-green-700 border border-green-200'
                                : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                            }`}
                          >
                            {isPaid ? 'Payée' : 'Émise'}
                          </span>
                        </td>
                        <td className="px-6 py-3 align-top">
                          {receipt && receipt.pdfUrl ? (
                            <a
                              href={receipt.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-sm text-navy-900 hover:text-navy-700 font-semibold"
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Télécharger le reçu
                            </a>
                          ) : isPaid ? (
                            <span className="text-xs text-slate-500">
                              Reçu en cours de génération...
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Reçu disponible après paiement
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


