import js from '@eslint/js';
import pluginPrettier from 'eslint-plugin-prettier';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginSimpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'prettier.config.cjs',
      'eslint.config.js',
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/build/**',
      '**/coverage/**',
      'src/client/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      prettier: pluginPrettier,
      'react-hooks': pluginReactHooks,
      'simple-import-sort': pluginSimpleImportSort,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'sort-imports': 'off',
      'import/order': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      'react/prop-types': 'off',
      'prettier/prettier': 'error',
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // 1. React and related packages
            ['^react', '^@react'],
            // 2. External packages (e.g., antd, @tanstack)
            ['^@?\\w'],
            // 3. Internal aliases (e.g., @/)
            ['^@/'],
            // 4. Side effect imports (e.g., CSS)
            ['^\\u0000'],
            // 5. Parent imports
            ['^\\.\\.'],
            // 6. Same-folder imports
            ['^\\.'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
