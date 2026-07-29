import fs from 'node:fs';

import type { FileEntry, PluginObject } from '../types.js';

/** Options accepted by the `stat` and `statSync` plugins. */
export interface StatOptions {
	/** Log every call to the console. */
	verbose?: boolean;
}

/**
 * Fills `file.stat` with `fs.stat`, asynchronously.
 *
 * Runs only for entries that do not have a stat yet.
 */
export default function statPlugin(opt: StatOptions = {}): PluginObject {
	return {
		name: 'stat',
		filter(file: FileEntry) {
			return !file.stat;
		},
		async: function stat(file, callback) {
			fs.stat(file.fullpath, (err, stat) => {
				if (opt.verbose) {
					console.log('stat', file.dir.sub, file.name, err, stat);
				}
				file.stat = stat ?? null;
				callback(err ?? undefined);
			});
		},
	};
}
