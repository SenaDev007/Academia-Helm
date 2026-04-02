import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import { ArticleLayout } from '@/components/articles/ArticleLayout';
import { getArticleBySlug } from '@/data/articles';
import { notFound } from 'next/navigation';

const article = getArticleBySlug('logiciel-ecole-afrique');

export const metadata: Metadata = article
  ? {
      title: article.seo.title,
      description: article.seo.description,
      alternates: { canonical: article.seo.canonical },
      openGraph: {
        title: article.seo.title,
        description: article.seo.description,
        images: [{ url: article.seo.ogImage ?? article.coverImage.url }],
        type: 'article',
        publishedTime: article.publishedAt,
        modifiedTime: article.updatedAt,
      },
    }
  : {};

export default function Page() {
  if (!article) notFound();

  return (
    <ArticleLayout article={article}>
      <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Logiciel école Afrique' }]} />

      <section className="border-t border-gray-100 my-10" />

      <section>
        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          Introduction
        </span>
        <h2 className="text-2xl font-bold text-gray-900">1) Le bon logiciel n’est pas “riche”, il est fiable</h2>
        <p className="mt-4 text-gray-700">
          Beaucoup de solutions échouent parce qu’elles ajoutent de la complexité : écrans lourds, lenteur, logique
          importée. En Afrique de l’Ouest, l’école a besoin d’un outil qui tient dans la vraie vie : inscriptions,
          caisse, reçus, bulletins, absences.
        </p>
        <p className="mt-3 text-gray-700">
          Votre objectif n’est pas d’“avoir un logiciel”, mais d’obtenir des résultats : <span className="font-semibold">+12% de taux de recouvrement</span>,
          <span className="font-semibold"> -8% d’absentéisme</span>, et des bulletins générés en quelques clics.
        </p>
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg my-6">
          <p className="text-gray-800">
            Plan de lecture : critères de choix → erreurs à éviter → déploiement en 48h → FAQ.
          </p>
        </div>
      </section>

      <section>
        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          Critère #1
        </span>
        <h2 className="text-2xl font-bold text-gray-900">2) Mobile-first : vitesse sur Android, sinon abandon</h2>
        <p className="mt-4 text-gray-700">
          Dans beaucoup d’écoles, l’administratif opère sur smartphone. Si l’interface est lourde, l’adoption chute.
          Exigez un affichage rapide, des formulaires courts, et des actions en un minimum de clics.
        </p>
        <p className="mt-3 text-gray-700">
          Exemple : en pleine période d’inscription au Bénin, si la caisse met 20 secondes à charger, la file d’attente
          devient un problème… et l’équipe revient au cahier.
        </p>
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg my-6">
          <p className="font-semibold text-gray-900 mb-2">À vérifier avant de choisir</p>
          <ul className="list-disc pl-6 text-gray-800 space-y-1">
            <li>Temps d’ouverture et de recherche d’un élève</li>
            <li>Encaissement + reçu en moins de 30 secondes</li>
            <li>Interface lisible sur écran mobile</li>
          </ul>
        </div>
      </section>

      <section>
        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          Critère #2
        </span>
        <h2 className="text-2xl font-bold text-gray-900">3) Mobile Money : traçabilité et preuves, pas “messages WhatsApp”</h2>
        <p className="mt-4 text-gray-700">
          Cash + Mobile Money + banque : votre logiciel doit centraliser et rapprocher. Sans traçabilité (qui a encaissé,
          quand, pour quel élève, quelle classe), les pertes s’accumulent et les conflits parents explosent.
        </p>
        <p className="mt-3 text-gray-700">
          Un bon système donne une vue claire : impayés par classe, échéances, remises, et états de caisse quotidiens.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
          <div className="rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-600">Impact typique</p>
            <p className="text-4xl font-bold text-blue-700">+12%</p>
            <p className="mt-2 text-gray-700">de recouvrement quand le suivi est hebdomadaire.</p>
          </div>
          <div className="rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-600">Preuves</p>
            <p className="mt-2 text-gray-700">Reçus numérotés, annulations contrôlées, clôture quotidienne.</p>
          </div>
        </div>
      </section>

      <div className="bg-blue-600 text-white rounded-xl p-6 my-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="font-semibold">
          Academia Helm gère la caisse et les reçus automatiquement.{' '}
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
          Critère #3
        </span>
        <h2 className="text-2xl font-bold text-gray-900">4) Bulletins et documents : la crédibilité de l’école</h2>
        <p className="mt-4 text-gray-700">
          La confiance passe par les documents : reçus, attestations, bulletins. Ils doivent être rapides à produire,
          cohérents et archivables. Un bulletin ne doit pas “changer” après publication sans historique.
        </p>
        <p className="mt-3 text-gray-700">
          Quand le flux est clair, les bulletins sont générés en quelques clics et la direction voit les retards de
          saisie. C’est aussi un moyen de protéger l’équipe : moins de stress, plus de contrôle.
        </p>
        <blockquote className="text-xl font-medium text-gray-700 italic border-l-4 border-yellow-400 pl-4 my-8">
          “Un reçu immédiat et un bulletin fiable valent plus qu’un logiciel ‘compliqué’.”
        </blockquote>
      </section>

      <section>
        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          Critère #4
        </span>
        <h2 className="text-2xl font-bold text-gray-900">5) Sécurité & contrôle interne : éviter les fuites</h2>
        <p className="mt-4 text-gray-700">
          La sécurité n’est pas optionnelle. Votre établissement doit pouvoir séparer les rôles (caisse, scolarité,
          direction), limiter les annulations et tracer les actions sensibles. C’est ce qui réduit les erreurs et les
          pertes invisibles.
        </p>
        <p className="mt-3 text-gray-700">
          Exemple : au Sénégal, une remise accordée sans validation peut devenir une “habitude” qui casse la trésorerie.
          Le contrôle interne protège votre modèle économique.
        </p>
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg my-6">
          <p className="font-semibold text-gray-900 mb-2">Encadré direction</p>
          <ul className="list-disc pl-6 text-gray-800 space-y-1">
            <li>Rôles et droits par module</li>
            <li>Journal des actions sensibles</li>
            <li>Sauvegardes et continuité</li>
          </ul>
        </div>
      </section>

      <div className="bg-blue-600 text-white rounded-xl p-6 my-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="font-semibold">
          Academia Helm gère la sécurité et la traçabilité automatiquement.{' '}
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
        <h2 className="text-2xl font-bold text-gray-900">6) Mise en place en moins de 48h : la méthode simple</h2>
        <p className="mt-4 text-gray-700">
          Déployez par étapes : finance + dossiers élèves → examens/bulletins → RH. Chaque étape doit produire un bénéfice
          visible, sinon l’équipe revient aux anciens outils.
        </p>
        <p className="mt-3 text-gray-700">
          Pour comprendre le périmètre produit, consultez{' '}
          <Link href="/modules" className="text-blue-700 hover:underline">
            découvrez nos modules
          </Link>{' '}
          et{' '}
          <Link href="/tarification" className="text-blue-700 hover:underline">
            voir la tarification
          </Link>
          . Pour la conformité, voir{' '}
          <Link href="/securite" className="text-blue-700 hover:underline">
            sécurité et conformité
          </Link>
          .
        </p>
      </section>

      <section className="border-t border-gray-100 my-10" />

      <section>
        <h2 className="text-2xl font-bold text-gray-900">FAQ — Logiciel école Afrique</h2>
        <div className="mt-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Quels modules prioriser pour un premier déploiement ?</h3>
            <p className="mt-2 text-gray-700">
              Finance (frais, encaissements, reçus) et dossiers élèves. Ce sont les flux qui apportent le plus vite un
              gain opérationnel et un ROI direct. Ensuite, vous déployez examens et bulletins.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Un logiciel peut-il fonctionner avec une connexion instable ?</h3>
            <p className="mt-2 text-gray-700">
              Oui, s’il est léger et tolérant au réseau. L’essentiel est de ne pas bloquer la caisse et les opérations
              quotidiennes. Demandez une démonstration sur mobile, en conditions réelles.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Comment éviter le retour à Excel après 2 mois ?</h3>
            <p className="mt-2 text-gray-700">
              En obtenant des quick wins : reçus immédiats, relances, états de caisse, bulletins fiables. Formez des
              référents (caisse, scolarité) et déployez par étapes. Un outil adopté est un outil qui simplifie.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Pourquoi la traçabilité est-elle si importante ?</h3>
            <p className="mt-2 text-gray-700">
              Parce que la preuve réduit les conflits : qui a encaissé, quand, et pour quel élève. Sans trace, vous
              perdez du temps et de l’argent. La traçabilité protège la direction et l’équipe.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Le logiciel doit-il gérer la sécurité et les rôles ?</h3>
            <p className="mt-2 text-gray-700">
              Oui. Séparer caisse, scolarité et direction évite les erreurs et les abus. Les validations sur remises et
              annulations protègent votre trésorerie. C’est un critère de choix non négociable.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Combien de temps pour mettre en place ?</h3>
            <p className="mt-2 text-gray-700">
              En commençant par les flux essentiels, une mise en place peut se faire en moins de 48h, puis vous étendez
              progressivement. Le secret : un plan simple et des gains visibles dès la première semaine.
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
          <Link href="/gestion-etablissement-scolaire" className="text-blue-700 hover:underline">
            Gestion d’établissement scolaire
          </Link>
        </p>
      </section>

      <section className="mt-10 rounded-2xl border border-gray-200 bg-gray-50 p-8">
        <h2 className="text-2xl font-bold text-gray-900">Prêt à choisir un logiciel qui tient sur la durée ?</h2>
        <p className="mt-3 text-gray-700">
          Academia Helm est conçu pour les écoles privées francophones : finance, scolarité, examens, RH et pilotage.
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
    </ArticleLayout>
  );
}

