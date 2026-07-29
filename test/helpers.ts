import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import dirFiles from '../src/index.js';
import type { DirContext, DirOptions, FileEntry } from '../src/index.js';

/** A directory tree described as nested objects; strings are file contents. */
export interface TreeSpec {
	[name: string]: string | TreeSpec;
}

/** Writes `spec` under a fresh temp directory and returns its absolute path. */
export function makeTree(spec: TreeSpec): string {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dir-files-test-'));
	writeTree(root, spec);
	return root;
}

function writeTree(dir: string, spec: TreeSpec): void {
	fs.mkdirSync(dir, { recursive: true });
	for (const [name, value] of Object.entries(spec)) {
		const target = path.join(dir, name);
		if (typeof value === 'string') {
			fs.writeFileSync(target, value);
		} else {
			writeTree(target, value);
		}
	}
}

/** Removes a tree created by {@link makeTree}. */
export function removeTree(root: string): void {
	fs.rmSync(root, { recursive: true, force: true });
}

export interface RunResult<R> {
	err: unknown;
	result: R;
	context: DirContext<R>;
}

/**
 * Runs `dirFiles` and resolves once the traversal finishes.
 *
 * The promise resolves even on error, so tests can assert on `err` directly.
 */
export function run<R = unknown>(opt: DirOptions<R>): Promise<RunResult<R>> {
	return new Promise((resolve, reject) => {
		try {
			dirFiles<R>({
				...opt,
				callback(err, result) {
					resolve({ err, result, context: this });
				},
			});
		} catch (thrown) {
			reject(thrown instanceof Error ? thrown : new Error(String(thrown)));
		}
	});
}

/** The `dir.sub`-relative path of an entry, always with `/` separators. */
export function relPath(file: FileEntry): string {
	const joined = file.dir.sub ? path.join(file.dir.sub, file.name) : file.name;
	return joined.split(path.sep).join('/');
}

/**
 * Walks `root` recursively and collects the relative path of every regular
 * file, using the plugin chain from the README example.
 */
export async function collectFiles(root: string, extra: DirOptions<string[]> = {}) {
	const { plugins: extraPlugins = [], ...rest } = extra;
	const found: string[] = [];
	const dfp = dirFiles.plugins;
	const { err, context } = await run<string[]>({
		...rest,
		path: root,
		result: found,
		plugins: [
			...extraPlugins,
			dfp.stat(),
			dfp.queueDir(),
			dfp.readDir(),
			dfp.queueDirFiles(),
			dfp.skip(function skipDirs(file) {
				return !file.name || !!file.stat?.isDirectory();
			}),
			function collect(file: FileEntry) {
				found.push(relPath(file));
			},
		],
	});
	return { err, context, found: found.sort() };
}
