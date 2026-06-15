export type BacklinkTarget = {
  category: 'annuaires-saas' | 'blogs-africains' | 'education' | 'communautes';
  name: string;
  hint: string;
};

export function getBacklinkTargets(): BacklinkTarget[] {
  return [
    {
      category: 'annuaires-saas',
      name: 'Product Hunt',
      hint: 'Lancement produit + collecte avis (en anglais).',
    },
    {
      category: 'annuaires-saas',
      name: 'AlternativeTo',
      hint: 'Fiche produit “software application” + catégories éducation.',
    },
    {
      category: 'education',
      name: 'Portails d’écoles / blogs éducation (Afrique)',
      hint: 'Partenariats contenus : “guide de gestion scolaire” + cas d’usage.',
    },
    {
      category: 'blogs-africains',
      name: 'Médias tech Afrique francophone',
      hint: 'Tribunes : digitalisation des écoles, impacts et chiffres.',
    },
    {
      category: 'communautes',
      name: 'Groupes / communautés de directeurs d’école',
      hint: 'Webinars + ressources gratuites (checklist) qui attirent des liens naturels.',
    },
  ];
}

