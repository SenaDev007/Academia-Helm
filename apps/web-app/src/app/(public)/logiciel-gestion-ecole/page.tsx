import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/seo/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Logiciel de gestion d’école : guide & critères | Academia Helm',
  description:
    "Logiciel de gestion d’école en Afrique de l’Ouest : finance, recouvrement Mobile Money, bulletins, RH et pilotage. Critères et déploiement en 48h.",
  alternates: {
    canonical: 'https://academiahelm.com/logiciel-gestion-ecole',
  },
};

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Logiciel de gestion d’école' }]} />

      <header className="mb-10">
        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          Logiciel de gestion d’école
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Logiciel de gestion d’école : choisir une solution utile dès la première semaine
        </h1>
        <p className="mt-4 text-lg text-gray-700">
          Si vous dirigez une école privée au Bénin, en Côte d’Ivoire, au Sénégal, au Togo ou au Burkina Faso, vous avez
          probablement déjà vécu le même scénario : cahiers, Excel, retards de bulletins, recouvrement incertain et
          parents qui demandent des preuves.
        </p>
        <p className="mt-3 text-lg text-gray-700">
          Ce guide vous donne une méthode simple : critères de choix, fonctionnalités indispensables, erreurs à éviter
          et déploiement progressif. Objectif : des gains visibles, avec une mise en place en moins de 48h.
        </p>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600">10 min de lecture</p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Tester gratuitement Academia Helm
          </Link>
        </div>
      </header>

      <section className="border-t border-gray-100 my-10" />

      <section>
        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          Introduction
        </span>
        <h2 className="text-2xl font-bold text-gray-900">1) Ce que vous achetez vraiment : un pilotage</h2>
        <p className="mt-4 text-gray-700">
          Un logiciel de gestion d’école n’a de valeur que s’il sécurise votre recette, accélère les opérations et
          fiabilise les documents. Il doit transformer des activités “au feeling” en process clairs et mesurables.
        </p>
        <p className="mt-3 text-gray-700">
          Dans la pratique, les gains viennent vite : reçu immédiat, relances structurées, bulletins générés en quelques
          clics, et visibilité direction. C’est ce qui permet de viser <span className="font-semibold">+12% de taux de recouvrement</span> et
          <span className="font-semibold"> -8% d’absentéisme</span>.
        </p>
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg my-6">
          <p className="text-gray-800">
            Plan : fonctionnalités essentielles → critères de choix → tarification/ROI → déploiement en 48h → FAQ.
          </p>
        </div>
      </section>

      <section>
        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          Fonctionnalité clé
        </span>
        <h2 className="text-2xl font-bold text-gray-900">2) Scolarité : dossiers élèves et référentiel fiable</h2>
        <p className="mt-4 text-gray-700">
          Sans référentiel élève propre, tout le reste se casse : facturation, examens, attestations. Vous avez besoin
          d’une vue 360° : identité, tuteurs, classe, documents, historique, statut de paiement, présence et résultats.
        </p>
        <p className="mt-3 text-gray-700">
          Exemple terrain : au Togo ou au Bénin, un dossier incomplet crée des “exceptions” à chaque étape, et l’équipe
          perd du temps sur des recherches plutôt que sur l’accueil.
        </p>
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg my-6">
          <p className="font-semibold text-gray-900 mb-2">Encadré check-list</p>
          <ul className="list-disc pl-6 text-gray-800 space-y-1">
            <li>Inscription/réinscription standardisée</li>
            <li>Documents et historique centralisés</li>
            <li>Listes de classe fiables en 1 clic</li>
          </ul>
        </div>
      </section>

      <section>
        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          Fonctionnalité clé
        </span>
        <h2 className="text-2xl font-bold text-gray-900">3) Finance : recouvrement, Mobile Money et preuves</h2>
        <p className="mt-4 text-gray-700">
          La finance “finance” la digitalisation. Si le recouvrement progresse, l’outil se rentabilise. Votre logiciel
          doit gérer : frais, échéances, encaissements multi-modes, reçus, annulations contrôlées et états de caisse.
        </p>
        <p className="mt-3 text-gray-700">
          En Côte d’Ivoire ou au Sénégal, Mobile Money accélère les paiements — mais sans traçabilité (paiement ↔ reçu ↔
          solde), vous créez des contestations et du travail manuel.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
          <div className="rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-600">Impact typique</p>
            <p className="text-4xl font-bold text-blue-700">+12%</p>
            <p className="mt-2 text-gray-700">de taux de recouvrement avec suivi hebdomadaire.</p>
          </div>
          <div className="rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-600">Preuves</p>
            <p className="mt-2 text-gray-700">Reçus numérotés, clôture quotidienne, journal des annulations.</p>
          </div>
        </div>
      </section>

      <div className="bg-blue-600 text-white rounded-xl p-6 my-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="font-semibold">
          Academia Helm gère finance et reçus automatiquement.{' '}
          <Link href="/modules" className="underline">
            Découvrez nos modules
          </Link>
          .
        </p>
        <Link href="/tarification" className="inline-flex rounded-lg bg-white/10 px-5 py-2.5 font-semibold hover:bg-white/15">
          Voir la tarification
        </Link>
      </div>

      <section>
        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          Fonctionnalité clé
        </span>
        <h2 className="text-2xl font-bold text-gray-900">4) Examens & bulletins : la confiance se joue ici</h2>
        <p className="mt-4 text-gray-700">
          Les parents jugent la qualité de l’école sur les bulletins. Une erreur de note détruit la confiance. Votre
          système doit imposer un flux clair : saisie, validation, verrouillage et corrections traçables.
        </p>
        <p className="mt-3 text-gray-700">
          Avec une organisation simple, les bulletins sont générés en quelques clics et la direction voit les retards de
          saisie immédiatement.
        </p>
        <blockquote className="text-xl font-medium text-gray-700 italic border-l-4 border-yellow-400 pl-4 my-8">
          “Bulletins à l’heure = moins de conflits, plus de confiance, moins de stress.”
        </blockquote>
      </section>

      <section>
        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          Critère de choix
        </span>
        <h2 className="text-2xl font-bold text-gray-900">5) Adoption, sécurité, résilience : ce que Google ne dit pas</h2>
        <p className="mt-4 text-gray-700">
          Deux écoles peuvent acheter le même outil et obtenir des résultats opposés. Le facteur décisif : l’adoption.
          Si c’est compliqué, l’équipe contourne et recrée du papier/Excel.
        </p>
        <p className="mt-3 text-gray-700">
          Vérifiez aussi la sécurité : rôles, permissions, journal des actions, sauvegardes, continuité. Et pour
          l’Afrique, la performance mobile et la tolérance réseau sont non négociables.
        </p>
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg my-6">
          <p className="font-semibold text-gray-900 mb-2">Encadré “test avant achat”</p>
          <ul className="list-disc pl-6 text-gray-800 space-y-1">
            <li>Encaisser et imprimer/partager un reçu</li>
            <li>Rechercher un élève et éditer son dossier</li>
            <li>Générer un bulletin complet</li>
          </ul>
        </div>
        <p className="text-gray-700">
          Pour aller plus loin, consultez{' '}
          <Link href="/securite" className="text-blue-700 hover:underline">
            sécurité et conformité
          </Link>{' '}
          et{' '}
          <Link href="/orion" className="text-blue-700 hover:underline">
            ORION, notre IA de direction
          </Link>
          .
        </p>
      </section>

      <div className="bg-blue-600 text-white rounded-xl p-6 my-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="font-semibold">
          Academia Helm gère le pilotage automatiquement.{' '}
          <Link href="/modules" className="underline">
            Découvrez nos modules
          </Link>
          .
        </p>
        <Link href="/contact" className="inline-flex rounded-lg bg-white/10 px-5 py-2.5 font-semibold hover:bg-white/15">
          Parler à un expert
        </Link>
      </div>

      <section>
        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          Déploiement
        </span>
        <h2 className="text-2xl font-bold text-gray-900">6) Déployer sans bloquer l’école : méthode en 48h</h2>
        <p className="mt-4 text-gray-700">
          Déployez par flux : finance → dossiers élèves → examens/bulletins → RH. Chaque étape doit produire un bénéfice
          visible dès la première semaine : reçu immédiat, relance, bulletin fiable.
        </p>
        <p className="mt-3 text-gray-700">
          Pour une approche claire et transparente, consultez{' '}
          <Link href="/tarification" className="text-blue-700 hover:underline">
            voir la tarification
          </Link>{' '}
          et{' '}
          <Link href="/modules" className="text-blue-700 hover:underline">
            découvrez nos modules
          </Link>
          .
        </p>
      </section>

      <section className="border-t border-gray-100 my-10" />

      <section>
        <h2 className="text-2xl font-bold text-gray-900">FAQ — Logiciel de gestion d’école</h2>
        <div className="mt-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Quel logiciel choisir pour une école primaire en Afrique ?</h3>
            <p className="mt-2 text-gray-700">
              Choisissez un outil simple, rapide sur mobile, adapté aux paiements locaux, et capable de produire des
              documents fiables. L’objectif est l’adoption, pas la complexité. Ensuite, vous activez les modules avancés.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Un logiciel peut-il réduire les impayés ?</h3>
            <p className="mt-2 text-gray-700">
              Oui, si la facturation est structurée, les reçus sont immédiats et les relances sont systématiques. La
              transparence (soldes, historique, échéances) réduit les contestations et accélère le recouvrement.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Comment éviter l’échec d’un projet de digitalisation ?</h3>
            <p className="mt-2 text-gray-700">
              Déployer par étapes, former des référents, viser des quick wins, et garder les écrans simples. Le logiciel
              doit soutenir votre organisation, pas la complexifier. La direction doit piloter le changement.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Quels rapports doivent être disponibles chaque jour ?</h3>
            <p className="mt-2 text-gray-700">
              État de caisse, encaissements, annulations, et situation des impayés. Ces éléments donnent une visibilité
              immédiate à la direction et protègent l’établissement contre les “fuites” invisibles.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Pourquoi la sécurité et les rôles sont-ils indispensables ?</h3>
            <p className="mt-2 text-gray-700">
              Parce qu’ils protègent l’école : séparation caisse/scolarité/direction, validations sur remises et
              annulations, historique des actions. Sans contrôle interne, les erreurs et abus deviennent possibles.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Combien de temps pour une mise en place ?</h3>
            <p className="mt-2 text-gray-700">
              En commençant par les flux essentiels, une mise en place peut se faire en moins de 48h, puis vous étendez
              progressivement. Le secret : des bénéfices visibles dès la première semaine.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-gray-100 my-10" />

      <section>
        <h2 className="text-lg font-semibold text-gray-900">Pages complémentaires</h2>
        <p className="mt-2 text-gray-700">
          <Link href="/gestion-scolaire" className="text-blue-700 hover:underline">
            Gestion scolaire en Afrique
          </Link>{' '}
          ·{' '}
          <Link href="/logiciel-ecole-afrique" className="text-blue-700 hover:underline">
            Logiciel école Afrique
          </Link>{' '}
          ·{' '}
          <Link href="/gestion-etablissement-scolaire" className="text-blue-700 hover:underline">
            Gestion d’établissement scolaire
          </Link>
        </p>
      </section>

      <section className="mt-10 rounded-2xl border border-gray-200 bg-gray-50 p-8">
        <h2 className="text-2xl font-bold text-gray-900">Prêt à passer à une gestion scolaire professionnelle ?</h2>
        <p className="mt-3 text-gray-700">
          Academia Helm unifie finance, scolarité et examens pour rendre votre établissement pilotable et durable.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="flex items-start gap-2 text-gray-800">
            <span className="mt-0.5 text-green-600">✓</span>
            <span>+12% de taux de recouvrement</span>
          </div>
          <div className="flex items-start gap-2 text-gray-800">
            <span className="mt-0.5 text-green-600">✓</span>
            <span>Bulletins générés en quelques clics</span>
          </div>
          <div className="flex items-start gap-2 text-gray-800">
            <span className="mt-0.5 text-green-600">✓</span>
            <span>Mise en place en moins de 48h</span>
          </div>
        </div>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Démarrer maintenant
          </Link>
          <Link href="/contact" className="text-blue-700 font-semibold hover:underline">
            Parler à un expert
          </Link>
        </div>
      </section>
    </main>
  );
}

