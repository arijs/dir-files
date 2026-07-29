import fs from 'node:fs';

import type { FileEntry, PluginObject } from '../types.js';
import type { ReadDirOptions } from './read-dir.js';

export type { ReadDirOptions };

/**
 * Fills `file.dir.files` with `fs.readdirSync`.
 *
 * Runs only for entries that represent an already-entered directory. A failed
 * read is returned as the plugin's error.
 */
export default function readDirSyncPlugin(opt: ReadDirOptions = {}): PluginObject {
	return {
		name: 'readDir',
		filter(file: FileEntry) {
			return !file.name && !!file.stat && file.stat.isDirectory();
		},
		sync: function readDir(file) {
			try {
				const dirFiles = (file.dir.files = fs.readdirSync(file.fullpath));
				if (opt.verbose) {
					console.log('readdir', file.dir.sub, file.name, undefined, dirFiles.length);
				}
			} catch (err) {
				if (opt.verbose) {
					console.log('readdir', file.dir.sub, file.name, err, undefined);
				}
				return err;
			}
		},
	};
}
