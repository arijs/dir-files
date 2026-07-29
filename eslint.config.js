import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
	},
	js.configs.recommended,
	...tseslint.configs.recommendedTypeChecked,
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
			],
			'@typescript-eslint/consistent-type-imports': 'error',
			'no-console': 'off',
			eqeqeq: ['error', 'always'],
			'prefer-const': 'error',
		},
	},
	{
		// Plain JS: config and runnable examples are not part of the TS program.
		files: ['**/*.js'],
		extends: [tseslint.configs.disableTypeChecked],
		languageOptions: {
			globals: { console: 'readonly', process: 'readonly' },
		},
	},
	{
		files: ['test/**/*.ts'],
		rules: {
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off',
			'@typescript-eslint/no-empty-function': 'off',
		},
	},
);
