import path from 'node:path';

import { describe, expect, it } from 'vitest';

import dirFiles from '../src/index.js';
import type { FileEntry } from '../src/index.js';

const fn = dirFiles.fn;

describe('dirFiles.fn', () => {
	describe('rootPath', () => {
		it('builds a root entry with an empty name and sub', () => {
			const root = fn.rootPath('/tmp/x');
			expect(root).toEqual({
				name: '',
				fullpath: '/tmp/x',
				stat: null,
				parent: null,
				dir: { root: '/tmp/x', sub: '', parent: null, files: null },
			});
		});
	});

	describe('subDirPath', () => {
		it('keeps the same dir and joins the name onto it', () => {
			const root = fn.rootPath('/tmp/x');
			const sub = fn.subDirPath(root, 'a.txt');
			expect(sub.name).toBe('a.txt');
			expect(sub.fullpath).toBe(path.join('/tmp/x', 'a.txt'));
			expect(sub.dir).toBe(root.dir);
			expect(sub.stat).toBeNull();
		});

		it('inherits the parent of the entry it came from', () => {
			const root = fn.rootPath('/tmp/x');
			const child = fn.subDirPath(root, 'a');
			child.parent = root;
			const grandchild = fn.subDirPath(child, 'b');
			expect(grandchild.parent).toBe(root);
		});
	});

	describe('enterDirPath', () => {
		it('descends into a named entry, extending sub', () => {
			const root = fn.rootPath('/tmp/x');
			const named = fn.subDirPath(root, 'sub');
			const entered = fn.enterDirPath(named);
			expect(entered.name).toBe('');
			expect(entered.fullpath).toBe(path.join('/tmp/x', 'sub'));
			expect(entered.parent).toBe(named);
			expect(entered.dir.root).toBe('/tmp/x');
			expect(entered.dir.sub).toBe('sub');
			expect(entered.dir.parent).toBe(root.dir);
			expect(entered.dir.files).toBeNull();
		});

		it('nests sub paths across levels', () => {
			const root = fn.rootPath('/tmp/x');
			const first = fn.enterDirPath(fn.subDirPath(root, 'a'));
			const second = fn.enterDirPath(fn.subDirPath(first, 'b'));
			expect(second.dir.sub).toBe(path.join('a', 'b'));
			expect(second.fullpath).toBe(path.join('/tmp/x', 'a', 'b'));
		});
	});

	describe('predicates', () => {
		const entry = (over: Partial<FileEntry>): FileEntry =>
			Object.assign(fn.rootPath('/tmp/x'), over);

		it('isEmptyFileName tracks the name', () => {
			expect(fn.isEmptyFileName(entry({ name: '' }))).toBe(true);
			expect(fn.isEmptyFileName(entry({ name: 'a' }))).toBe(false);
		});

		it('isDir and isFile need a stat', () => {
			expect(fn.isDir(entry({ stat: null }))).toBe(false);
			expect(fn.isFile(entry({ stat: null }))).toBe(false);

			const asDir = { isDirectory: () => true, isFile: () => false };
			const asFile = { isDirectory: () => false, isFile: () => true };
			expect(fn.isDir(entry({ stat: asDir as never }))).toBe(true);
			expect(fn.isFile(entry({ stat: asDir as never }))).toBe(false);
			expect(fn.isDir(entry({ stat: asFile as never }))).toBe(false);
			expect(fn.isFile(entry({ stat: asFile as never }))).toBe(true);
		});
	});

	describe('pluginWrap', () => {
		it('treats a function of arity < 2 as sync', () => {
			const wrapped = fn.pluginWrap(function one(_file: FileEntry) {
				return undefined;
			});
			expect(wrapped.name).toBe('one');
			expect(typeof wrapped.sync).toBe('function');
			expect(wrapped.async).toBeUndefined();
		});

		it('treats a function of arity >= 2 as async', () => {
			const wrapped = fn.pluginWrap(function two(_file: FileEntry, cb: () => void) {
				cb();
			});
			expect(wrapped.name).toBe('two');
			expect(typeof wrapped.async).toBe('function');
			expect(wrapped.sync).toBeUndefined();
		});

		it('treats a zero-arity function as sync', () => {
			const wrapped = fn.pluginWrap(function none() {
				return undefined;
			});
			expect(typeof wrapped.sync).toBe('function');
		});
	});
});
