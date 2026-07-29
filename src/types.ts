import type { Stats } from 'node:fs';

/**
 * Marker object returned (or passed to a plugin callback) to signal that the
 * remaining plugins for the current file must be skipped.
 *
 * It is exposed as `dirFiles.SKIP` and as `this.SKIP` inside plugins.
 */
export type SkipSignal = Record<string, never>;

/** Anything a plugin may hand back as an error. */
export type MaybeError = unknown;

/**
 * Information about the directory a file belongs to.
 *
 * `root` + `sub` + `file.name` always join into `file.fullpath`.
 */
export interface DirEntry {
	/** Absolute path of the traversal root this directory descends from. */
	root: string;
	/** Path of this directory relative to {@link DirEntry.root} (`''` for the root itself). */
	sub: string;
	/** The parent directory, or `null` for a traversal root. */
	parent: DirEntry | null;
	/** Names read by the `readDir` plugin, or `null` while unread. */
	files: string[] | null;
}

/**
 * A unit of work in the queue.
 *
 * An entry with an empty `name` represents the directory `dir` itself, already
 * entered; an entry with a `name` represents a child of `dir` not yet entered.
 */
export interface FileEntry {
	/** Base name, or `''` when the entry *is* the directory `dir`. */
	name: string;
	/** Absolute path of the entry. */
	fullpath: string;
	/** Result of `fs.stat`, or `null` until the `stat` plugin runs. */
	stat: Stats | null;
	/** The entry the directory was entered from, if any. */
	parent: FileEntry | null;
	/** The directory this entry lives in. */
	dir: DirEntry;
	/** Per-file timings, present only when the `timePlugins` process plugin is used. */
	time?: FileTime;
}

/** Callback handed to asynchronous plugins. */
export type PluginCallback = (err?: MaybeError) => void;

/** A plugin body that runs synchronously; a returned value is treated as an error. */
export type PluginSyncFn = (this: DirContext, file: FileEntry) => MaybeError;

/** A plugin body that runs asynchronously and reports completion through `callback`. */
export type PluginAsyncFn = (
	this: DirContext,
	file: FileEntry,
	callback: PluginCallback,
) => void;

/**
 * A bare function used as a plugin.
 *
 * Arity decides the mode: fewer than 2 declared parameters means synchronous,
 * 2 or more means asynchronous. This mirrors the historical behaviour of
 * `dirFiles.fn.pluginWrap`.
 */
export type PluginFn = PluginSyncFn | PluginAsyncFn;

/** A plugin in its expanded, object form. */
export interface PluginObject {
	/** Used for timing reports; a plugin without a name is not timed. */
	name?: string;
	/** Runs before the plugin body; a falsy result skips this plugin for this file. */
	filter?: (this: DirContext, file: FileEntry) => unknown;
	/** When true the plugin is left out of `timePlugins` reports. */
	pluginTimeIgnore?: boolean;
	/** Synchronous body. Takes precedence over {@link PluginObject.async}. */
	sync?: PluginSyncFn;
	/** Asynchronous body, used when {@link PluginObject.sync} is absent. */
	async?: PluginAsyncFn;
}

/** Either form a plugin may take when passed in `opt.plugins`. */
export type Plugin = PluginObject | PluginFn;

/**
 * Hooks observing the traversal.
 *
 * Every hook is invoked with the {@link DirContext} as `this`.
 */
export interface ProcessPlugin {
	/** Once, before the first file is taken off the queue. */
	initialize?: (this: DirContext) => void;
	/** Once, after the queue drains or an unhandled error stops the traversal. */
	finalize?: (this: DirContext, err: MaybeError, result: unknown) => void;
	/** Before the plugin chain runs for `file`. */
	beforeFile?: (this: DirContext, file: FileEntry) => void;
	/** After the plugin chain finishes (or is cut short) for `file`. */
	afterFile?: (this: DirContext, file: FileEntry, err: MaybeError, skip?: boolean) => void;
	/** Before each plugin body runs. */
	beforePlugin?: (this: DirContext) => void;
	/** After each plugin body finishes. */
	afterPlugin?: (this: DirContext, err: MaybeError, skip?: boolean) => void;
	/** After a plugin's `filter` runs, with the value it returned. */
	filterPlugin?: (this: DirContext, file: FileEntry, result: unknown) => void;
}

