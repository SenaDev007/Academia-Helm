import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import { ArticleLayout } from '@/components/articles/ArticleLayout';
import { getArticleBySlug } from '@/data/articles';
import { notFound } from 'next/navigation';
import {
  ArticleCallout,
  ArticleDivider,
  ArticleFaq,
  ArticleInlineCta,
  ArticleKpiCard,
  ArticleKpiGrid,
  ArticleSection,
} from '@/components/articles/blocks/ArticleBlocks';

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

      <ArticleDivider />

      <ArticleSection eyebrow="Introduction" title="1) Le bon logiciel n’est pas “riche”, il est fiable">
        <p>
          Beaucoup de solutions échouent parce qu’elles ajoutent de la complexité : écrans lourds, lenteur, logique
          importée. En Afrique de l’Ouest, l’école a besoin d’un outil qui tient dans la vraie vie : inscriptions,
          caisse, reçus, bulletins, absences.
        </p>
        <p>
          Votre objectif n’est pas d’“avoir un logiciel”, mais d’obtenir des résultats :{' '}
          <span className="font-semibold text-slate-900">+12% de taux de recouvrement</span>,{' '}
          <span className="font-semibold text-slate-900">-8% d’absentéisme</span>, et des bulletins générés en quelques
          clics.
        </p>
        <ArticleCallout>Plan de lecture : critères de choix → erreurs à éviter → déploiement en 48h → FAQ.</ArticleCallout>
      </ArticleSection>

      <ArticleSection eyebrow="Critère #1" title="2) Mobile-first : vitesse sur Android, sinon abandon">
        <p>
          Dans beaucoup d’écoles, l’administratif opère sur smartphone. Si l’interface est lourde, l’adoption chute.
          Exigez un affichage rapide, des formulaires courts, et des actions en un minimum de clics.
        </p>
        <p>
          Exemple : en pleine période d’inscription au Bénin, si la caisse met 20 secondes à charger, la file d’attente
          devient un problème… et l’équipe revient au cahier.
        </p>
        <ArticleCallout title="À vérifier avant de choisir">
          <ul className="list-disc pl-5">
            <li>Temps d’ouverture et de recherche d’un élève</li>
            <li>Encaissement + reçu en moins de 30 secondes</li>
            <li>Interface lisible sur écran mobile</li>
          </ul>
        </ArticleCallout>
      </ArticleSection>

      <ArticleSection eyebrow="Critère #2" title="3) Mobile Money : traçabilité et preuves, pas “messages WhatsApp”">
        <p>
          Cash + Mobile Money + banque : votre logiciel doit centraliser et rapprocher. Sans traçabilité (qui a encaissé,
          quand, pour quel élève, quelle classe), les pertes s’accumulent et les conflits parents explosent.
        </p>
        <p>Un bon système donne une vue claire : impayés par classe, échéances, remises, et états de caisse quotidiens.</p>
        <ArticleKpiGrid>
          <ArticleKpiCard label="Impact typique" value="+12%" description="de recouvrement quand le suivi est hebdomadaire." />
          <ArticleKpiCard
            label="Preuves"
            value="Traçabilité"
            description="Reçus numérotés, annulations contrôlées, clôture quotidienne."
          />
        </ArticleKpiGrid>
      </ArticleSection>

      <ArticleInlineCta
        text={
          <>
            Academia Helm gère la caisse et les reçus automatiquement.{' '}
            <Link href="/modules" className="underline">
              Découvrez nos modules
            </Link>
            .
          </>
        }
        primary={{ href: '/tarification', label: 'Voir la tarification' }}
      />

      <ArticleSection eyebrow="Critère #3" title="4) Bulletins et documents : la crédibilité de l’école">
        <p>
          La confiance passe par les documents : reçus, attestations, bulletins. Ils doivent être rapides à produire,
          cohérents et archivables. Un bulletin ne doit pas “changer” après publication sans historique.
        </p>
        <p>
          Quand le flux est clair, les bulletins sont générés en quelques clics et la direction voit les retards de
          saisie. C’est aussi un moyen de protéger l’équipe : moins de stress, plus de contrôle.
        </p>
        <ArticleCallout tone="warning">“Un reçu immédiat et un bulletin fiable valent plus qu’un logiciel ‘compliqué’.”</ArticleCallout>
      </ArticleSection>

      <ArticleSection eyebrow="Critère #4" title="5) Sécurité & contrôle interne : éviter les fuites">
        <p>
          La sécurité n’est pas optionnelle. Votre établissement doit pouvoir séparer les rôles (caisse, scolarité,
          direction), limiter les annulations et tracer les actions sensibles. C’est ce qui réduit les erreurs et les
          pertes invisibles.
        </p>
        <p>
          Exemple : au Sénégal, une remise accordée sans validation peut devenir une “habitude” qui casse la trésorerie.
          Le contrôle interne protège votre modèle économique.
        </p>
        <ArticleCallout title="Encadré direction">
          <ul className="list-disc pl-5">
            <li>Rôles et droits par module</li>
            <li>Journal des actions sensibles</li>
            <li>Sauvegardes et continuité</li>
          </ul>
        </ArticleCallout>
      </ArticleSection>

      <ArticleInlineCta
        text={
          <>
            Academia Helm gère la sécurité et la traçabilité automatiquement.{' '}
            <Link href="/modules" className="underline">
              Découvrez nos modules
            </Link>
            .
          </>
        }
        primary={{ href: '/contact', label: 'Parler à un expert' }}
      />

      <ArticleSection eyebrow="Déploiement" title="6) Mise en place en moins de 48h : la méthode simple">
        <p>
          Déployez par étapes : finance + dossiers élèves → examens/bulletins → RH. Chaque étape doit produire un bénéfice
          visible, sinon l’équipe revient aux anciens outils.
        </p>
        <p>
          Pour comprendre le périmètre produit, consultez{' '}
          <Link href="/modules" className="font-semibold text-blue-700 hover:underline">
            découvrez nos modules
          </Link>{' '}
          et{' '}
          <Link href="/tarification" className="font-semibold text-blue-700 hover:underline">
            voir la tarification
          </Link>
          . Pour la conformité, voir{' '}
          <Link href="/securite" className="font-semibold text-blue-700 hover:underline">
            sécurité et conformité
          </Link>
          .
        </p>
      </ArticleSection>

      <ArticleDivider />

      <ArticleFaq
        title="FAQ — Logiciel école Afrique"
        items={[
          {
            question: 'Quels modules prioriser pour un premier déploiement ?',
            answer:
              'Finance (frais, encaissements, reçus) et dossiers élèves. Ce sont les flux qui apportent le plus vite un gain opérationnel et un ROI direct. Ensuite, vous déployez examens et bulletins.',
          },
          {
            question: 'Un logiciel peut-il fonctionner avec une connexion instable ?',
            answer:
              'Oui, s’il est léger et tolérant au réseau. L’essentiel est de ne pas bloquer la caisse et les opérations quotidiennes. Demandez une démonstration sur mobile, en conditions réelles.',
          },
          {
            question: 'Comment éviter le retour à Excel après 2 mois ?',
            answer:
              'En obtenant des quick wins : reçus immédiats, relances, états de caisse, bulletins fiables. Formez des référents (caisse, scolarité) et déployez par étapes. Un outil adopté est un outil qui simplifie.',
          },
          {
            question: 'Pourquoi la traçabilité est-elle si importante ?',
            answer:
              'Parce que la preuve réduit les conflits : qui a encaissé, quand, et pour quel élève. Sans trace, vous perdez du temps et de l’argent. La traçabilité protège la direction et l’équipe.',
          },
          {
            question: 'Le logiciel doit-il gérer la sécurité et les rôles ?',
            answer:
              'Oui. Séparer caisse, scolarité et direction évite les erreurs et les abus. Les validations sur remises et annulations protègent votre trésorerie. C’est un critère de choix non négociable.',
          },
          {
            question: 'Combien de temps pour mettre en place ?',
            answer:
              'En commençant par les flux essentiels, une mise en place peut se faire en moins de 48h, puis vous étendez progressivement. Le secret : un plan simple et des gains visibles dès la première semaine.',
          },
        ]}
      />

      <ArticleDivider />

      <ArticleSection eyebrow="Maillage interne" title="Pages complémentaires">
        <p>
          <Link href="/gestion-scolaire" className="font-semibold text-blue-700 hover:underline">
            Gestion scolaire en Afrique
          </Link>{' '}
          ·{' '}
          <Link href="/logiciel-gestion-ecole" className="font-semibold text-blue-700 hover:underline">
            Logiciel de gestion d’école
          </Link>{' '}
          ·{' '}
          <Link href="/gestion-etablissement-scolaire" className="font-semibold text-blue-700 hover:underline">
            Gestion d’établissement scolaire
          </Link>
        </p>
      </ArticleSection>

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

