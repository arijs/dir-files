import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import dirFiles from '../src/index.js';
import type { DirContext, FileEntry, Plugin, ProcessPlugin } from '../src/index.js';
import { collectFiles, makeTree, relPath, removeTree, run } from './helpers.js';

const tree = {
	'a.txt': 'a',
	'b.js': 'b',
	sub: {
		'c.txt': 'c',
		deep: { 'e.txt': 'e' },
	},
	empty: {},
};

let root: string;

beforeAll(() => {
	root = makeTree(tree);
});

afterAll(() => {
	removeTree(root);
});

describe('traversal', () => {
	it('runs the callback with the result when done', async () => {
		const result = { marker: true };
		const { err, result: got } = await run({ result });
		expect(err).toBeUndefined();
		expect(got).toBe(result);
	});

	it('works with no options beyond a callback', async () => {
		const { err, result } = await run({});
		expect(err).toBeUndefined();
		expect(result).toBeUndefined();
	});

	it('does not throw when no callback is given', () => {
		expect(() => dirFiles({})).not.toThrow();
	});

	it('finds every file in the tree', async () => {
		const { err, found } = await collectFiles(root);
		expect(err).toBeUndefined();
		expect(found).toEqual(['a.txt', 'b.js', 'sub/c.txt', 'sub/deep/e.txt']);
	});

	it('accepts several roots', async () => {
		const other = makeTree({ 'z.txt': 'z' });
		try {
			const found: string[] = [];
			const dfp = dirFiles.plugins;
			const { err } = await run({
				path: [root, other],
				plugins: [
					dfp.stat(),
					dfp.queueDir(),
					dfp.readDir(),
					dfp.queueDirFiles(),
					dfp.skip((file: FileEntry) => !file.name || !!file.stat?.isDirectory()),
					(file: FileEntry) => {
						found.push(file.name);
					},
				],
			});
			expect(err).toBeUndefined();
			expect(found.sort()).toEqual(['a.txt', 'b.js', 'c.txt', 'e.txt', 'z.txt']);
		} finally {
			removeTree(other);
		}
	});

	it('exposes root and sub consistently with fullpath', async () => {
		const seen: FileEntry[] = [];
		await collectFiles(root, {
			plugins: [
				(file: FileEntry) => {
					seen.push(file);
				},
			],
		});
		expect(seen.length).toBeGreaterThan(0);
		for (const file of seen) {
			expect(file.fullpath).toBe(path.join(file.dir.root, file.dir.sub, file.name));
		}
	});

	it('tracks lastFile as it advances', async () => {
		const pairs: Array<[string | undefined, string]> = [];
		await collectFiles(root, {
			plugins: [
				function record(this: DirContext, file: FileEntry) {
					pairs.push([this.lastFile?.name, file.name]);
				},
			],
		});
		expect(pairs.length).toBeGreaterThan(1);
		expect(pairs[0][0]).toBeUndefined();
	});
});

describe('plugin chain', () => {
	it('runs plugins in order for each entry', async () => {
		const order: string[] = [];
		await run({
			path: root,
			plugins: [
				function first() {
					order.push('first');
				},
				function second() {
					order.push('second');
				},
			],
		});
		expect(order).toEqual(['first', 'second']);
	});

	it('replaces bare functions with plugin objects in place', async () => {
		const plugins: Plugin[] = [function named() {}];
		const { context } = await run({ path: root, plugins });
		expect(typeof context.plugins[0]).toBe('object');
		expect((context.plugins[0] as { name?: string }).name).toBe('named');
		expect(plugins[0]).toBe(context.plugins[0]);
	});

	it('supports asynchronous plugins', async () => {
		const order: string[] = [];
		await run({
			path: root,
			plugins: [
				function slow(_file, callback) {
					setTimeout(() => {
						order.push('slow');
						callback();
					}, 1);
				},
				function after() {
					order.push('after');
				},
			],
		});
		expect(order).toEqual(['slow', 'after']);
	});

	it('skips a plugin whose filter returns falsy', async () => {
		let ran = 0;
		await run({
			path: root,
			plugins: [
				{
					name: 'never',
					filter: () => false,
					sync: () => {
						ran++;
					},
				},
			],
		});
		expect(ran).toBe(0);
	});

	it('stops the chain for an entry when a plugin returns SKIP', async () => {
		let reached = 0;
		await run({
			path: root,
			plugins: [
				function bail(this: DirContext, _file: FileEntry) {
					return this.SKIP;
				},
				function unreachable() {
					reached++;
				},
			],
		});
		expect(reached).toBe(0);
	});

	it('lets a plugin rewrite the chain mid-traversal', async () => {
		const seen: string[] = [];
		const printFile = function printFile(file: FileEntry) {
			seen.push(relPath(file));
		};
		const dfp = dirFiles.plugins;
		const stat = dfp.stat();
		const queueDir = dfp.queueDir();
		const readDir = dfp.readDir();
		const queueDirFiles = dfp.queueDirFiles();
		const branch = function branch(this: DirContext, file: FileEntry) {
			if (file.stat?.isDirectory()) {
				if (file.name) this.plugins.push(queueDir);
				else this.plugins.push(readDir, queueDirFiles);
			} else if (file.stat?.isFile()) {
				this.plugins.push(printFile);
			}
		};
		const initial: Plugin[] = [stat, branch];
		const { err } = await run({
			path: root,
			processPlugins: [
				{
					beforeFile(this: DirContext) {
						this.plugins = initial.slice();
					},
				},
			],
		});
		expect(err).toBeUndefined();
		expect(seen.sort()).toEqual(['a.txt', 'b.js', 'sub/c.txt', 'sub/deep/e.txt']);
	});

	it('reports a plugin object with no body as an error', async () => {
		const { err } = await run({
			path: root,
			plugins: [{ name: 'broken' }],
		});
		expect(err).toBeInstanceOf(TypeError);
		expect(String(err)).toContain('broken');
	});
});

