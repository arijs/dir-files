import type { DirContext, FileEntry, PluginObject } from '../types.js';

/** Options accepted by the `queueDirFiles` plugin. */
export interface QueueDirFilesOptions {
	/** Keeps only the entries for which this returns truthy. */
	filter?: (this: DirContext, file: FileEntry) => unknown;
	/** Log every queued directory listing to the console. */
	verbose?: boolean;
	/** Leave this plugin out of `timePlugins` reports. Defaults to `true`. */
	pluginTimeIgnore?: boolean;
}

/**
 * Queues every name read into `file.dir.files` as its own entry.
 *
 * Runs for already-entered directories whose listing has been read. Entries are
 * unshifted onto the front of the queue, preserving the listing order.
 */
export default function queueDirFilesPlugin(opt: QueueDirFilesOptions = {}): PluginObject {
	const filter = typeof opt.filter === 'function' ? opt.filter : undefined;
	return {
		name: 'queueDirFiles',
		pluginTimeIgnore: Object.hasOwn(opt, 'pluginTimeIgnore') ? opt.pluginTimeIgnore : true,
		filter(file: FileEntry) {
			return !file.name && !!file.stat && file.stat.isDirectory() && !!file.dir.files;
		},
		sync(this: DirContext, file: FileEntry) {
			const dir = file.dir;
			const fileList = dir.files ?? [];
			if (opt.verbose) {
				console.log('queueDirFiles', dir.sub, file.name, fileList.length);
			}
			const clean: FileEntry[] = [];
			for (const name of fileList) {
				const subFile = this.fn.subDirPath(file, name);
				if (filter && !filter.call(this, subFile)) continue;
				clean.push(subFile);
			}
			this.queue = clean.concat(this.queue);
		},
	};
}
