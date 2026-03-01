import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import tseslint from 'typescript-eslint';
import tanstackQuery from '@tanstack/eslint-plugin-query';

const config = [
    ...nextCoreWebVitals,
    ...tseslint.configs.recommended,
    ...tanstackQuery.configs['flat/recommended'],
    {
        rules: {
            // New react-hooks v7 rules disabled as too strict for this codebase's existing patterns.
            // `set-state-in-effect` flags a very common legitimate pattern (reading external state
            // into local state on mount / dependency change). `incompatible-library` produces false
            // positives against @tanstack/react-table and similar libraries.
            'react-hooks/set-state-in-effect': 'off',
            'react-hooks/incompatible-library': 'off',
            // `preserve-manual-memoization` is only relevant when the React Compiler is enabled.
            'react-hooks/preserve-manual-memoization': 'off',
            // `immutability` produces false positives for recursive useCallback patterns and
            // intentional module-level regex lastIndex resets.
            'react-hooks/immutability': 'off',

            'react-hooks/exhaustive-deps': 'warn',
            'no-unused-vars': 'off',
            'no-extra-semi': 'off',
        },
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
        rules: {
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
        },
    },
    {
        // Replaces .eslintignore
        ignores: [
            'src/components/**',
            'next-env.d.ts',
            'src/proto/**',
        ],
    },
];

export default config;
