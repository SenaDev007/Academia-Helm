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

const article = getArticleBySlug('gestion-scolaire');

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
      <Breadcrumbs
        items={[
          { label: 'Accueil', href: '/' },
          { label: 'Gestion scolaire en Afrique' },
        ]}
      />

      <ArticleDivider />

      <ArticleSection eyebrow="Introduction" title="1) Passer du “réactif” au pilotage">
        <p>
          La gestion scolaire n’est pas un empilement de tâches. C’est un système : des process simples, des données
          fiables et des décisions traçables. Sans ça, vous passez vos journées à “éteindre des feux”.
        </p>
        <p>
          Dans la région (Afrique de l’Ouest francophone), le point dur revient souvent : recouvrement, bulletins,
          discipline/absences, et communication parents. Ce guide vous donne un plan clair pour structurer ces flux.
        </p>
        <ArticleCallout>
          Objectif : obtenir des quick wins visibles (reçus, relances, bulletins) pour que l’équipe adopte le système au
          quotidien.
        </ArticleCallout>
      </ArticleSection>

      <ArticleSection eyebrow="Finance" title="2) Recouvrement des frais : sécuriser la trésorerie">
        <p>
          Le recouvrement est le moteur de votre stabilité. Quand il repose sur un cahier ou un fichier Excel, l’impayé
          devient invisible. Et quand il est invisible, il explose en fin de trimestre.
        </p>
        <p>
          Le bon pilotage : échéances claires, reçus instantanés, relances, et un reporting par classe. Avec Mobile
          Money, la traçabilité (paiement ↔ reçu ↔ solde) doit être irréprochable.
        </p>
        <ArticleKpiGrid>
          <ArticleKpiCard label="Impact typique" value="+12%" description="de taux de recouvrement avec suivi hebdomadaire." />
          <ArticleKpiCard
            label="Preuve & confiance"
            value="Reçus"
            description="Reçus numérotés, clôture quotidienne, historique des annulations."
          />
        </ArticleKpiGrid>
      </ArticleSection>

      <ArticleInlineCta
        text={
          <>
            Academia Helm gère le recouvrement automatiquement.{' '}
            <Link href="/modules" className="underline">
              Découvrez nos modules
            </Link>
            .
          </>
        }
        primary={{ href: '/signup', label: 'Tester gratuitement' }}
      />

      <ArticleSection eyebrow="Bulletins" title="3) Examens & bulletins : produire sans stress">
        <p>
          Les bulletins en retard abîment la relation parents. Le vrai problème est le flux : saisie tardive, validation
          floue, corrections sans trace. Un process clair fait gagner du temps et protège l’établissement.
        </p>
        <p>
          Une fois centralisé, vous passez de “travail de fin de trimestre” à “pilotage continu”. Les bulletins sont
          générés en quelques clics, et la direction voit ce qui bloque.
        </p>
        <ArticleCallout tone="warning">
          “La qualité perçue d’une école se joue sur la régularité : reçus, notes, bulletins, réponses.”
        </ArticleCallout>
      </ArticleSection>

      <ArticleSection eyebrow="Absentéisme" title="4) Absentéisme & discipline : agir tôt">
        <p>
          Quand l’absence est notée sur papier, elle n’existe pas pour le pilotage. Vous découvrez les dérives trop tard,
          et vous subissez les conflits. Un suivi simple (retards, absences, incidents) rend les décisions justes.
        </p>
        <p>
          Avec une donnée fiable, vous déclenchez des actions : rappel, rencontre parent, mesure éducative. Des écoles
          observent jusqu’à <span className="font-semibold text-slate-900">-8% d’absentéisme</span> quand le suivi est
          structuré.
        </p>
        <ArticleCallout title="Exemple terrain">
          Au Sénégal ou en Côte d’Ivoire, une classe instable pénalise tout le niveau. Un tableau de bord par classe
          permet de cibler les actions sans “punir tout le monde”.
        </ArticleCallout>
      </ArticleSection>

      <ArticleInlineCta
        text={
          <>
            Academia Helm gère le suivi élèves automatiquement.{' '}
            <Link href="/modules" className="underline">
              Découvrez nos modules
            </Link>
            .
          </>
        }
        primary={{ href: '/contact', label: 'Parler à un expert' }}
      />

      <ArticleSection eyebrow="Organisation" title="5) Process & contrôle interne : éviter les fuites">
        <p>
          Le contrôle interne protège votre école : validations sur remises, historique des actions sensibles, clôture de
          caisse, et règles de correction. Même sans intention, l’erreur coûte cher quand l’école grandit.
        </p>
        <p>
          L’idée n’est pas d’ajouter des étapes. C’est de rendre les décisions traçables, et d’éviter que tout repose sur
          une seule personne.
        </p>
        <ArticleCallout title="Encadré direction">
          <ul className="list-disc pl-5">
            <li>Séparer encaissement et validation</li>
            <li>Clôture quotidienne</li>
            <li>Journal des actions (annulation, remise, correction)</li>
          </ul>
        </ArticleCallout>
      </ArticleSection>

      <ArticleSection eyebrow="Déploiement" title="6) Déployer sans bloquer l’école (en moins de 48h)">
        <p>
          Déployez par étapes : finance → dossiers élèves → examens/bulletins → RH. Chaque étape doit générer un gain
          visible (reçu immédiat, relance, bulletin fiable). C’est ainsi que l’adoption devient naturelle.
        </p>
        <p>
          Pour le périmètre fonctionnel, consultez{' '}
          <Link href="/modules" className="font-semibold text-blue-700 hover:underline">
            découvrez nos modules
          </Link>{' '}
          et{' '}
          <Link href="/tarification" className="font-semibold text-blue-700 hover:underline">
            voir la tarification
          </Link>
          . Pour aller plus loin,{' '}
          <Link href="/orion" className="font-semibold text-blue-700 hover:underline">
            ORION, notre IA de direction
          </Link>{' '}
          vous aide à décider plus vite.
        </p>
      </ArticleSection>

      <ArticleDivider />

      <ArticleFaq
        title="FAQ — Gestion scolaire en Afrique"
        items={[
          {
            question: 'Par quoi commencer pour améliorer la gestion scolaire ?',
            answer:
              'Commencez par la finance et les dossiers élèves : c’est le socle qui simplifie tout le reste. Une fois les reçus, les soldes et les listes fiables, vous gagnez du temps au guichet et vous réduisez les tensions. Ensuite, vous industrialisez notes et bulletins.',
          },
          {
            question: 'Comment réduire les impayés dans une école ?',
            answer:
              'Avec des échéances claires, des relances structurées et une traçabilité complète (paiement ↔ reçu ↔ solde). Les parents paient plus facilement quand l’information est simple et transparente. Suivez le taux de recouvrement chaque semaine, pas seulement en fin de trimestre.',
          },
          {
            question: 'Quel rôle joue Mobile Money dans la gestion scolaire ?',
            answer:
              'Mobile Money accélère les paiements, mais il exige une preuve claire. Sans rapprochement automatique, vous créez des contestations et du travail manuel. Un bon système relie chaque transaction à l’élève, à la classe et au reçu.',
          },
          {
            question: 'Pourquoi les bulletins sortent-ils en retard ?',
            answer:
              'Le flux n’est pas verrouillé : saisies tardives, validations floues, corrections sans historique. Quand le process est clair, les bulletins sont générés en quelques clics. La direction voit immédiatement ce qui bloque et peut agir.',
          },
          {
            question: 'La digitalisation fonctionne-t-elle avec une connexion instable ?',
            answer:
              'Oui, si l’outil est pensé pour la réalité terrain : performance mobile, tolérance réseau et sauvegardes. L’essentiel est de ne pas bloquer la caisse et les opérations quotidiennes. C’est un critère de choix important en Afrique de l’Ouest.',
          },
          {
            question: 'Combien de temps pour mettre en place un logiciel ?',
            answer:
              'En commençant par les flux essentiels (finance + dossiers), une mise en place peut se faire en moins de 48h, puis vous étendez progressivement. Le secret : obtenir vite des bénéfices visibles pour sécuriser l’adoption de l’équipe.',
          },
        ]}
      />

      <ArticleDivider />

      <ArticleSection eyebrow="Maillage interne" title="Pages complémentaires">
        <p>
          <Link href="/logiciel-gestion-ecole" className="font-semibold text-blue-700 hover:underline">
            Logiciel de gestion d’école
          </Link>{' '}
          ·{' '}
          <Link href="/gestion-etablissement-scolaire" className="font-semibold text-blue-700 hover:underline">
            Gestion d’établissement scolaire
          </Link>{' '}
          ·{' '}
          <Link href="/logiciel-ecole-afrique" className="font-semibold text-blue-700 hover:underline">
            Logiciel école Afrique
          </Link>
        </p>
      </ArticleSection>

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
    </ArticleLayout>
  );
}

