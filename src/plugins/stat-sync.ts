import fs from 'node:fs';

import type { FileEntry, PluginObject } from '../types.js';
import type { StatOptions } from './stat.js';

export type { StatOptions };

/**
 * Fills `file.stat` with `fs.statSync`.
 *
 * Runs only for entries that do not have a stat yet. A failed stat is returned
 * as the plugin's error.
 */
export default function statSyncPlugin(opt: StatOptions = {}): PluginObject {
	return {
		name: 'stat',
		filter(file: FileEntry) {
			return !file.stat;
		},
		sync: function stat(file) {
			try {
				const stat = (file.stat = fs.statSync(file.fullpath));
				if (opt.verbose) {
					console.log('stat', file.dir.sub, file.name, undefined, stat);
				}
			} catch (err) {
				if (opt.verbose) {
					console.log('stat', file.dir.sub, file.name, err, undefined);
				}
				return err;
			}
		},
	};
}