describe('error handling', () => {
	it('aborts and reports the error when there is no onError', async () => {
		const boom = new Error('boom');
		let reached = 0;
		const { err } = await run({
			path: root,
			plugins: [
				function fail() {
					return boom;
				},
				function unreachable() {
					reached++;
				},
			],
		});
		expect(err).toBe(boom);
		expect(reached).toBe(0);
	});

	it('continues past errors when onError is given', async () => {
		const errors: unknown[] = [];
		const { err, found } = await collectFiles(root, {
			plugins: [
				function failOnJs(file: FileEntry) {
					return file.name.endsWith('.js') ? new Error('nope') : undefined;
				},
			],
			onError(e) {
				errors.push(e);
			},
		});
		expect(err).toBeUndefined();
		expect(errors).toHaveLength(1);
		expect(found).toEqual(['a.txt', 'sub/c.txt', 'sub/deep/e.txt']);
	});

	it('passes the failing entry to onError', async () => {
		const seen: Array<string | undefined> = [];
		await run({
			path: root,
			plugins: [
				function fail() {
					return new Error('x');
				},
			],
			onError(_e, file) {
				seen.push(file?.fullpath);
			},
		});
		expect(seen).toEqual([root]);
	});

	it('surfaces errors from asynchronous plugins', async () => {
		const boom = new Error('async boom');
		const { err } = await run({
			path: root,
			plugins: [
				function fail(_file, callback) {
					setTimeout(() => callback(boom), 1);
				},
			],
		});
		expect(err).toBe(boom);
	});

	it('reports a missing path through the stat plugin', async () => {
		const { err } = await run({
			path: path.join(root, 'does-not-exist'),
			plugins: [dirFiles.plugins.stat()],
		});
		expect((err as NodeJS.ErrnoException).code).toBe('ENOENT');
	});
});

describe('process plugins', () => {
	it('fires every hook in the documented order', async () => {
		const order: string[] = [];
		const record: ProcessPlugin = {
			initialize: () => order.push('initialize'),
			beforeFile: () => order.push('beforeFile'),
			filterPlugin: () => order.push('filterPlugin'),
			beforePlugin: () => order.push('beforePlugin'),
			afterPlugin: () => order.push('afterPlugin'),
			afterFile: () => order.push('afterFile'),
			finalize: () => order.push('finalize'),
		};
		await run({
			path: root,
			processPlugins: [record],
			plugins: [{ name: 'noop', filter: () => true, sync: () => undefined }],
		});
		expect(order).toEqual([
			'initialize',
			'beforeFile',
			'filterPlugin',
			'beforePlugin',
			'afterPlugin',
			'afterFile',
			'finalize',
		]);
	});

	it('reports skip to afterPlugin and afterFile', async () => {
		const flags: Array<[unknown, unknown]> = [];
		await run({
			path: root,
			processPlugins: [
				{
					afterPlugin(err, skip) {
						flags.push([err, skip]);
					},
				},
			],
			plugins: [
				function bail(this: DirContext) {
					return this.SKIP;
				},
			],
		});
		expect(flags).toEqual([[undefined, true]]);
	});

	it('runs several process plugins and tolerates gaps', async () => {
		const hits: string[] = [];
		await run({
			path: root,
			processPlugins: [
				{ initialize: () => hits.push('one') },
				{},
				{ initialize: () => hits.push('two') },
			],
			plugins: [],
		});
		expect(hits).toEqual(['one', 'two']);
	});

	it('hands finalize the error and the result', async () => {
		const boom = new Error('boom');
		const seen: unknown[] = [];
		const result = { r: 1 };
		await run({
			path: root,
			result,
			processPlugins: [
				{
					finalize(err, res) {
						seen.push(err, res);
					},
				},
			],
			plugins: [() => boom],
		});
		expect(seen).toEqual([boom, result]);
	});
});

describe('stack safety', () => {
	it('walks a wide directory without overflowing the stack', async () => {
		const many: Record<string, string> = {};
		for (let i = 0; i < 20000; i++) many[`f${i}.txt`] = '';
		const wide = makeTree(many);
		try {
			let count = 0;
			const dfp = dirFiles.plugins;
			const { err } = await run({
				path: wide,
				plugins: [
					dfp.statSync(),
					dfp.readDirSync(),
					dfp.queueDirFiles(),
					dfp.skip((file: FileEntry) => !file.name),
					() => {
						count++;
					},
				],
			});
			expect(err).toBeUndefined();
			expect(count).toBe(20000);
		} finally {
			removeTree(wide);
		}
	});

	it('walks a deep directory without overflowing the stack', async () => {
		let spec: Record<string, unknown> = { 'leaf.txt': 'x' };
		for (let i = 0; i < 400; i++) spec = { [`d${i}`]: spec };
		const deep = makeTree(spec as never);
		try {
			const { err, found } = await collectFiles(deep);
			expect(err).toBeUndefined();
			expect(found).toHaveLength(1);
		} finally {
			removeTree(deep);
		}
	});
});
