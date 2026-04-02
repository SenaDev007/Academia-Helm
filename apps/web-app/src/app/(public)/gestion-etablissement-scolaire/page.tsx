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

const article = getArticleBySlug('gestion-etablissement-scolaire');

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
      <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Gestion d’établissement scolaire' }]} />

      <ArticleSection eyebrow="Contexte Afrique de l’Ouest" title="1) Le vrai problème : tout repose sur vous">
        <p>
          Dans beaucoup d’établissements, la direction est seule face à tout : inscriptions, encaissements, plaintes
          parents, incidents, examens. Quand l’information est dispersée (cahiers, WhatsApp, Excel), chaque décision
          devient une enquête.
        </p>
        <p>
          Résultat : bulletins en retard, absentéisme mal suivi, et pertes invisibles sur la caisse. Un système de
          gestion doit d’abord rendre l’école “lisible” — pour que vos équipes exécutent et que vous pilotiez.
        </p>
        <ArticleCallout>
          Signal d’alerte : si vous ne pouvez pas répondre en 30 secondes à “qui doit combien par classe ?”, “quels
          bulletins manquent ?” et “qui a validé la remise ?”, votre organisation est fragile.
        </ArticleCallout>
        <ArticleKpiGrid>
          <ArticleKpiCard
            label="Impact typique"
            value="+12%"
            description="de taux de recouvrement quand le suivi des impayés est piloté chaque semaine."
          />
          <ArticleKpiCard
            label="Impact typique"
            value="-8%"
            description="d’absentéisme quand les retards et absences sont suivis et traités."
          />
        </ArticleKpiGrid>
      </ArticleSection>

      <ArticleSection eyebrow="Organisation" title="2) Rôles clairs : qui décide, qui exécute, qui contrôle">
        <p>
          Première règle : séparer au minimum l’encaissement et la validation. Même dans une petite école, c’est la base
          du contrôle interne. Sinon, une annulation de reçu ou une remise “de faveur” passe sans trace.
        </p>
        <p>
          Une bonne organisation n’est pas une bureaucratie : c’est un filet de sécurité. Elle protège votre trésorerie,
          votre réputation et votre équipe.
        </p>
        <ArticleCallout title="Mini-checklist direction">
          <ul className="list-disc pl-5">
            <li>Un responsable “caisse” et un responsable “validation/remises”</li>
            <li>Clôture quotidienne avec état de caisse</li>
            <li>Historique des actions sensibles (annulation, remise, correction de note)</li>
          </ul>
        </ArticleCallout>
        <p>
          Exemple terrain : au Togo ou au Bénin, si le recouvrement passe par Mobile Money, le rapprochement (paiement ↔
          reçu ↔ solde) doit être clair, sinon vous perdez du temps au guichet et vous créez des conflits.
        </p>
      </ArticleSection>

      <ArticleInlineCta
        text={
          <>
            Academia Helm gère le contrôle interne et la traçabilité automatiquement.{' '}
            <Link href="/modules" className="underline">
              Découvrez nos modules
            </Link>
            .
          </>
        }
        primary={{ href: '/signup', label: 'Tester gratuitement' }}
      />

      <ArticleSection eyebrow="Finance & recouvrement" title="3) Recouvrement des frais : votre levier n°1">
        <p>
          Dans une école privée, la trésorerie finance tout : salaires, fournitures, qualité pédagogique. Si le
          recouvrement est “au cahier”, vous découvrez les impayés trop tard — et vous subissez.
        </p>
        <p>
          Le bon pilotage consiste à suivre chaque semaine : impayés par classe, échéances à 7/30 jours, remises
          accordées, et performance par agent d’encaissement.
        </p>
        <ArticleCallout title="À mettre en place tout de suite">
          <ul className="list-disc pl-5">
            <li>Reçus instantanés et numérotés</li>
            <li>Règles de remise (seuils + validation)</li>
            <li>Clôture de caisse quotidienne + états exportables</li>
          </ul>
        </ArticleCallout>
        <p>
          Exemple concret : en Côte d’Ivoire ou au Sénégal, les paiements Mobile Money doivent être rapprochés avec
          l’élève et la classe, sinon le parent revient contester et votre équipe perd des heures.
        </p>
      </ArticleSection>

      <ArticleSection eyebrow="Pédagogie & bulletins" title="4) Bulletins et examens : la confiance se joue ici">
        <p>
          Les bulletins en retard détruisent la confiance. La solution n’est pas “travailler plus”, mais verrouiller le
          flux : qui saisit, quand on valide, quand on publie et comment on corrige sans effacer l’historique.
        </p>
        <p>
          Quand l’information est centralisée, les bulletins sont générés en quelques clics — et la direction voit
          immédiatement les retards de saisie et les anomalies.
        </p>
        <ArticleCallout tone="warning">
          “Quand les bulletins sortent à temps, les parents cessent de douter. Et l’équipe arrête de courir.”
        </ArticleCallout>
        <ArticleCallout>Objectif réaliste : bulletins générés en quelques clics, avec un historique clair des corrections et des validations.</ArticleCallout>
      </ArticleSection>

      <ArticleInlineCta
        text={
          <>
            Academia Helm gère examens et bulletins automatiquement.{' '}
            <Link href="/modules" className="underline">
              Découvrez nos modules
            </Link>
            .
          </>
        }
        primary={{ href: '/tarification', label: 'Voir la tarification' }}
      />

      <ArticleSection eyebrow="RH & discipline" title="5) RH, discipline, absentéisme : garder la maîtrise">
        <p>
          La direction perd du temps quand les incidents et absences ne sont pas structurés. Un registre digital simple
          (absence, retard, sanction, communication) réduit les malentendus et rend les décisions justes.
        </p>
        <p>
          Côté RH, même si la paie est gérée ailleurs, vous devez connaître la présence et les remplacements. Un
          établissement stable se pilote avec des faits.
        </p>
        <ArticleCallout title="Exemple terrain">
          Au Burkina Faso ou au Togo, une absence non signalée d’un enseignant désorganise toute la journée. Un suivi
          clair permet d’anticiper, de remplacer vite, et de réduire l’absentéisme.
        </ArticleCallout>
      </ArticleSection>

      <ArticleSection eyebrow="Déploiement" title="6) Déployer sans casser l’école : la méthode en 48h">
        <p>
          Une digitalisation réussie se fait par flux : finance → dossiers élèves → examens/bulletins → RH → pilotage.
          Chaque étape doit produire un bénéfice visible, sinon l’équipe revient à Excel.
        </p>
        <p>
          Avec une mise en place en moins de 48h, vous sécurisez d’abord la caisse et les dossiers, puis vous étendez
          progressivement. Pour aller plus loin, explorez la{' '}
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

      <ArticleDivider />

      <ArticleFaq
        title="FAQ — Gestion d’établissement scolaire"
        items={[
          {
            question: 'Par où commencer si tout est sur cahiers et Excel ?',
            answer:
              'Commencez par la finance et les dossiers élèves : reçus, échéances, soldes, listes fiables. Ce socle supprime les disputes au guichet et rend les décisions plus simples. Ensuite seulement, industrialisez les notes et les bulletins.',
          },
          {
            question: 'Comment améliorer le recouvrement sans “forcer” les parents ?',
            answer:
              'Avec de la clarté : échéances affichées, reçus instantanés, soldes compréhensibles et relances structurées. En Afrique de l’Ouest, Mobile Money facilite le paiement, mais il faut une traçabilité propre. Un pilotage hebdomadaire fait souvent progresser le taux de recouvrement.',
          },
          {
            question: 'Quels KPI suivre chaque semaine ?',
            answer:
              'Taux de recouvrement, impayés par classe, échéances à 7/30 jours, remises accordées, absentéisme, retards de saisie des notes, et incidents récurrents. L’idée n’est pas de tout mesurer, mais de déclencher des actions rapides quand un indicateur dérive.',
          },
          {
            question: 'Pourquoi les bulletins prennent-ils autant de temps ?',
            answer:
              'Parce que le flux n’est pas verrouillé : saisies tardives, validations floues, corrections sans historique. Quand le process est clair, les bulletins sont générés en quelques clics et la direction voit tout de suite ce qui bloque.',
          },
          {
            question: 'Comment réduire l’absentéisme dans l’établissement ?',
            answer:
              'En détectant tôt : pointage, règles simples, suivi des retards, et alertes direction. Une fois la donnée fiable, vous pouvez agir (rappels, rencontres parents, mesures éducatives) au bon moment. Des écoles constatent jusqu’à -8% d’absentéisme avec un suivi régulier.',
          },
          {
            question: 'Combien de temps pour mettre en place un logiciel ?',
            answer:
              'Si vous commencez par les flux essentiels (finance + dossiers élèves), la mise en place peut se faire en moins de 48h, puis vous déployez le reste par étapes. Le plus important est d’obtenir des “quick wins” visibles, pour que l’équipe adopte l’outil au quotidien.',
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
          <Link href="/logiciel-ecole-afrique" className="font-semibold text-blue-700 hover:underline">
            Logiciel école Afrique
          </Link>
        </p>
      </ArticleSection>

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
    </ArticleLayout>
  );
}

