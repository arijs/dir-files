import path from 'node:path';

import micromatch from 'micromatch';

import type { DirContext, FileEntry, PluginObject } from '../types.js';

/** Matching options, forwarded to micromatch/picomatch. */
export type GlobMatchOptions = micromatch.Options & {
	/**
	 * Alias of picomatch's `basename`, kept for compatibility with the
	 * minimatch options this plugin used to take.
	 */
	matchBase?: boolean;
	/** Alias of picomatch's `noextglob`, kept for minimatch compatibility. */
	noext?: boolean;
};

/** Options accepted by the `glob` plugin. */
export interface GlobOptions {
	/** Patterns an entry must match to be kept. Omit to keep everything not excluded. */
	include?: string | string[];
	/** Patterns that reject an entry, applied after `include`. */
	exclude?: string | string[];
	/** Matching options used for both lists. Defaults to `{ nocase: true, matchBase: true }`. */
	options?: GlobMatchOptions;
	/** Overrides `options` for the include list. */
	includeOptions?: GlobMatchOptions;
	/** Overrides `options` for the exclude list. */
	excludeOptions?: GlobMatchOptions;
	/** Log every matching decision to the console. */
	verbose?: boolean;
	/** Leave this plugin out of `timePlugins` reports. Defaults to `true`. */
	pluginTimeIgnore?: boolean;
}

const defaultMatchOptions: GlobMatchOptions = {
	nocase: true,
	matchBase: true,
};

interface Matcher {
	pattern: string;
	match: (value: string) => boolean;
}

/**
 * Translates minimatch option names to their picomatch equivalents.
 *
 * Only the aliases that differ are rewritten; everything else is passed
 * through untouched.
 */
function toMicromatchOptions(opt: GlobMatchOptions): micromatch.Options {
	const { matchBase, noext, ...rest } = opt;
	const out: micromatch.Options = { ...rest };
	if (matchBase !== undefined && out.basename === undefined) {
		out.basename = matchBase;
	}
	if (noext !== undefined && out.noextglob === undefined) {
		out.noextglob = noext;
	}
	return out;
}

function compile(patterns: string | string[] | undefined, opt: GlobMatchOptions): Matcher[] {
	const options = toMicromatchOptions(opt);
	return ([] as string[]).concat(patterns ?? []).map((pattern) => ({
		pattern,
		match: micromatch.matcher(pattern, options),
	}));
}

/** Builds the `/`-separated path a pattern is matched against. */
function relativeName(file: FileEntry): string {
	const sub = file.dir.sub;
	const joined = sub ? path.join(sub, file.name) : file.name;
	return joined.split(path.sep).join('/');
}

/**
 * Skips entries that fail an include/exclude pattern test.
 *
 * Directories are always kept, so the traversal can still descend into them;
 * filter them out with `exclude` on their own entry if needed. Rejected entries
 * are skipped (`this.SKIP`), which ends the plugin chain for that entry without
 * stopping the traversal.
 *
 * @example
 * ```ts
 * glob({ include: ['*.ts'], exclude: ['*.d.ts'] })
 * ```
 */
export default function globPlugin(opt: GlobOptions = {}): PluginObject {
	const matchOptions = opt.options ?? defaultMatchOptions;
	const includePatterns = compile(opt.include, opt.includeOptions ?? matchOptions);
	const excludePatterns = compile(opt.exclude, opt.excludeOptions ?? matchOptions);
	const verbose = opt.verbose;

	return {
		name: 'glob',
		filter(file: FileEntry) {
			return !!file.name;
		},
		pluginTimeIgnore: Object.hasOwn(opt, 'pluginTimeIgnore') ? opt.pluginTimeIgnore : true,
		sync: function glob(this: DirContext, file: FileEntry) {
			const stat = file.stat;
			let allow = !!stat && stat.isDirectory();
			const fname = relativeName(file);

			if (!allow) {
				if (verbose) console.log('glob not', fname);
				// With no include list nothing is required, so keep the entry
				// and let the exclude list have the final say.
				if (includePatterns.length === 0) {
					allow = true;
				} else {
					for (const p of includePatterns) {
						allow = p.match(fname);
						if (allow) {
							if (verbose) console.log('glob inc', fname, p.pattern);
							break;
						}
					}
				}
			}

			if (allow) {
				if (verbose) console.log('glob is', fname);
				for (const p of excludePatterns) {
					if (p.match(fname)) {
						allow = false;
						if (verbose) console.log('glob exc', fname, p.pattern);
						break;
					}
				}
			}

			return allow ? undefined : this.SKIP;
		},
	};
}
