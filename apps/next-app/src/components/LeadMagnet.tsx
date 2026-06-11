import SignupCTA from './SignupCTA';

type Props = {
  sourceSlug: string;
  keywords: string[];
  ctaLabel?: string;
};

export default function LeadMagnet({ sourceSlug, keywords, ctaLabel }: Props) {
  return (
    <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Recevoir la checklist (PDF) “Gestion scolaire Afrique”</h2>
      <p className="mt-2 text-gray-700">
        On vous envoie une checklist pratique (finance, scolarité, examens, RH) + un plan de déploiement en 14 jours.
      </p>

      <form className="mt-4 flex flex-col gap-3 sm:flex-row" action="/api/leads" method="post">
        <input type="hidden" name="source" value={`blog:${sourceSlug}`} />
        <input type="hidden" name="keywords" value={keywords.join(',')} />
        <label className="sr-only" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="Votre email professionnel"
          className="h-11 flex-1 rounded-xl border border-gray-300 px-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
        <button
          type="submit"
          className="h-11 rounded-xl bg-gray-900 px-5 text-sm font-semibold text-white hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Envoyer la checklist
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SignupCTA label={ctaLabel} />
        <SignupCTA href="/contact" label="Parler à un expert" variant="secondary" />
      </div>

      <p className="mt-3 text-xs text-gray-500">
        En envoyant ce formulaire, vous acceptez de recevoir des emails liés à Academia Helm. Désinscription possible.
      </p>
    </section>
  );
}

