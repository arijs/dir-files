import { describe, expect, it } from 'vitest';

import dirFiles from '../src/index.js';

describe('public API surface', () => {
	it('is a function returning undefined', () => {
		expect(typeof dirFiles).toBe('function');
		expect(dirFiles({ callback() {} })).toBeUndefined();
	});

	it('exposes the documented statics', () => {
		expect(Object.keys(dirFiles.plugins).sort()).toEqual([
			'glob',
			'queueDir',
			'queueDirFiles',
			'readDir',
			'readDirSync',
			'skip',
			'stat',
			'statSync',
		]);
		expect(Object.keys(dirFiles.fn).sort()).toEqual([
			'enterDirPath',
			'isDir',
			'isEmptyFileName',
			'isFile',
			'pluginWrap',
			'rootPath',
			'subDirPath',
		]);
		expect(typeof dirFiles.timePlugins).toBe('function');
		expect(typeof dirFiles.SKIP).toBe('object');
	});

	it('every plugin factory returns a plugin object', () => {
		for (const [name, factory] of Object.entries(dirFiles.plugins)) {
			const plugin = factory({});
			expect(typeof plugin, name).toBe('object');
			expect(typeof plugin.name, name).toBe('string');
			expect(typeof (plugin.sync ?? plugin.async), name).toBe('function');
		}
	});

	it('hands the same SKIP marker to plugins', async () => {
		let seen: unknown;
		await new Promise<void>((resolve) => {
			dirFiles({
				plugins: [],
				callback() {
					seen = this.SKIP;
					resolve();
				},
			});
		});
		expect(seen).toBe(dirFiles.SKIP);
	});
});
