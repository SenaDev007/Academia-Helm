import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/seo/Breadcrumbs';

export const metadata: Metadata = {
  title: "Gestion d’établissement scolaire : piloter sans chaos | Academia Helm",
  description:
    "Gestion d’établissement scolaire en Afrique de l’Ouest : process, KPI, recouvrement Mobile Money, bulletins et RH. Méthode claire pour structurer votre école.",
  alternates: {
    canonical: 'https://academiahelm.com/gestion-etablissement-scolaire',
  },
};

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Gestion d’établissement scolaire' }]} />

      <header className="mb-10">
        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          Pilotage & organisation
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Gestion d’établissement scolaire : process, KPI et recouvrement pour piloter sans chaos
        </h1>
        <p className="mt-4 text-lg text-gray-700">
          Vous dirigez une école privée au Bénin, en Côte d’Ivoire, au Sénégal, au Togo ou au Burkina Faso ? Entre les
          cahiers, Excel, les logiciels obsolètes et les urgences quotidiennes, la gestion devient vite “réactive”.
        </p>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600">8 min de lecture</p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Tester gratuitement Academia Helm
          </Link>
        </div>
        <p className="mt-5 text-lg text-gray-700">
          L’objectif de ce guide : vous donner une structure simple (process + contrôle interne + KPI) pour sécuriser
          votre recouvrement Mobile Money, sortir les bulletins à temps, réduire l’absentéisme et retrouver une direction
          sereine.
        </p>
      </header>

      <section className="border-t border-gray-100 my-10" />

      <section>
        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          Contexte Afrique de l’Ouest
        </span>
        <h2 className="text-2xl font-bold text-gray-900">1) Le vrai problème : tout repose sur vous</h2>
        <p className="mt-4 text-gray-700">
          Dans beaucoup d’établissements, la direction est seule face à tout : inscriptions, encaissements, plaintes
          parents, incidents, examens. Quand l’information est dispersée (cahiers, WhatsApp, Excel), chaque décision
          devient une enquête.
        </p>
        <p className="mt-3 text-gray-700">
          Résultat : bulletins en retard, absentéisme mal suivi, et pertes invisibles sur la caisse. Un système de
          gestion doit d’abord rendre l’école “lisible” — pour que vos équipes exécutent et que vous pilotiez.
        </p>
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg my-6">
          <p className="text-gray-800">
            Signal d’alerte : si vous ne pouvez pas répondre en 30 secondes à “qui doit combien par classe ?”, “quels
            bulletins manquent ?” et “qui a validé la remise ?”, votre organisation est fragile.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
          <div className="rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-600">Impact typique</p>
            <p className="text-4xl font-bold text-blue-700">+12%</p>
            <p className="mt-2 text-gray-700">de taux de recouvrement quand le suivi des impayés est piloté chaque semaine.</p>
          </div>
          <div className="rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-600">Impact typique</p>
            <p className="text-4xl font-bold text-blue-700">-8%</p>
            <p className="mt-2 text-gray-700">d’absentéisme quand les retards et absences sont suivis et traités.</p>
          </div>
        </div>
      </section>

      <section>
        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          Organisation
        </span>
        <h2 className="text-2xl font-bold text-gray-900">2) Rôles clairs : qui décide, qui exécute, qui contrôle</h2>
        <p className="mt-4 text-gray-700">
          Première règle : séparer au minimum l’encaissement et la validation. Même dans une petite école, c’est la base
          du contrôle interne. Sinon, une annulation de reçu ou une remise “de faveur” passe sans trace.
        </p>
        <p className="mt-3 text-gray-700">
          Une bonne organisation n’est pas une bureaucratie : c’est un filet de sécurité. Elle protège votre trésorerie,
          votre réputation et votre équipe.
        </p>
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg my-6">
          <p className="font-semibold text-gray-900 mb-2">Mini-checklist direction</p>
          <ul className="list-disc pl-6 text-gray-800 space-y-1">
            <li>Un responsable “caisse” et un responsable “validation/remises”</li>
            <li>Clôture quotidienne avec état de caisse</li>
            <li>Historique des actions sensibles (annulation, remise, correction de note)</li>
          </ul>
        </div>
        <p className="text-gray-700">
          Exemple terrain : au Togo ou au Bénin, si le recouvrement passe par Mobile Money, le rapprochement (paiement ↔
          reçu ↔ solde) doit être clair, sinon vous perdez du temps au guichet et vous créez des conflits.
        </p>
      </section>

      <div className="bg-blue-600 text-white rounded-xl p-6 my-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="font-semibold">
          Academia Helm gère le contrôle interne et la traçabilité automatiquement.{' '}
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
          Finance & recouvrement
        </span>
        <h2 className="text-2xl font-bold text-gray-900">3) Recouvrement des frais : votre levier n°1</h2>
        <p className="mt-4 text-gray-700">
          Dans une école privée, la trésorerie finance tout : salaires, fournitures, qualité pédagogique. Si le
          recouvrement est “au cahier”, vous découvrez les impayés trop tard — et vous subissez.
        </p>
        <p className="mt-3 text-gray-700">
          Le bon pilotage consiste à suivre chaque semaine : impayés par classe, échéances à 7/30 jours, remises
          accordées, et performance par agent d’encaissement.
        </p>
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg my-6">
          <p className="font-semibold text-gray-900 mb-2">À mettre en place tout de suite</p>
          <ul className="list-disc pl-6 text-gray-800 space-y-1">
            <li>Reçus instantanés et numérotés</li>
            <li>Règles de remise (seuils + validation)</li>
            <li>Clôture de caisse quotidienne + états exportables</li>
          </ul>
        </div>
        <p className="text-gray-700">
          Exemple concret : en Côte d’Ivoire ou au Sénégal, les paiements Mobile Money doivent être rapprochés avec
          l’élève et la classe, sinon le parent revient contester et votre équipe perd des heures.
        </p>
      </section>

      <section>
        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          Pédagogie & bulletins
        </span>
        <h2 className="text-2xl font-bold text-gray-900">4) Bulletins et examens : la confiance se joue ici</h2>
        <p className="mt-4 text-gray-700">
          Les bulletins en retard détruisent la confiance. La solution n’est pas “travailler plus”, mais verrouiller le
          flux : qui saisit, quand on valide, quand on publie et comment on corrige sans effacer l’historique.
        </p>
        <p className="mt-3 text-gray-700">
          Quand l’information est centralisée, les bulletins sont générés en quelques clics — et la direction voit
          immédiatement les retards de saisie et les anomalies.
        </p>
        <blockquote className="text-xl font-medium text-gray-700 italic border-l-4 border-yellow-400 pl-4 my-8">
          “Quand les bulletins sortent à temps, les parents cessent de douter. Et l’équipe arrête de courir.”
        </blockquote>
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg my-6">
          <p className="text-gray-800">
            Objectif réaliste : bulletins générés en quelques clics, avec un historique clair des corrections et des
            validations.
          </p>
        </div>
      </section>

      <div className="bg-blue-600 text-white rounded-xl p-6 my-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="font-semibold">
          Academia Helm gère examens et bulletins automatiquement.{' '}
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
          RH & discipline
        </span>
        <h2 className="text-2xl font-bold text-gray-900">5) RH, discipline, absentéisme : garder la maîtrise</h2>
        <p className="mt-4 text-gray-700">
          La direction perd du temps quand les incidents et absences ne sont pas structurés. Un registre digital simple
          (absence, retard, sanction, communication) réduit les malentendus et rend les décisions justes.
        </p>
        <p className="mt-3 text-gray-700">
          Côté RH, même si la paie est gérée ailleurs, vous devez connaître la présence et les remplacements. Un
          établissement stable se pilote avec des faits.
        </p>
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg my-6">
          <p className="font-semibold text-gray-900 mb-2">Exemple terrain</p>
          <p className="text-gray-800">
            Au Burkina Faso ou au Togo, une absence non signalée d’un enseignant désorganise toute la journée. Un suivi
            clair permet d’anticiper, de remplacer vite, et de réduire l’absentéisme.
          </p>
        </div>
      </section>

      <section>
        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          Déploiement
        </span>
        <h2 className="text-2xl font-bold text-gray-900">6) Déployer sans casser l’école : la méthode en 48h</h2>
        <p className="mt-4 text-gray-700">
          Une digitalisation réussie se fait par flux : finance → dossiers élèves → examens/bulletins → RH → pilotage.
          Chaque étape doit produire un bénéfice visible, sinon l’équipe revient à Excel.
        </p>
        <p className="mt-3 text-gray-700">
          Avec une mise en place en moins de 48h, vous sécurisez d’abord la caisse et les dossiers, puis vous étendez
          progressivement. Pour aller plus loin, explorez la{' '}
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

      <section className="border-t border-gray-100 my-10" />

      <section>
        <h2 className="text-2xl font-bold text-gray-900">FAQ — Gestion d’établissement scolaire</h2>

        <div className="mt-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Par où commencer si tout est sur cahiers et Excel ?</h3>
            <p className="mt-2 text-gray-700">
              Commencez par la finance et les dossiers élèves : reçus, échéances, soldes, listes fiables. Ce socle
              supprime les disputes au guichet et rend les décisions plus simples. Ensuite seulement, industrialisez les
              notes et les bulletins.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900">Comment améliorer le recouvrement sans “forcer” les parents ?</h3>
            <p className="mt-2 text-gray-700">
              Avec de la clarté : échéances affichées, reçus instantanés, soldes compréhensibles et relances structurées.
              En Afrique de l’Ouest, Mobile Money facilite le paiement, mais il faut une traçabilité propre. Un pilotage
              hebdomadaire fait souvent progresser le taux de recouvrement.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900">Quels KPI suivre chaque semaine ?</h3>
            <p className="mt-2 text-gray-700">
              Taux de recouvrement, impayés par classe, échéances à 7/30 jours, remises accordées, absentéisme, retards
              de saisie des notes, et incidents récurrents. L’idée n’est pas de tout mesurer, mais de déclencher des
              actions rapides quand un indicateur dérive.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900">Pourquoi les bulletins prennent-ils autant de temps ?</h3>
            <p className="mt-2 text-gray-700">
              Parce que le flux n’est pas verrouillé : saisies tardives, validations floues, corrections sans historique.
              Quand le process est clair, les bulletins sont générés en quelques clics et la direction voit tout de
              suite ce qui bloque.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900">Comment réduire l’absentéisme dans l’établissement ?</h3>
            <p className="mt-2 text-gray-700">
              En détectant tôt : pointage, règles simples, suivi des retards, et alertes direction. Une fois la donnée
              fiable, vous pouvez agir (rappels, rencontres parents, mesures éducatives) au bon moment. Des écoles
              constatent jusqu’à -8% d’absentéisme avec un suivi régulier.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900">Combien de temps pour mettre en place un logiciel ?</h3>
            <p className="mt-2 text-gray-700">
              Si vous commencez par les flux essentiels (finance + dossiers élèves), la mise en place peut se faire en
              moins de 48h, puis vous déployez le reste par étapes. Le plus important est d’obtenir des “quick wins”
              visibles, pour que l’équipe adopte l’outil au quotidien.
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
          <Link href="/logiciel-gestion-ecole" className="text-blue-700 hover:underline">
            Logiciel de gestion d’école
          </Link>{' '}
          ·{' '}
          <Link href="/logiciel-ecole-afrique" className="text-blue-700 hover:underline">
            Logiciel école Afrique
          </Link>
        </p>
      </section>

      <section className="mt-10 rounded-2xl border border-gray-200 bg-gray-50 p-8">
        <h2 className="text-2xl font-bold text-gray-900">Prêt à piloter votre établissement, sans stress ?</h2>
        <p className="mt-3 text-gray-700">
          Academia Helm structure la finance, la scolarité et les examens pour que votre direction se concentre sur
          l’essentiel.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="flex items-start gap-2 text-gray-800">
            <span className="mt-0.5 text-green-600">✓</span>
            <span>+12% de taux de recouvrement avec suivi clair</span>
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

