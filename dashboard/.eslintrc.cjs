/* eslint-env node */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {node: restrictedImports} = require('@uniswap/eslint-config/restrictedImports');
require('@uniswap/eslint-config/load');

/**
 * @type {import("eslint").Linter.BaseConfig}
 */
module.exports = {
  root: true,
  extends: ['next/core-web-vitals', 'next/typescript', '@uniswap/eslint-config/node'],
  plugins: [],

  overrides: [
    {
      files: ['**/*'],
      rules: {
        'prettier/prettier': ['error', {semi: true}],
        'import/no-unused-modules': 'off',
        'unused-imports/no-unused-imports': 'off',
      },
    },
    {
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        '@typescript-eslint/no-restricted-imports': ['error', restrictedImports],
        'no-restricted-syntax': [
          'error',
          {
            selector: ':matches(ExportAllDeclaration)',
            message: 'Barrel exports bloat the bundle size by preventing tree-shaking.',
          },
        ],
        'no-restricted-imports': ['error'],
        'react/prop-types': 'off',
      },
    },
  ],
};
