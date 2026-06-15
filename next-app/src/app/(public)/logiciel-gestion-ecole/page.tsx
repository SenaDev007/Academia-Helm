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

const article = getArticleBySlug('logiciel-gestion-ecole');

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
      <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Logiciel de gestion d’école' }]} />

      <ArticleDivider />

      <ArticleSection eyebrow="Introduction" title="1) Ce que vous achetez vraiment : un pilotage">
        <p>
          Un logiciel de gestion d’école n’a de valeur que s’il sécurise votre recette, accélère les opérations et
          fiabilise les documents. Il doit transformer des activités “au feeling” en process clairs et mesurables.
        </p>
        <p>
          Dans la pratique, les gains viennent vite : reçu immédiat, relances structurées, bulletins générés en quelques
          clics, et visibilité direction. C’est ce qui permet de viser{' '}
          <span className="font-semibold text-slate-900">+12% de taux de recouvrement</span> et{' '}
          <span className="font-semibold text-slate-900">-8% d’absentéisme</span>.
        </p>
        <ArticleCallout>Plan : fonctionnalités essentielles → critères de choix → tarification/ROI → déploiement en 48h → FAQ.</ArticleCallout>
      </ArticleSection>

      <ArticleSection eyebrow="Fonctionnalité clé" title="2) Scolarité : dossiers élèves et référentiel fiable">
        <p>
          Sans référentiel élève propre, tout le reste se casse : facturation, examens, attestations. Vous avez besoin
          d’une vue 360° : identité, tuteurs, classe, documents, historique, statut de paiement, présence et résultats.
        </p>
        <p>
          Exemple terrain : au Togo ou au Bénin, un dossier incomplet crée des “exceptions” à chaque étape, et l’équipe
          perd du temps sur des recherches plutôt que sur l’accueil.
        </p>
        <ArticleCallout title="Encadré check-list">
          <ul className="list-disc pl-5">
            <li>Inscription/réinscription standardisée</li>
            <li>Documents et historique centralisés</li>
            <li>Listes de classe fiables en 1 clic</li>
          </ul>
        </ArticleCallout>
      </ArticleSection>

      <ArticleSection eyebrow="Fonctionnalité clé" title="3) Finance : recouvrement, Mobile Money et preuves">
        <p>
          La finance “finance” la digitalisation. Si le recouvrement progresse, l’outil se rentabilise. Votre logiciel
          doit gérer : frais, échéances, encaissements multi-modes, reçus, annulations contrôlées et états de caisse.
        </p>
        <p>
          En Côte d’Ivoire ou au Sénégal, Mobile Money accélère les paiements — mais sans traçabilité (paiement ↔ reçu ↔
          solde), vous créez des contestations et du travail manuel.
        </p>
        <ArticleKpiGrid>
          <ArticleKpiCard label="Impact typique" value="+12%" description="de taux de recouvrement avec suivi hebdomadaire." />
          <ArticleKpiCard
            label="Preuves"
            value="Reçus"
            description="Reçus numérotés, clôture quotidienne, journal des annulations."
          />
        </ArticleKpiGrid>
      </ArticleSection>

      <ArticleInlineCta
        text={
          <>
            Academia Helm gère finance et reçus automatiquement.{' '}
            <Link href="/modules" className="underline">
              Découvrez nos modules
            </Link>
            .
          </>
        }
        primary={{ href: '/tarification', label: 'Voir la tarification' }}
      />

      <ArticleSection eyebrow="Fonctionnalité clé" title="4) Examens & bulletins : la confiance se joue ici">
        <p>
          Les parents jugent la qualité de l’école sur les bulletins. Une erreur de note détruit la confiance. Votre
          système doit imposer un flux clair : saisie, validation, verrouillage et corrections traçables.
        </p>
        <p>
          Avec une organisation simple, les bulletins sont générés en quelques clics et la direction voit les retards de
          saisie immédiatement.
        </p>
        <ArticleCallout tone="warning">
          “Bulletins à l’heure = moins de conflits, plus de confiance, moins de stress.”
        </ArticleCallout>
      </ArticleSection>

      <ArticleSection eyebrow="Critère de choix" title="5) Adoption, sécurité, résilience : ce que Google ne dit pas">
        <p>
          Deux écoles peuvent acheter le même outil et obtenir des résultats opposés. Le facteur décisif : l’adoption.
          Si c’est compliqué, l’équipe contourne et recrée du papier/Excel.
        </p>
        <p>
          Vérifiez aussi la sécurité : rôles, permissions, journal des actions, sauvegardes, continuité. Et pour
          l’Afrique, la performance mobile et la tolérance réseau sont non négociables.
        </p>
        <ArticleCallout title="Encadré “test avant achat”">
          <ul className="list-disc pl-5">
            <li>Encaisser et imprimer/partager un reçu</li>
            <li>Rechercher un élève et éditer son dossier</li>
            <li>Générer un bulletin complet</li>
          </ul>
        </ArticleCallout>
        <p>
          Pour aller plus loin, consultez{' '}
          <Link href="/securite" className="font-semibold text-blue-700 hover:underline">
            sécurité et conformité
          </Link>{' '}
          et{' '}
          <Link href="/orion" className="font-semibold text-blue-700 hover:underline">
            ORION, notre IA de direction
          </Link>
          .
        </p>
      </ArticleSection>

      <ArticleInlineCta
        text={
          <>
            Academia Helm gère le pilotage automatiquement.{' '}
            <Link href="/modules" className="underline">
              Découvrez nos modules
            </Link>
            .
          </>
        }
        primary={{ href: '/contact', label: 'Parler à un expert' }}
      />

      <ArticleSection eyebrow="Déploiement" title="6) Déployer sans bloquer l’école : méthode en 48h">
        <p>
          Déployez par flux : finance → dossiers élèves → examens/bulletins → RH. Chaque étape doit produire un bénéfice
          visible dès la première semaine : reçu immédiat, relance, bulletin fiable.
        </p>
        <p>
          Pour une approche claire et transparente, consultez{' '}
          <Link href="/tarification" className="font-semibold text-blue-700 hover:underline">
            voir la tarification
          </Link>{' '}
          et{' '}
          <Link href="/modules" className="font-semibold text-blue-700 hover:underline">
            découvrez nos modules
          </Link>
          .
        </p>
      </ArticleSection>

      <ArticleDivider />

      <ArticleFaq
        title="FAQ — Logiciel de gestion d’école"
        items={[
          {
            question: 'Quel logiciel choisir pour une école primaire en Afrique ?',
            answer:
              'Choisissez un outil simple, rapide sur mobile, adapté aux paiements locaux, et capable de produire des documents fiables. L’objectif est l’adoption, pas la complexité. Ensuite, vous activez les modules avancés.',
          },
          {
            question: 'Un logiciel peut-il réduire les impayés ?',
            answer:
              'Oui, si la facturation est structurée, les reçus sont immédiats et les relances sont systématiques. La transparence (soldes, historique, échéances) réduit les contestations et accélère le recouvrement.',
          },
          {
            question: 'Comment éviter l’échec d’un projet de digitalisation ?',
            answer:
              'Déployer par étapes, former des référents, viser des quick wins, et garder les écrans simples. Le logiciel doit soutenir votre organisation, pas la complexifier. La direction doit piloter le changement.',
          },
          {
            question: 'Quels rapports doivent être disponibles chaque jour ?',
            answer:
              'État de caisse, encaissements, annulations, et situation des impayés. Ces éléments donnent une visibilité immédiate à la direction et protègent l’établissement contre les “fuites” invisibles.',
          },
          {
            question: 'Pourquoi la sécurité et les rôles sont-ils indispensables ?',
            answer:
              'Parce qu’ils protègent l’école : séparation caisse/scolarité/direction, validations sur remises et annulations, historique des actions. Sans contrôle interne, les erreurs et abus deviennent possibles.',
          },
          {
            question: 'Combien de temps pour une mise en place ?',
            answer:
              'En commençant par les flux essentiels, une mise en place peut se faire en moins de 48h, puis vous étendez progressivement. Le secret : des bénéfices visibles dès la première semaine.',
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
          <Link href="/logiciel-ecole-afrique" className="font-semibold text-blue-700 hover:underline">
            Logiciel école Afrique
          </Link>{' '}
          ·{' '}
          <Link href="/gestion-etablissement-scolaire" className="font-semibold text-blue-700 hover:underline">
            Gestion d’établissement scolaire
          </Link>
        </p>
      </ArticleSection>

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
    </ArticleLayout>
  );
}

