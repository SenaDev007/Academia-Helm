/**
 * Seeder pour les pays et policies
 * 
 * Pour cette phase : UNIQUEMENT le Bénin (BJ) avec ses policies
 * 
 * Architecture policy-driven :
 * - Les règles métier sont dans les policies, pas dans le code
 * - Pas de logique conditionnée par country_code
 * - Extension future : ajouter un nouveau pays = créer une nouvelle policy
 */

import { DataSource } from 'typeorm';

export async function seedCountriesAndPolicies(dataSource: DataSource) {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // ========================================================================
    // 1. CRÉER LE PAYS BÉNIN (BJ)
    // ========================================================================
    console.log('🌍 Creating country: Bénin (BJ)...');

    const beninResult = await queryRunner.query(`
      INSERT INTO countries (
        id, code, code3, numeric_code, name,
        currency_code, currency_symbol, phone_prefix, flag_emoji,
        is_default, is_active, metadata
      ) VALUES (
        uuid_generate_v4(), 'BJ', 'BEN', '204', 'Bénin',
        'XOF', 'CFA', '+229', '🇧🇯',
        TRUE, TRUE, '{"region": "West Africa", "language": "fr"}'
      )
      ON CONFLICT (code) DO UPDATE SET
        is_default = TRUE,
        is_active = TRUE
      RETURNING id, code
    `);

    const beninId = beninResult[0]?.id || (await queryRunner.query(`SELECT id FROM countries WHERE code = 'BJ'`))[0].id;

    console.log(`✅ Country created: Bénin (${beninId})`);

    // ========================================================================
    // 2. CRÉER LES GRADING POLICIES POUR LE BÉNIN
    // ========================================================================
    console.log('📊 Creating grading policies for Bénin...');

    // Policy pour le Primaire (Primary)
    const primaryGradingPolicy = {
      name: 'Système de notation béninois - Primaire',
      educationLevel: 'primary',
      maxScore: 20,
      passingScore: 10,
      gradeScales: [
        { min: 18, max: 20, mention: 'Excellent', emoji: '🌟', observation: 'Travail exceptionnel, continue ainsi !', recommendation: 'Maintiens ce niveau d\'excellence.' },
        { min: 16, max: 17.99, mention: 'Très Bien', emoji: '😊', observation: 'Très bon travail, résultats satisfaisants.', recommendation: 'Persévère pour atteindre l\'excellence.' },
        { min: 14, max: 15.99, mention: 'Bien', emoji: '👍', observation: 'Bon travail, efforts appréciables.', recommendation: 'Continue tes efforts pour progresser.' },
        { min: 12, max: 13.99, mention: 'Assez Bien', emoji: '😐', observation: 'Travail correct mais peut mieux faire.', recommendation: 'Redouble d\'efforts dans tes révisions.' },
        { min: 10, max: 11.99, mention: 'Passable', emoji: '⚠️', observation: 'Résultats justes, des lacunes à combler.', recommendation: 'Travaille davantage et demande de l\'aide.' },
        { min: 8, max: 9.99, mention: 'Insuffisant', emoji: '❌', observation: 'Résultats faibles, difficultés observées.', recommendation: 'Besoin de soutien et de travail personnel.' },
        { min: 0, max: 7.99, mention: 'Très Insuffisant', emoji: '🚫', observation: 'Grandes difficultés, besoins d\'accompagnement.', recommendation: 'Suivi individualisé nécessaire, soutien parental requis.' }
      ],
      calculationRules: {
        useCoefficients: true,
        roundingMethod: 'round',
        decimalPlaces: 2
      },
      reportCardConfig: {
        template: 'benin_primary',
        includeRanking: true,
        includeClassAverage: true,
        includeComments: true
      },
      isActive: true,
      isDefault: true
    };

    await queryRunner.query(`
      INSERT INTO grading_policies (
        id, country_id, name, education_level, max_score, passing_score,
        grade_scales, calculation_rules, report_card_config,
        is_active, is_default, metadata
      ) VALUES (
        uuid_generate_v4(), $1, $2, $3, $4, $5,
        $6::jsonb, $7::jsonb, $8::jsonb,
        $9, $10, '{}'::jsonb
      )
      ON CONFLICT (country_id, education_level, is_default) 
      WHERE is_default = TRUE
      DO UPDATE SET
        name = EXCLUDED.name,
        max_score = EXCLUDED.max_score,
        passing_score = EXCLUDED.passing_score,
        grade_scales = EXCLUDED.grade_scales,
        calculation_rules = EXCLUDED.calculation_rules,
        report_card_config = EXCLUDED.report_card_config,
        is_active = EXCLUDED.is_active
    `, [
      beninId,
      primaryGradingPolicy.name,
      primaryGradingPolicy.educationLevel,
      primaryGradingPolicy.maxScore,
      primaryGradingPolicy.passingScore,
      JSON.stringify(primaryGradingPolicy.gradeScales),
      JSON.stringify(primaryGradingPolicy.calculationRules),
      JSON.stringify(primaryGradingPolicy.reportCardConfig),
      primaryGradingPolicy.isActive,
      primaryGradingPolicy.isDefault
    ]);

    // Policy pour le Secondaire (Secondary)
    const secondaryGradingPolicy = {
      name: 'Système de notation béninois - Secondaire',
      educationLevel: 'secondary',
      maxScore: 20,
      passingScore: 10,
      gradeScales: [
        { min: 18, max: 20, mention: 'Excellent' },
        { min: 16, max: 17.99, mention: 'Très Bien' },
        { min: 14, max: 15.99, mention: 'Bien' },
        { min: 12, max: 13.99, mention: 'Assez Bien' },
        { min: 10, max: 11.99, mention: 'Passable' },
        { min: 8, max: 9.99, mention: 'Insuffisant' },
        { min: 0, max: 7.99, mention: 'Très Insuffisant' }
      ],
      calculationRules: {
        useCoefficients: true,
        roundingMethod: 'round',
        decimalPlaces: 2
      },
      reportCardConfig: {
        template: 'benin_secondary',
        includeRanking: true,
        includeClassAverage: true,
        includeComments: true
      },
      isActive: true,
      isDefault: true
    };

    await queryRunner.query(`
      INSERT INTO grading_policies (
        id, country_id, name, education_level, max_score, passing_score,
        grade_scales, calculation_rules, report_card_config,
        is_active, is_default, metadata
      ) VALUES (
        uuid_generate_v4(), $1, $2, $3, $4, $5,
        $6::jsonb, $7::jsonb, $8::jsonb,
        $9, $10, '{}'::jsonb
      )
      ON CONFLICT (country_id, education_level, is_default) 
      WHERE is_default = TRUE
      DO UPDATE SET
        name = EXCLUDED.name,
        max_score = EXCLUDED.max_score,
        passing_score = EXCLUDED.passing_score,
        grade_scales = EXCLUDED.grade_scales,
        calculation_rules = EXCLUDED.calculation_rules,
        report_card_config = EXCLUDED.report_card_config,
        is_active = EXCLUDED.is_active
    `, [
      beninId,
      secondaryGradingPolicy.name,
      secondaryGradingPolicy.educationLevel,
      secondaryGradingPolicy.maxScore,
      secondaryGradingPolicy.passingScore,
      JSON.stringify(secondaryGradingPolicy.gradeScales),
      JSON.stringify(secondaryGradingPolicy.calculationRules),
      JSON.stringify(secondaryGradingPolicy.reportCardConfig),
      secondaryGradingPolicy.isActive,
      secondaryGradingPolicy.isDefault
    ]);

    console.log('✅ Grading policies created for Bénin');

    // ========================================================================
    // 3. CRÉER LA SALARY POLICY POUR LE BÉNIN
    // ========================================================================
    console.log('💰 Creating salary policy for Bénin...');

    const beninSalaryPolicy = {
      name: 'Politique salariale béninoise',
      salaryStructure: {
        baseSalary: {
          min: 50000,
          max: 500000,
          currency: 'XOF'
        },
        scales: [
          { category: 'Enseignant', min: 50000, max: 200000, steps: 10 },
          { category: 'Directeur', min: 150000, max: 500000, steps: 8 },
          { category: 'Personnel administratif', min: 40000, max: 150000, steps: 7 }
        ]
      },
      socialContributions: {
        employeeRate: 0.04, // 4%
        employerRate: 0.08, // 8%
        contributions: [
          {
            name: 'CNSS (Caisse Nationale de Sécurité Sociale)',
            employeeRate: 0.03,
            employerRate: 0.06,
            description: 'Cotisation sécurité sociale béninoise'
          },
          {
            name: 'Assurance maladie',
            employeeRate: 0.01,
            employerRate: 0.02,
            description: 'Assurance maladie obligatoire'
          }
        ]
      },
      leaveRules: {
        annualLeave: {
          daysPerYear: 30,
          accrualRate: 2.5, // 2.5 jours par mois
          maxAccumulation: 60
        },
        sickLeave: {
          daysPerYear: 15,
          requiresMedicalCertificate: true
        },
        maternityLeave: {
          days: 98, // 14 semaines selon la législation béninoise
          paidPercentage: 100
        },
        paternityLeave: {
          days: 3,
          paidPercentage: 100
        }
      },
      bonuses: {
        types: [
          {
            name: 'Prime de fin d\'année',
            calculationMethod: 'percentage',
            value: 10, // 10% du salaire de base
            conditions: ['Travail complet de l\'année']
          },
          {
            name: 'Prime de performance',
            calculationMethod: 'custom',
            value: 0,
            conditions: ['Évaluation positive']
          }
        ]
      },
      taxRules: {
        taxBrackets: [
          { min: 0, max: 300000, rate: 0 },
          { min: 300000, max: 1000000, rate: 0.15 },
          { min: 1000000, max: 3000000, rate: 0.25 },
          { min: 3000000, max: null, rate: 0.35 }
        ],
        exemptions: [
          {
            type: 'Abattement forfaitaire',
            amount: 300000,
            description: 'Abattement fiscal de base'
          }
        ]
      },
      isActive: true,
      isDefault: true
    };

    await queryRunner.query(`
      INSERT INTO salary_policies (
        id, country_id, name,
        salary_structure, social_contributions, leave_rules, bonuses, tax_rules,
        is_active, is_default, metadata
      ) VALUES (
        uuid_generate_v4(), $1, $2,
        $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb,
        $8, $9, '{}'::jsonb
      )
      ON CONFLICT (country_id, is_default) 
      WHERE is_default = TRUE
      DO UPDATE SET
        name = EXCLUDED.name,
        salary_structure = EXCLUDED.salary_structure,
        social_contributions = EXCLUDED.social_contributions,
        leave_rules = EXCLUDED.leave_rules,
        bonuses = EXCLUDED.bonuses,
        tax_rules = EXCLUDED.tax_rules,
        is_active = EXCLUDED.is_active
    `, [
      beninId,
      beninSalaryPolicy.name,
      JSON.stringify(beninSalaryPolicy.salaryStructure),
      JSON.stringify(beninSalaryPolicy.socialContributions),
      JSON.stringify(beninSalaryPolicy.leaveRules),
      JSON.stringify(beninSalaryPolicy.bonuses),
      JSON.stringify(beninSalaryPolicy.taxRules),
      beninSalaryPolicy.isActive,
      beninSalaryPolicy.isDefault
    ]);

    console.log('✅ Salary policy created for Bénin');

    await queryRunner.commitTransaction();
    console.log('✅ Countries and policies seeded successfully!');

  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('❌ Error seeding countries and policies:', error);
    throw error;
  } finally {
    await queryRunner.release();
  }
}

