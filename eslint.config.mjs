import { defineConfig, globalIgnores } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

const eslintConfig = defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,

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
              '^(assert|buffer|child_process|crypto|dns|events|fs|http|https|module|os|path|process|stream|timers|tty|url|util|zlib)(/|$)',
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

  globalIgnores([
    'node_modules/**',
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
