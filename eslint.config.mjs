import { dirname } from 'path';
import { fileURLToPath } from 'url';

import { FlatCompat } from '@eslint/eslintrc';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
    ],
  },

  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            [
              '^node:',
              `^(assert|buffer|child_process|crypto|dns|events|fs|http|https|module|os|path|process|stream|timers|tty|url|util|zlib)(/|$)`,
            ],

            ['^@?\\w'],

            ['^@/'],

            ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
            ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],

            ['^.+\\.s?css$'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
    },
  },

  {
    rules: {
      'no-console': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',

        {
          args: 'all',

          argsIgnorePattern: '^_',

          caughtErrors: 'all',

          caughtErrorsIgnorePattern: '^_',

          destructuredArrayIgnorePattern: '^_',

          varsIgnorePattern: '^_',

          ignoreRestSiblings: true,
        },
      ],
    },
  },
];

export default eslintConfig;