/** Options accepted by `dirFiles(opt)`. */
export interface DirOptions<R = unknown> {
	/** One or more absolute paths to walk. */
	path?: string | string[];
	/** The plugin chain applied to every queued entry. */
	plugins?: Plugin[];
	/** Observers of the traversal lifecycle. */
	processPlugins?: ProcessPlugin[];
	/** Arbitrary value carried on the context and handed back to `callback`. */
	result?: R;
	/** Invoked once when the traversal ends. `this` is the {@link DirContext}. */
	callback?: (this: DirContext<R>, err: MaybeError, result: R) => void;
	/**
	 * Invoked for each error. Providing it makes errors non-fatal: the
	 * traversal continues with the next queued entry.
	 */
	onError?: (this: DirContext<R>, err: MaybeError, file: FileEntry | undefined) => void;
	/** @deprecated Carried on the context for backwards compatibility only. */
	beforePlugin?: unknown;
	/** @deprecated Carried on the context for backwards compatibility only. */
	afterPlugin?: unknown;
}

/** Helpers exposed as `dirFiles.fn` and as `this.fn` inside plugins. */
export interface DirFn {
	/** Builds the queue entry for a traversal root. */
	rootPath: (pathname: string) => FileEntry;
	/** Builds the queue entry for `subFile` inside the directory of `file`. */
	subDirPath: (file: FileEntry, subFile: string) => FileEntry;
	/** Builds the queue entry that descends into the directory `file` points at. */
	enterDirPath: (file: FileEntry) => FileEntry;
	/** True when the entry represents a directory already entered. */
	isEmptyFileName: (file: FileEntry) => boolean;
	/** True when `file.stat` says the entry is a directory. */
	isDir: (file: FileEntry) => boolean;
	/** True when `file.stat` says the entry is a regular file. */
	isFile: (file: FileEntry) => boolean;
	/** Expands a bare function into a {@link PluginObject}, choosing sync/async by arity. */
	pluginWrap: (fn: PluginFn) => PluginObject;
}

/**
 * The traversal state.
 *
 * It is the `this` of every plugin, process plugin and callback, and is meant
 * to be mutated: pushing to `queue` or reassigning `plugins` mid-traversal is
 * a supported pattern.
 */
export interface DirContext<R = unknown> {
	/** The active plugin chain. Bare functions are expanded in place on first use. */
	plugins: Plugin[];
	/** Index of the plugin currently running. */
	pIndex: number;
	/** The entry being processed. */
	file: FileEntry | undefined;
	/** The entry processed before {@link DirContext.file}. */
	lastFile: FileEntry | undefined;
	/** Pending entries. New work is unshifted onto the front by the queue plugins. */
	queue: FileEntry[];
	/** The value from `opt.result`. */
	result: R;
	/** @deprecated Mirrors `opt.beforePlugin`. */
	beforePlugin: unknown;
	/** @deprecated Mirrors `opt.afterPlugin`. */
	afterPlugin: unknown;
	/** The skip marker; return it from a plugin to skip the rest of the chain. */
	SKIP: SkipSignal;
	/** The helpers in {@link DirFn}. */
	fn: DirFn;
	/** The options object the traversal was started with. */
	opt: DirOptions<R>;
	/** Timing report, present only when the `timePlugins` process plugin is used. */
	time?: TimeReport;
	/** Internal index of plugin name to slot in `time.plugins`. */
	timePluginMap?: Record<string, number>;
}

/** Descriptive statistics over a series of durations, in milliseconds. */
export interface TimeStats {
	sum: number;
	count: number;
	avg: number;
	min: number;
	max: number;
	/** Seven cut points splitting the sorted series into eighths. */
	octiles: number[];
	/** Present on per-plugin entries. */
	name?: string;
}

/** Timings collected for a single file. */
export interface FileTime {
	start: number;
	startPlugin: number;
	plugins: Array<{ name: string; time: number } | undefined>;
	pluginsSum: number;
	total: number;
	/** Time spent inside the file, outside of any plugin. */
	over?: number;
}

/** Timing report, while it is still being collected. */
export interface TimeCollecting {
	start: number;
	plugins: Array<{ name: string; times: number[] }>;
	files: number[];
	over: number[];
	total: number;
}

/** Timing report, once `finalize` has run. */
export interface TimeFinal {
	start: number;
	plugins: TimeStats[];
	files: TimeStats;
	over: TimeStats;
	total: number;
}

/** The `this.time` value; shape depends on whether the traversal has finished. */
export type TimeReport = TimeCollecting | TimeFinal;
