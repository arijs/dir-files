import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import dirFiles from '../src/index.js';
import type { FileEntry } from '../src/index.js';
import { makeTree, relPath, removeTree, run } from './helpers.js';

const dfp = dirFiles.plugins;

let root: string;

beforeAll(() => {
	root = makeTree({
		'a.txt': 'a',
		'b.js': 'b',
		'c.TXT': 'c',
		'types.d.ts': 'd',
		src: { 'index.ts': 'i', 'util.js': 'u' },
		node_modules: { 'dep.js': 'x' },
	});
});

afterAll(() => {
	removeTree(root);
});

afterEach(() => {
	vi.restoreAllMocks();
});

/** Walks the tree with a `glob` plugin in front and returns what survived. */
async function globbed(opt: Parameters<typeof dfp.glob>[0]) {
	const found: string[] = [];
	const { err } = await run({
		path: root,
		plugins: [
			dfp.statSync(),
			dfp.glob(opt),
			dfp.queueDir(),
			dfp.readDirSync(),
			dfp.queueDirFiles(),
			dfp.skip((file: FileEntry) => !file.name || !!file.stat?.isDirectory()),
			(file: FileEntry) => {
				found.push(relPath(file));
			},
		],
	});
	return { err, found: found.sort() };
}

describe('glob', () => {
	it('keeps only files matching include', async () => {
		const { err, found } = await globbed({ include: ['*.js'] });
		expect(err).toBeUndefined();
		expect(found).toEqual(['b.js', 'node_modules/dep.js', 'src/util.js']);
	});

	it('rejects files matching exclude', async () => {
		const { found } = await globbed({ include: ['*.js'], exclude: ['node_modules/**'] });
		expect(found).toEqual(['b.js', 'src/util.js']);
	});

	it('keeps everything not excluded when include is omitted', async () => {
		const { found } = await globbed({ exclude: ['*.js', '*.ts'] });
		expect(found).toEqual(['a.txt', 'c.TXT']);
	});

	it('is case insensitive by default', async () => {
		const { found } = await globbed({ include: ['*.txt'] });
		expect(found).toEqual(['a.txt', 'c.TXT']);
	});

	it('honours a case sensitive option', async () => {
		const { found } = await globbed({
			include: ['*.txt'],
			options: { nocase: false, matchBase: true },
		});
		expect(found).toEqual(['a.txt']);
	});

	it('matches by basename via the matchBase alias', async () => {
		const { found } = await globbed({ include: ['index.ts'] });
		expect(found).toEqual(['src/index.ts']);
	});

	it('matches full relative paths', async () => {
		const { found } = await globbed({
			include: ['src/**'],
			options: { nocase: true },
		});
		expect(found).toEqual(['src/index.ts', 'src/util.js']);
	});

	it('applies separate include and exclude options', async () => {
		const { found } = await globbed({
			include: ['*.TXT'],
			includeOptions: { nocase: true, matchBase: true },
			exclude: ['c.TXT'],
			excludeOptions: { nocase: false, matchBase: true },
		});
		expect(found).toEqual(['a.txt']);
	});

	it('accepts a single pattern string', async () => {
		const { found } = await globbed({ include: '*.ts', exclude: '*.d.ts' });
		expect(found).toEqual(['src/index.ts']);
	});

	it('never reports rejection as an error', async () => {
		const { err } = await globbed({ include: ['nothing-matches-this'] });
		expect(err).toBeUndefined();
	});

	it('leaves directory entries alone so the walk can descend', async () => {
		const { found } = await globbed({ include: ['*.ts'], exclude: ['*.d.ts'] });
		expect(found).toEqual(['src/index.ts']);
	});

	it('does not run for already entered directories', () => {
		const plugin = dfp.glob({ include: ['*'] });
		const entry = dirFiles.fn.rootPath(root);
		expect(plugin.filter?.call({} as never, entry)).toBe(false);
	});

	it('is excluded from timing reports by default', () => {
		expect(dfp.glob().pluginTimeIgnore).toBe(true);
		expect(dfp.glob({ pluginTimeIgnore: false }).pluginTimeIgnore).toBe(false);
	});

	it('logs its decisions when verbose', async () => {
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		await globbed({ include: ['*.js'], exclude: ['node_modules/**'], verbose: true });
		const tags = log.mock.calls.map((c) => c[0] as string);
		expect(tags).toContain('glob not');
		expect(tags).toContain('glob inc');
		expect(tags).toContain('glob is');
		expect(tags).toContain('glob exc');
	});

	it('maps the noext alias onto noextglob', async () => {
		const extglob = { include: ['@(a|b).*'], options: { matchBase: true, nocase: true } };
		const on = await globbed(extglob);
		expect(on.found).toEqual(['a.txt', 'b.js']);

		const off = await globbed({
			...extglob,
			options: { ...extglob.options, noext: true },
		});
		expect(off.found).toEqual([]);
	});

	it('prefers an explicit picomatch name over its minimatch alias', async () => {
		const { found } = await globbed({
			include: ['*.txt'],
			options: { matchBase: false, basename: true, nocase: true },
		});
		expect(found).toEqual(['a.txt', 'c.TXT']);
	});
});
