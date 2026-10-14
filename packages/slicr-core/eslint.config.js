import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Query'][callee.property.name='all']",
          message: 'Do not use Query.all() in production code. Use Query.where(...) or Query.anyOf(...).',
        },
      ],
      '@typescript-eslint/no-unused-vars': ['error', {ignoreRestSiblings: true}],
    },
  },
);
