const nx = require('@nx/eslint-plugin');
const security = require('eslint-plugin-security');

module.exports = [
  // Apply Nx ESLint plugin recommendations
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],

  // Global ignore patterns
  {
    ignores: [
      '**/dist',
      '**/build',
      '**/coverage',
      '**/node_modules',
      '**/.nx',
      '**/tmp',
      '**/*.spec.ts',
      '**/*.spec.js',
      '**/jest.config.ts',
      '**/jest.config.js',
      '**/vite.config.ts',
      '**/vite.config.mts',
      '**/.angular',
      '**/backend',
    ],
  },

  // Security plugin configuration
  {
    plugins: {
      security,
    },
    rules: {
      // Enable all recommended security rules
      ...security.configs.recommended.rules,

      // Custom security rules - eval and related functions
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',

      // innerHTML and related DOM manipulation
      'security/detect-unsafe-regex': 'error',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-eval-with-expression': 'error',
      'security/detect-pseudoRandomBytes': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-no-csrf-before-method-override': 'warn',
      'security/detect-buffer-noassert': 'warn',
      'security/detect-child-process': 'warn',
      'security/detect-disable-mustache-escape': 'warn',
      'security/detect-new-buffer': 'warn',
      'security/detect-non-literal-require': 'warn',
      'security/detect-object-injection': 'warn',
      'security/detect-bidi-characters': 'error',
    },
  },

  // TypeScript-specific configuration
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // Security-related TypeScript rules
      '@typescript-eslint/no-implied-eval': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'off', // Too strict for most projects
      '@typescript-eslint/no-unsafe-member-access': 'off', // Too strict for most projects
      '@typescript-eslint/no-unsafe-call': 'off', // Too strict for most projects
    },
  },

  // JavaScript-specific configuration
  {
    files: ['**/*.js', '**/*.jsx'],
    rules: {
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },

  // Additional security and best practice rules
  {
    rules: {
      // Prevent dangerous practices
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-debugger': 'error',
      'no-alert': 'warn',
      'no-var': 'error',
      'prefer-const': 'warn',

      // Prevent prototype pollution
      'no-proto': 'error',
      'no-extend-native': 'error',

      // Safe comparisons
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-eq-null': 'off', // Handled by eqeqeq

      // Regular expression safety
      'no-invalid-regexp': 'error',
      'no-regex-spaces': 'warn',

      // Best practices
      'no-return-await': 'warn',
      'require-await': 'warn',
      'no-await-in-loop': 'warn',
    },
  },

  // Nx-specific overrides
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
];
