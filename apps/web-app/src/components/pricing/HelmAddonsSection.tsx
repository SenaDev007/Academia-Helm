const ADDONS = [
  {
    code: 'SMS_500',
    name: 'Pack SMS 500',
    price: '5 000 FCFA / mois',
    description:
      '500 SMS vers parents et personnel via opérateurs béninois.',
  },
  {
    code: 'SMS_2000',
    name: 'Pack SMS 2000',
    price: '15 000 FCFA / mois',
    description:
      '2000 SMS — pour grandes écoles ou communication intensive.',
  },
  {
    code: 'SUPPORT_PREMIUM',
    name: 'Support Prioritaire',
    price: '10 000 FCFA / mois',
    description:
      'SLA &lt; 2h, hotline dédiée, gestionnaire de compte attitré.',
  },
  {
    code: 'TRAINING_ONSITE',
    name: 'Formation On-Site',
    price: '50 000 FCFA / jour',
    description:
      'Formation supplémentaire sur site (hors formation initiale incluse).',
  },
  {
    code: 'BILINGUAL',
    name: 'Bilingue FR/EN',
    price: '5 000 FCFA / mois',
    description:
      'Interface et tous documents générés en FR et EN simultanément.',
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
          Ces add-ons représentent des coûts opérationnels réels refacturés. Ils ne
          sont pas des modules verrouillés et peuvent s&apos;ajouter à n&apos;importe
          quel plan.
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

