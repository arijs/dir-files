import type { DirContext, FileEntry, PluginObject } from '../types.js';

/** Object form of the `skip` plugin options. */
export interface SkipOptions {
	/** Entries matching this are skipped; the rest of the chain is not run. */
	filter?: (this: DirContext, file: FileEntry) => unknown;
	/** Name reported in `timePlugins`. Defaults to `'skip'`. */
	name?: string;
	/** Leave this plugin out of `timePlugins` reports. Defaults to `true`. */
	pluginTimeIgnore?: boolean;
}

/** Everything the `skip` plugin accepts: a predicate, or an options object. */
export type SkipInput = ((this: DirContext, file: FileEntry) => unknown) | SkipOptions;

/**
 * Stops the plugin chain for entries matching a predicate.
 *
 * Pass a function for the common case; the function's own name is reused as the
 * plugin name, which shows up in `timePlugins` reports.
 *
 * @example
 * ```ts
 * skip(function skipHidden(file) {
 *   return file.name.startsWith('.');
 * })
 * ```
 */
export default function skipPlugin(opt?: SkipInput): PluginObject {
	const isFn = typeof opt === 'function';
	const filter = isFn ? opt : opt?.filter;
	// A bare predicate lends its own function name to the plugin, so timing
	// reports show `skipHidden` rather than a generic `skip`.
	const source = (opt ?? {}) as { name?: string; pluginTimeIgnore?: boolean };
	return {
		name: source.name || 'skip',
		pluginTimeIgnore: Object.hasOwn(source, 'pluginTimeIgnore')
			? source.pluginTimeIgnore
			: true,
		filter,
		sync: function skip(this: DirContext) {
			return this.SKIP;
		},
	};
}
