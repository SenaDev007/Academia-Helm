module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    // ⭐ TÂCHE 181 (CDC section 9.4) — règle de lint : le test ÉCHOUE si un
    // fichier importe Resend ou Nodemailer en dehors du dossier du service
    // central (src/school-email) et du chemin plateforme historique du module
    // Communication (e-mails système : Resend / SMTP global d'env).
    'no-restricted-imports': ['error',
      {
        paths: [
          {
            name: 'nodemailer',
            message: "Interdit hors de src/school-email (service central e-mail, tâche 181) et de communication/services/email.service.ts (transport plateforme historique).",
          },
          {
            name: 'resend',
            message: "Interdit hors de src/school-email (service central e-mail, tâche 181) et de communication/services/email.service.ts (transport plateforme historique).",
          },
        ],
      },
    ],
  },
  overrides: [
    {
      // Transporteurs autorisés UNIQUEMENT dans le dossier du service central.
      files: ['src/school-email/**'],
      rules: { 'no-restricted-imports': 'off' },
    },
    {
      // Chemin plateforme historique (e-mails système via Resend) — toléré,
      // documenté dans le tableau d'audit de la tâche 181.
      files: ['src/communication/services/email.service.ts'],
      rules: { 'no-restricted-imports': 'off' },
    },
  ],
};

