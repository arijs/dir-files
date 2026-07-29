import { builtinModules } from 'node:module';
import { resolve } from 'node:path';

import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

import pkg from './package.json' with { type: 'json' };

const external = new Set([
	...Object.keys(pkg.dependencies ?? {}),
	...builtinModules,
	...builtinModules.map((m) => `node:${m}`),
]);

export default defineConfig({
	build: {
		target: 'node20',
		outDir: 'dist',
		sourcemap: true,
		minify: false,
		lib: {
			entry: resolve(import.meta.dirname, 'src/index.ts'),
			formats: ['es'],
			fileName: () => 'dir-files.js',
		},
		rollupOptions: {
			external: (id) => external.has(id) || id.startsWith('node:'),
			output: { exports: 'named' },
		},
	},
	plugins: [
		dts({
			include: ['src'],
			tsconfigPath: resolve(import.meta.dirname, 'tsconfig.json'),
		}),
	],
});
