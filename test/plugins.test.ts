import fs from 'node:fs';
import path from 'node:path';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import dirFiles from '../src/index.js';
import type { DirContext, FileEntry } from '../src/index.js';
import { collectFiles, makeTree, relPath, removeTree, run } from './helpers.js';

const dfp = dirFiles.plugins;

let root: string;

beforeAll(() => {
	root = makeTree({
		'a.txt': 'a',
		'b.js': 'b',
		'.hidden': 'h',
		sub: { 'c.txt': 'c', deep: { 'e.txt': 'e' } },
		empty: {},
	});
});

afterAll(() => {
	removeTree(root);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('stat / statSync', () => {
	it.each([
		['stat', dfp.stat],
		['statSync', dfp.statSync],
	])('%s fills file.stat', async (_label, factory) => {
		let seen: FileEntry | undefined;
		const { err } = await run({
			path: root,
			plugins: [
				factory(),
				(file: FileEntry) => {
					seen = file;
				},
			],
		});
		expect(err).toBeUndefined();
		expect(seen?.stat?.isDirectory()).toBe(true);
	});

	it.each([
		['stat', dfp.stat],
		['statSync', dfp.statSync],
	])('%s skips entries that already have a stat', async (_label, factory) => {
		const sentinel = { isDirectory: () => false, isFile: () => true } as never;
		let seen: unknown;
		await run({
			path: root,
			plugins: [
				(file: FileEntry) => {
					file.stat = sentinel;
				},
				factory(),
				(file: FileEntry) => {
					seen = file.stat;
				},
			],
		});
		expect(seen).toBe(sentinel);
	});

	it.each([
		['stat', dfp.stat],
		['statSync', dfp.statSync],
	])('%s reports ENOENT and leaves stat null', async (_label, factory) => {
		const missing = path.join(root, 'nope');
		let seen: FileEntry | undefined;
		const { err } = await run({
			path: missing,
			plugins: [factory()],
			onError(_e, file) {
				seen = file;
			},
		});
		expect(err).toBeUndefined();
		expect(seen?.stat).toBeNull();
	});

	it.each([
		['stat', dfp.stat],
		['statSync', dfp.statSync],
	])('%s logs when verbose and does not crash on error', async (_label, factory) => {
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		await run({
			path: path.join(root, 'nope'),
			plugins: [factory({ verbose: true })],
			onError() {},
		});
		expect(log).toHaveBeenCalled();
	});
});

describe('readDir / readDirSync', () => {
	it.each([
		['readDir', dfp.readDir],
		['readDirSync', dfp.readDirSync],
	])('%s fills dir.files for an entered directory', async (_label, factory) => {
		let files: string[] | null = null;
		const { err } = await run({
			path: root,
			plugins: [
				dfp.statSync(),
				factory(),
				(file: FileEntry) => {
					files = file.dir.files;
				},
			],
		});
		expect(err).toBeUndefined();
		expect((files ?? []).sort()).toEqual(['.hidden', 'a.txt', 'b.js', 'empty', 'sub']);
	});

	it.each([
		['readDir', dfp.readDir],
		['readDirSync', dfp.readDirSync],
	])('%s does not run without a stat', async (_label, factory) => {
		let files: string[] | null | undefined;
		await run({
			path: root,
			plugins: [
				factory(),
				(file: FileEntry) => {
					files = file.dir.files;
				},
			],
		});
		expect(files).toBeNull();
	});

	it.each([
		['readDir', dfp.readDir],
		['readDirSync', dfp.readDirSync],
	])('%s reports a read failure without crashing on verbose', async (_label, factory) => {
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		const filePath = path.join(root, 'a.txt');
		const errors: unknown[] = [];
		const { err } = await run({
			path: filePath,
			plugins: [
				dfp.statSync(),
				// Pretend the regular file is a directory so readDir is reached
				// and fails with ENOTDIR.
				(file: FileEntry) => {
					file.stat = { ...file.stat, isDirectory: () => true } as never;
				},
				factory({ verbose: true }),
			],
			onError(e) {
				errors.push(e);
			},
		});
		expect(err).toBeUndefined();
		expect((errors[0] as NodeJS.ErrnoException).code).toBe('ENOTDIR');
		expect(log).toHaveBeenCalled();
	});
});

describe('queueDir', () => {
	it('descends into named directories', async () => {
		const { found } = await collectFiles(root);
		expect(found).toContain('sub/deep/e.txt');
	});

	it('honours its own filter option', async () => {
		const found: string[] = [];
		const { err } = await run({
			path: root,
			plugins: [
				dfp.statSync(),
				dfp.queueDir({ filter: (file: FileEntry) => file.name !== 'sub' }),
				dfp.readDirSync(),
				dfp.queueDirFiles(),
				dfp.skip((file: FileEntry) => !file.name || !!file.stat?.isDirectory()),
				(file: FileEntry) => {
					found.push(relPath(file));
				},
			],
		});
		expect(err).toBeUndefined();
		expect(found.sort()).toEqual(['.hidden', 'a.txt', 'b.js']);
	});

	it('logs when verbose', async () => {
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		await run({
			path: root,
			plugins: [dfp.statSync(), dfp.queueDir({ verbose: true }), dfp.readDirSync(), dfp.queueDirFiles()],
		});
		expect(log.mock.calls.some((c) => c[0] === 'queueDir')).toBe(true);
	});
});

describe('queueDirFiles', () => {
	it('queues every name from the listing', async () => {
		const names: string[] = [];
		await run({
			path: root,
			plugins: [
				dfp.statSync(),
				dfp.readDirSync(),
				dfp.queueDirFiles(),
				(file: FileEntry) => {
					if (file.name) names.push(file.name);
				},
			],
		});
		expect(names.sort()).toEqual(['.hidden', 'a.txt', 'b.js', 'empty', 'sub']);
	});

	it('drops entries rejected by its filter', async () => {
		const names: string[] = [];
		await run({
			path: root,
			plugins: [
				dfp.statSync(),
				dfp.readDirSync(),
				dfp.queueDirFiles({ filter: (file: FileEntry) => !file.name.startsWith('.') }),
				(file: FileEntry) => {
					if (file.name) names.push(file.name);
				},
			],
		});
		expect(names).not.toContain('.hidden');
	});

	it('keeps its filter across repeated runs', async () => {
		// A shared plugin instance must not lose its filter after the first
		// directory it processes.
		const plugin = dfp.queueDirFiles({ filter: (file: FileEntry) => file.name !== 'e.txt' });
		const names: string[] = [];
		await run({
			path: root,
			plugins: [
				dfp.statSync(),
				dfp.queueDir(),
				dfp.readDirSync(),
				plugin,
				(file: FileEntry) => {
					if (file.name) names.push(file.name);
				},
			],
		});
		expect(names).not.toContain('e.txt');
		expect(names).toContain('c.txt');
	});

	it('ignores a non-function filter', async () => {
		const names: string[] = [];
		await run({
			path: root,
			plugins: [
				dfp.statSync(),
				dfp.readDirSync(),
				dfp.queueDirFiles({ filter: 'nope' as never }),
				(file: FileEntry) => {
					if (file.name) names.push(file.name);
				},
			],
		});
		expect(names).toHaveLength(5);
	});

	it('logs when verbose', async () => {
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		await run({
			path: root,
			plugins: [dfp.statSync(), dfp.readDirSync(), dfp.queueDirFiles({ verbose: true })],
		});
		expect(log.mock.calls.some((c) => c[0] === 'queueDirFiles')).toBe(true);
	});
});

describe('skip', () => {
	it('accepts a bare predicate and borrows its name', () => {
		const plugin = dfp.skip(function skipHidden(file: FileEntry) {
			return file.name.startsWith('.');
		});
		expect(plugin.name).toBe('skipHidden');
		expect(plugin.pluginTimeIgnore).toBe(true);
	});

	it('accepts an options object', () => {
		const plugin = dfp.skip({ name: 'custom', filter: () => true, pluginTimeIgnore: false });
		expect(plugin.name).toBe('custom');
		expect(plugin.pluginTimeIgnore).toBe(false);
	});

	it('falls back to a default name with no options', () => {
		expect(dfp.skip().name).toBe('skip');
	});

	it('ends the chain for matching entries only', async () => {
		const kept: string[] = [];
		const { err } = await run({
			path: root,
			plugins: [
				dfp.statSync(),
				dfp.readDirSync(),
				dfp.queueDirFiles(),
				dfp.skip((file: FileEntry) => !file.name || file.name.startsWith('.')),
				(file: FileEntry) => {
					kept.push(file.name);
				},
			],
		});
		expect(err).toBeUndefined();
		expect(kept.sort()).toEqual(['a.txt', 'b.js', 'empty', 'sub']);
	});

	it('reports SKIP rather than an error', async () => {
		const { err } = await run({
			path: root,
			plugins: [dfp.skip(() => true)],
		});
		expect(err).toBeUndefined();
	});
});

describe('integration', () => {
	it('reproduces the README example output', async () => {
		const found: string[] = [];
		const { err } = await run({
			path: root,
			plugins: [
				dfp.skip(function skipSpecial(file: FileEntry) {
					const charZero = file.name.charAt(0);
					return charZero === '.' || charZero === '$' || file.name === 'node_modules';
				}),
				dfp.stat(),
				dfp.queueDir(),
				dfp.readDir(),
				dfp.queueDirFiles(),
				dfp.skip(function skipEmptyNameOrDir(file: FileEntry) {
					return !file.name || !!file.stat?.isDirectory();
				}),
				function printFile(this: DirContext, file: FileEntry) {
					found.push(relPath(file));
				},
			],
		});
		expect(err).toBeUndefined();
		expect(found.sort()).toEqual(['a.txt', 'b.js', 'sub/c.txt', 'sub/deep/e.txt']);
	});

	it('matches the set of files fs reports', async () => {
		const expected = fs
			.readdirSync(root, { recursive: true, withFileTypes: true })
			.filter((d) => d.isFile())
			.map((d) => path.relative(root, path.join(d.parentPath, d.name)).split(path.sep).join('/'))
			.sort();
		const { found } = await collectFiles(root);
		expect(found).toEqual(expected);
	});
});
