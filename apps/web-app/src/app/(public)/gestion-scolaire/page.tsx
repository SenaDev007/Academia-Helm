import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/seo/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Gestion scolaire en Afrique : méthode & pilotage | Academia Helm',
  description:
    "Gestion scolaire en Afrique de l’Ouest : recouvrement Mobile Money, bulletins, absentéisme, RH et process. Guide concret pour diriger votre école privée.",
  alternates: {
    canonical: 'https://academiahelm.com/gestion-scolaire',
  },
};

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: 'Accueil', href: '/' },
          { label: 'Gestion scolaire en Afrique' },
        ]}
      />

      <header className="mb-10">
        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          Gestion scolaire & pilotage
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Gestion scolaire en Afrique : piloter votre établissement avec des process et des KPI
        </h1>
        <p className="mt-4 text-lg text-gray-700">
          Au Bénin, en Côte d’Ivoire, au Sénégal, au Togo ou au Burkina Faso, la direction scolaire doit gérer une
          réalité exigeante : cahiers, Excel, paiements Mobile Money, parents pressés, bulletins en retard et
          absentéisme.
        </p>
        <p className="mt-3 text-lg text-gray-700">
          Dans ce guide, vous obtenez une méthode claire : quoi structurer en premier, quels indicateurs suivre et
          comment digitaliser sans bloquer vos équipes.
        </p>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600">9 min de lecture</p>
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
        <h2 className="text-2xl font-bold text-gray-900">1) Passer du “réactif” au pilotage</h2>
        <p className="mt-4 text-gray-700">
          La gestion scolaire n’est pas un empilement de tâches. C’est un système : des process simples, des données
          fiables et des décisions traçables. Sans ça, vous passez vos journées à “éteindre des feux”.
        </p>
        <p className="mt-3 text-gray-700">
          Dans la région (Afrique de l’Ouest francophone), le point dur revient souvent : recouvrement, bulletins,
          discipline/absences, et communication parents. Ce guide vous donne un plan clair pour structurer ces flux.
        </p>
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg my-6">
          <p className="text-gray-800">
            Objectif : obtenir des quick wins visibles (reçus, relances, bulletins) pour que l’équipe adopte le système
            au quotidien.
          </p>
        </div>
      </section>

      <section>
        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          Finance
        </span>
        <h2 className="text-2xl font-bold text-gray-900">2) Recouvrement des frais : sécuriser la trésorerie</h2>
        <p className="mt-4 text-gray-700">
          Le recouvrement est le moteur de votre stabilité. Quand il repose sur un cahier ou un fichier Excel,
          l’impayé devient invisible. Et quand il est invisible, il explose en fin de trimestre.
        </p>
        <p className="mt-3 text-gray-700">
          Le bon pilotage : échéances claires, reçus instantanés, relances, et un reporting par classe. Avec Mobile
          Money, la traçabilité (paiement ↔ reçu ↔ solde) doit être irréprochable.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
          <div className="rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-600">Impact typique</p>
            <p className="text-4xl font-bold text-blue-700">+12%</p>
            <p className="mt-2 text-gray-700">de taux de recouvrement avec suivi hebdomadaire.</p>
          </div>
          <div className="rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-600">Preuve & confiance</p>
            <p className="mt-2 text-gray-700">Reçus numérotés, clôture quotidienne, historique des annulations.</p>
          </div>
        </div>
      </section>

      <div className="bg-blue-600 text-white rounded-xl p-6 my-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="font-semibold">
          Academia Helm gère le recouvrement automatiquement.{' '}
          <Link href="/modules" className="underline">
            Découvrez nos modules
          </Link>
          .
        </p>
        <Link href="/signup" className="inline-flex rounded-lg bg-white/10 px-5 py-2.5 font-semibold hover:bg-white/15">
          Tester gratuitement
        </Link>
      </div>

      <section>
        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          Bulletins
        </span>
        <h2 className="text-2xl font-bold text-gray-900">3) Examens & bulletins : produire sans stress</h2>
        <p className="mt-4 text-gray-700">
          Les bulletins en retard abîment la relation parents. Le vrai problème est le flux : saisie tardive, validation
          floue, corrections sans trace. Un process clair fait gagner du temps et protège l’établissement.
        </p>
        <p className="mt-3 text-gray-700">
          Une fois centralisé, vous passez de “travail de fin de trimestre” à “pilotage continu”. Les bulletins sont
          générés en quelques clics, et la direction voit ce qui bloque.
        </p>
        <blockquote className="text-xl font-medium text-gray-700 italic border-l-4 border-yellow-400 pl-4 my-8">
          “La qualité perçue d’une école se joue sur la régularité : reçus, notes, bulletins, réponses.”
        </blockquote>
      </section>

      <section>
        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          Absentéisme
        </span>
        <h2 className="text-2xl font-bold text-gray-900">4) Absentéisme & discipline : agir tôt</h2>
        <p className="mt-4 text-gray-700">
          Quand l’absence est notée sur papier, elle n’existe pas pour le pilotage. Vous découvrez les dérives trop
          tard, et vous subissez les conflits. Un suivi simple (retards, absences, incidents) rend les décisions justes.
        </p>
        <p className="mt-3 text-gray-700">
          Avec une donnée fiable, vous déclenchez des actions : rappel, rencontre parent, mesure éducative. Des écoles
          observent jusqu’à <span className="font-semibold">-8% d’absentéisme</span> quand le suivi est structuré.
        </p>
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg my-6">
          <p className="font-semibold text-gray-900 mb-2">Exemple terrain</p>
          <p className="text-gray-800">
            Au Sénégal ou en Côte d’Ivoire, une classe instable pénalise tout le niveau. Un tableau de bord par classe
            permet de cibler les actions sans “punir tout le monde”.
          </p>
        </div>
      </section>

      <div className="bg-blue-600 text-white rounded-xl p-6 my-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="font-semibold">
          Academia Helm gère le suivi élèves automatiquement.{' '}
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
          Organisation
        </span>
        <h2 className="text-2xl font-bold text-gray-900">5) Process & contrôle interne : éviter les fuites</h2>
        <p className="mt-4 text-gray-700">
          Le contrôle interne protège votre école : validations sur remises, historique des actions sensibles, clôture
          de caisse, et règles de correction. Même sans intention, l’erreur coûte cher quand l’école grandit.
        </p>
        <p className="mt-3 text-gray-700">
          L’idée n’est pas d’ajouter des étapes. C’est de rendre les décisions traçables, et d’éviter que tout repose sur
          une seule personne.
        </p>
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg my-6">
          <p className="font-semibold text-gray-900 mb-2">Encadré direction</p>
          <ul className="list-disc pl-6 text-gray-800 space-y-1">
            <li>Séparer encaissement et validation</li>
            <li>Clôture quotidienne</li>
            <li>Journal des actions (annulation, remise, correction)</li>
          </ul>
        </div>
      </section>

      <section>
        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          Déploiement
        </span>
        <h2 className="text-2xl font-bold text-gray-900">6) Déployer sans bloquer l’école (en moins de 48h)</h2>
        <p className="mt-4 text-gray-700">
          Déployez par étapes : finance → dossiers élèves → examens/bulletins → RH. Chaque étape doit générer un gain
          visible (reçu immédiat, relance, bulletin fiable). C’est ainsi que l’adoption devient naturelle.
        </p>
        <p className="mt-3 text-gray-700">
          Pour le périmètre fonctionnel, consultez{' '}
          <Link href="/modules" className="text-blue-700 hover:underline">
            découvrez nos modules
          </Link>{' '}
          et{' '}
          <Link href="/tarification" className="text-blue-700 hover:underline">
            voir la tarification
          </Link>
          . Pour aller plus loin,{' '}
          <Link href="/orion" className="text-blue-700 hover:underline">
            ORION, notre IA de direction
          </Link>{' '}
          vous aide à décider plus vite.
        </p>
      </section>

      <section className="border-t border-gray-100 my-10" />

      <section>
        <h2 className="text-2xl font-bold text-gray-900">FAQ — Gestion scolaire en Afrique</h2>
        <div className="mt-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Par quoi commencer pour améliorer la gestion scolaire ?</h3>
            <p className="mt-2 text-gray-700">
              Commencez par la finance et les dossiers élèves : c’est le socle qui simplifie tout le reste. Une fois les
              reçus, les soldes et les listes fiables, vous gagnez du temps au guichet et vous réduisez les tensions.
              Ensuite, vous industrialisez notes et bulletins.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Comment réduire les impayés dans une école ?</h3>
            <p className="mt-2 text-gray-700">
              Avec des échéances claires, des relances structurées et une traçabilité complète (paiement ↔ reçu ↔ solde).
              Les parents paient plus facilement quand l’information est simple et transparente. Suivez le taux de
              recouvrement chaque semaine, pas seulement en fin de trimestre.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Quel rôle joue Mobile Money dans la gestion scolaire ?</h3>
            <p className="mt-2 text-gray-700">
              Mobile Money accélère les paiements, mais il exige une preuve claire. Sans rapprochement automatique, vous
              créez des contestations et du travail manuel. Un bon système relie chaque transaction à l’élève, à la
              classe et au reçu.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Pourquoi les bulletins sortent-ils en retard ?</h3>
            <p className="mt-2 text-gray-700">
              Le flux n’est pas verrouillé : saisies tardives, validations floues, corrections sans historique. Quand le
              process est clair, les bulletins sont générés en quelques clics. La direction voit immédiatement ce qui
              bloque et peut agir.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">La digitalisation fonctionne-t-elle avec une connexion instable ?</h3>
            <p className="mt-2 text-gray-700">
              Oui, si l’outil est pensé pour la réalité terrain : performance mobile, tolérance réseau et sauvegardes.
              L’essentiel est de ne pas bloquer la caisse et les opérations quotidiennes. C’est un critère de choix
              important en Afrique de l’Ouest.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Combien de temps pour mettre en place un logiciel ?</h3>
            <p className="mt-2 text-gray-700">
              En commençant par les flux essentiels (finance + dossiers), une mise en place peut se faire en moins de 48h,
              puis vous étendez progressivement. Le secret : obtenir vite des bénéfices visibles pour sécuriser l’adoption
              de l’équipe.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-gray-100 my-10" />

      <section>
        <h2 className="text-lg font-semibold text-gray-900">Pages complémentaires</h2>
        <p className="mt-2 text-gray-700">
          <Link href="/logiciel-gestion-ecole" className="text-blue-700 hover:underline">
            Logiciel de gestion d’école
          </Link>{' '}
          ·{' '}
          <Link href="/gestion-etablissement-scolaire" className="text-blue-700 hover:underline">
            Gestion d’établissement scolaire
          </Link>{' '}
          ·{' '}
          <Link href="/logiciel-ecole-afrique" className="text-blue-700 hover:underline">
            Logiciel école Afrique
          </Link>
        </p>
      </section>

      <section className="mt-10 rounded-2xl border border-gray-200 bg-gray-50 p-8">
        <h2 className="text-2xl font-bold text-gray-900">Passez à une gestion scolaire moderne</h2>
        <p className="mt-3 text-gray-700">
          Academia Helm unifie la scolarité, la finance et les examens pour rendre votre établissement pilotable.
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

