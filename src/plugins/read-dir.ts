import fs from 'node:fs';

import type { FileEntry, PluginObject } from '../types.js';

/** Options accepted by the `readDir` and `readDirSync` plugins. */
export interface ReadDirOptions {
	/** Log every call to the console. */
	verbose?: boolean;
}

/**
 * Fills `file.dir.files` with `fs.readdir`, asynchronously.
 *
 * Runs only for entries that represent an already-entered directory.
 */
export default function readDirPlugin(opt: ReadDirOptions = {}): PluginObject {
	return {
		name: 'readDir',
		filter(file: FileEntry) {
			return !file.name && !!file.stat && file.stat.isDirectory();
		},
		async: function readDir(file, callback) {
			fs.readdir(file.fullpath, (err, dirFiles) => {
				if (opt.verbose) {
					console.log('readdir', file.dir.sub, file.name, err, dirFiles?.length);
				}
				file.dir.files = dirFiles ?? null;
				callback(err ?? undefined);
			});
		},
	};
}
