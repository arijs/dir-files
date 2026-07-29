import type { DirContext, FileEntry, PluginObject } from '../types.js';

/** Options accepted by the `queueDir` plugin. */
export interface QueueDirOptions {
	/** Extra condition an entry must satisfy before its directory is queued. */
	filter?: (this: DirContext, file: FileEntry) => unknown;
	/** Log every queued directory to the console. */
	verbose?: boolean;
	/** Leave this plugin out of `timePlugins` reports. Defaults to `true`. */
	pluginTimeIgnore?: boolean;
}

/**
 * Queues a directory entry to be descended into.
 *
 * Runs for named entries whose stat says they are a directory. The new entry is
 * unshifted onto the front of the queue, which makes the traversal depth-first.
 */
export default function queueDirPlugin(opt: QueueDirOptions = {}): PluginObject {
	const filter = opt.filter;
	return {
		name: 'queueDir',
		pluginTimeIgnore: Object.hasOwn(opt, 'pluginTimeIgnore') ? opt.pluginTimeIgnore : true,
		filter(this: DirContext, file: FileEntry) {
			return (
				!!file.name &&
				!!file.stat &&
				file.stat.isDirectory() &&
				(!filter || !!filter.call(this, file))
			);
		},
		sync(this: DirContext, file: FileEntry) {
			if (opt.verbose) {
				console.log('queueDir', file.dir.sub, file.name);
			}
			const entered = this.fn.enterDirPath(file);
			this.queue = [entered].concat(this.queue);
		},
	};
}
