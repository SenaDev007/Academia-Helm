// Add-ons optionnels — alignés sur le contrat d'abonnement Academia Helm (Article 4).
//
// Contrat :
//   - Option bilingue FR/EN : 50 000 FCFA/an (en supplément du plan, quel que soit le plan)
//   - SMS : facturé au Client au prix coûtant (selon pays de destination)
//   - Email : facturé au Client au prix coûtant
//   - Voice (appel vocal) : facturé au Client au prix coûtant
//   - WhatsApp : GRATUIT et illimité, inclus dans tous les plans

const ADDONS = [
  {
    code: 'BILINGUAL',
    name: 'Option bilingue FR/EN',
    price: '50 000 FCFA / an',
    description:
      'Interface et tous documents générés en FR et EN simultanément. Séparation des matières, examens et bulletins par langue.',
  },
  {
    code: 'WHATSAPP',
    name: 'WhatsApp',
    price: 'Gratuit — illimité',
    description:
      'Inclus dans tous les plans sans surcoût. Notifications parents, diffusez annonces et échanges sans limite.',
  },
  {
    code: 'SMS',
    name: 'SMS',
    price: 'Au prix coûtant',
    description:
      'Facturé au prix coûtant selon le pays de destination et la consommation réelle (refacturation transparente).',
  },
  {
    code: 'EMAIL',
    name: 'Email',
    price: 'Au prix coûtant',
    description:
      'Facturé au prix coûtant selon la consommation réelle (refacturation transparente de l\'infrastructure email).',
  },
  {
    code: 'VOICE',
    name: 'Voice (appel vocal)',
    price: 'Au prix coûtant',
    description:
      'Facturé au prix coûtant selon le pays de destination et la consommation réelle (notifications vocales automatiques).',
  },
] as const;

export default function HelmAddonsSection() {
  return (
    <section className="mt-16 max-w-6xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-navy-900 mb-3">
          Add-ons optionnels
        </h2>
        <p className="text-sm md:text-base text-slate-600 max-w-3xl mx-auto">
          Add-ons alignés sur le contrat d&apos;abonnement (Article 4). WhatsApp est
          gratuit et illimité dans tous les plans. SMS, Email et Voice sont refacturés
          au prix coûtant selon la consommation réelle. L&apos;option bilingue FR/EN est
          disponible en supplément, quel que soit le plan.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-700">Add-on</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Code</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Prix</th>
              <th className="px-4 py-3 font-semibold text-slate-700">
                Description
              </th>
            </tr>
          </thead>
          <tbody>
            {ADDONS.map((addon, index) => (
              <tr
                key={addon.code}
                className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}
              >
                <td className="px-4 py-3 font-medium text-navy-900">
                  {addon.name}
                </td>
                <td className="px-4 py-3 text-xs font-mono text-slate-600">
                  {addon.code}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-navy-900">
                  {addon.price}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {addon.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
