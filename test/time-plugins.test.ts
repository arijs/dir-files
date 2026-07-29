import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import dirFiles from '../src/index.js';
import type { DirContext, FileEntry, TimeFinal, TimeStats } from '../src/index.js';
import { makeTree, removeTree, run } from './helpers.js';

const dfp = dirFiles.plugins;
const tp = dirFiles.timePlugins;

let root: string;

beforeAll(() => {
	root = makeTree({ 'a.txt': 'a', 'b.txt': 'b', sub: { 'c.txt': 'c' } });
});

afterAll(() => {
	removeTree(root);
});

describe('statistics helpers', () => {
	describe('median', () => {
		it('takes the middle of an odd series', () => {
			expect(tp.median([1, 2, 3], 3)).toBe(2);
		});

		it('averages the two middles of an even series', () => {
			expect(tp.median([1, 2, 3, 4], 4)).toBe(2.5);
		});
	});

	describe('subtree', () => {
		it('returns just the median at level 1', () => {
			expect(tp.subtree([1, 2, 3], 3, 1)).toEqual([2]);
		});

		it('returns three cut points at level 2', () => {
			expect(tp.subtree([1, 2, 3, 4, 5, 6, 7], 7, 2)).toEqual([2, 4, 6]);
		});

		it('returns seven cut points at level 3', () => {
			const series = Array.from({ length: 15 }, (_, i) => i + 1);
			expect(tp.subtree(series, 15, 3)).toEqual([2, 4, 6, 8, 10, 12, 14]);
		});

		it('stops recursing when a half is empty', () => {
			expect(tp.subtree([5], 1, 3)).toEqual([5]);
		});
	});

	describe('stats', () => {
		it('summarises a series', () => {
			const s = tp.stats([3, 1, 2]);
			expect(s.sum).toBe(6);
			expect(s.count).toBe(3);
			expect(s.avg).toBe(2);
			expect(s.min).toBe(1);
			expect(s.max).toBe(3);
			expect(s.octiles).toEqual([1, 2, 3]);
		});

		it('handles an empty series', () => {
			const s = tp.stats([]);
			expect(s).toMatchObject({ sum: 0, count: 0, avg: 0, octiles: [0] });
			expect(s.min).toBe(Infinity);
			expect(s.max).toBe(-Infinity);
		});

		it('handles a missing series', () => {
			expect(tp.stats().count).toBe(0);
			expect(tp.stats(null).count).toBe(0);
		});

		it('does not reorder the caller array', () => {
			const input = [3, 1, 2];
			tp.stats(input);
			expect(input).toEqual([3, 1, 2]);
		});

		it('produces seven octiles for a long series', () => {
			const s = tp.stats(Array.from({ length: 64 }, (_, i) => i));
			expect(s.octiles).toHaveLength(7);
			expect(s.octiles).toEqual([...s.octiles].sort((a, b) => a - b));
		});
	});
});

describe('timePlugins as a process plugin', () => {
	it('collects timings for named plugins', async () => {
		const { err, context } = await run({
			path: root,
			processPlugins: [tp()],
			plugins: [
				dfp.statSync(),
				dfp.readDirSync(),
				dfp.queueDirFiles(),
				function work(this: DirContext, _file: FileEntry) {},
			],
		});
		expect(err).toBeUndefined();

		const time = context.time as TimeFinal;
		expect(typeof time.total).toBe('number');
		expect(time.files.count).toBeGreaterThan(0);
		expect(time.over.count).toBe(time.files.count);

		const names = time.plugins.map((p: TimeStats) => p.name);
		expect(names).toContain('stat');
		expect(names).toContain('readDir');
		expect(names).toContain('work');
		// queueDirFiles opts out of timing by default.
		expect(names).not.toContain('queueDirFiles');
	});

	it('records per-file timings on the entry', async () => {
		const seen: FileEntry[] = [];
		await run({
			path: root,
			processPlugins: [
				tp(),
				{
					afterFile(file) {
						seen.push(file);
					},
				},
			],
			plugins: [dfp.statSync(), function work() {}],
		});
		expect(seen).toHaveLength(1);
		const time = seen[0].time!;
		expect(time.plugins.filter(Boolean)).toHaveLength(2);
		expect(time.pluginsSum).toBeGreaterThanOrEqual(0);
		expect(time.total).toBeGreaterThanOrEqual(time.pluginsSum);
		expect(time.over).toBe(time.total - time.pluginsSum);
	});

	it('groups repeated plugins under one entry', async () => {
		const { context } = await run({
			path: root,
			processPlugins: [tp()],
			plugins: [
				dfp.statSync(),
				dfp.readDirSync(),
				dfp.queueDirFiles(),
				function work() {},
			],
		});
		const time = context.time as TimeFinal;
		const work = time.plugins.find((p: TimeStats) => p.name === 'work');
		expect(work?.count).toBe(4);
	});

	it('names anonymous timing slots', () => {
		const stats = tp.stats([1]);
		expect(stats.name).toBeUndefined();
	});

	it('does not throw when the traversal has nothing to do', async () => {
		const { err, context } = await run({ processPlugins: [tp()], plugins: [] });
		expect(err).toBeUndefined();
		expect((context.time as TimeFinal).files.count).toBe(0);
	});

	it('returns the same shared process plugin object', () => {
		expect(tp()).toBe(tp());
	});
});
