import path from 'node:path';

import glob from './plugins/glob.js';
import stat from './plugins/stat.js';
import statSync from './plugins/stat-sync.js';
import queueDir from './plugins/queue-dir.js';
import readDir from './plugins/read-dir.js';
import readDirSync from './plugins/read-dir-sync.js';
import queueDirFiles from './plugins/queue-dir-files.js';
import skip from './plugins/skip.js';
import timePlugins from './time-plugins.js';

import type {
	DirContext,
	DirFn,
	DirOptions,
	FileEntry,
	MaybeError,
	Plugin,
	PluginFn,
	PluginObject,
	PluginSyncFn,
	ProcessPlugin,
	SkipSignal,
} from './types.js';

export type * from './types.js';

/** Builds the queue entry for a traversal root. */
function rootPath(pathname: string): FileEntry {
	return {
		name: '',
		fullpath: pathname,
		stat: null,
		parent: null,
		dir: {
			root: pathname,
			sub: '',
			parent: null,
			files: null,
		},
	};
}

/** Builds the queue entry for `subFile` inside the directory of `file`. */
function subDirPath(file: FileEntry, subFile: string): FileEntry {
	const dir = file.dir;
	return {
		name: subFile,
		fullpath: path.join(dir.root, dir.sub, subFile),
		stat: null,
		parent: file.parent,
		dir,
	};
}

/** Builds the queue entry that descends into the directory `file` points at. */
function enterDirPath(file: FileEntry): FileEntry {
	const dir = file.dir;
	const subFile = file.name;
	return {
		name: '',
		fullpath: path.join(dir.root, dir.sub, subFile),
		stat: file.stat,
		parent: file,
		dir: {
			root: dir.root,
			sub: path.join(dir.sub, subFile),
			parent: dir,
			files: null,
		},
	};
}

function isEmptyFileName(file: FileEntry): boolean {
	return !file.name;
}

function isDir(file: FileEntry): boolean {
	const stat = file.stat;
	return !!stat && stat.isDirectory();
}

function isFile(file: FileEntry): boolean {
	const stat = file.stat;
	return !!stat && stat.isFile();
}

/**
 * Expands a bare function into a plugin object.
 *
 * A function declaring fewer than two parameters becomes a `sync` plugin;
 * anything else becomes an `async` plugin receiving a callback.
 */
function pluginWrap(fn: PluginFn): PluginObject {
	const plugin: PluginObject = { name: fn.name };
	if (fn.length < 2) {
		plugin.sync = fn as PluginSyncFn;
	} else {
		plugin.async = fn;
	}
	return plugin;
}

const plugins = {
	glob,
	stat,
	statSync,
	queueDir,
	readDir,
	readDirSync,
	queueDirFiles,
	skip,
};

const dirFn: DirFn = {
	rootPath,
	subDirPath,
	enterDirPath,
	isEmptyFileName,
	isDir,
	isFile,
	pluginWrap,
};

const SKIP: SkipSignal = {};

type StepName = keyof ProcessPlugin;

/**
 * Creates a trampoline.
 *
 * The traversal is a chain of tail calls (plugin -> next plugin -> next file).
 * Calling them directly grows the stack by one frame per synchronous step,
 * which overflows on large trees. Scheduling the continuation here instead
 * keeps the stack flat while preserving the original ordering: work still runs
 * synchronously, just after the current frame unwinds rather than inside it.
 */
function createTrampoline(): (fn: () => void) => void {
	let running = false;
	let queued: (() => void) | undefined;
	return function bounce(fn: () => void): void {
		queued = fn;
		if (running) return;
		running = true;
		try {
			while (queued) {
				const step = queued;
				queued = undefined;
				step();
			}
		} finally {
			running = false;
			queued = undefined;
		}
	};
}

/**
 * Walks one or more directory trees, running a chain of plugins per entry.
 *
 * @param opt - traversal options; see {@link DirOptions}.
 * @returns nothing. Results are delivered through `opt.callback`.
 */
function dir<R = unknown>(opt: DirOptions<R>): void {
	const processPlugins: ProcessPlugin[] = opt.processPlugins ?? [];
	const callback = opt.callback;
	const onError = opt.onError;

	const obj: DirContext<R> = {
		plugins: opt.plugins ?? [],
		pIndex: 0,
		file: undefined,
		lastFile: undefined,
		queue: ([] as string[]).concat(opt.path ?? []).map((p) => rootPath(p)),
		result: opt.result as R,
		beforePlugin: opt.beforePlugin,
		afterPlugin: opt.afterPlugin,
		SKIP,
		fn: dirFn,
		opt,
	};

	const bounce = createTrampoline();

	// Process plugins observe the traversal through a context whose `result`
	// type they cannot know, so they always see it as `DirContext<unknown>`.
	const ctx = obj as DirContext;

	function processStep(name: StepName, args: unknown[] = []): void {
		const count = processPlugins.length;
		for (let i = 0; i < count; i++) {
			const p = processPlugins[i];
			const fn = p && p[name];
			if (typeof fn === 'function') {
				(fn as (...a: unknown[]) => void).apply(ctx, args);
			}
		}
	}

	function finished(err?: MaybeError): void {
		processStep('finalize', [err, obj.result]);
		if (typeof callback === 'function') {
			callback.call(obj, err, obj.result);
		}
	}

	function nextFile(err?: MaybeError): void {
		if (err) {
			if (onError) {
				onError.call(obj, err, obj.file);
			} else {
				finished(err);
				return;
			}
		}
		const file = obj.queue.shift();
		obj.lastFile = obj.file;
		obj.file = file;
		obj.pIndex = 0;
		if (file) {
			processStep('beforeFile', [file]);
			runPlugin();
		} else {
			finished();
		}
	}

	function callbackFile(err?: MaybeError, skipped?: boolean): void {
		processStep('afterFile', [obj.file, err, skipped]);
		bounce(() => nextFile(err));
	}

	function nextPlugin(): void {
		obj.pIndex++;
		bounce(runPlugin);
	}

	function callbackPlugin(err?: MaybeError): void {
		let skipped: boolean | undefined;
		if (err === SKIP) {
			skipped = true;
			err = undefined;
		}
		processStep('afterPlugin', [err, skipped]);
		if (err || skipped) {
			callbackFile(err, skipped);
		} else {
			nextPlugin();
		}
	}

	function runPlugin(): void {
		const pIndex = obj.pIndex;
		// Read through `obj` every step: plugins are allowed to replace or
		// extend `this.plugins` while the chain is running.
		let plugin: Plugin | undefined = obj.plugins[pIndex];
		if (!plugin) {
			callbackFile();
			return;
		}
		if (typeof plugin === 'function') {
			plugin = pluginWrap(plugin);
			obj.plugins[pIndex] = plugin;
		}
		const file = obj.file as FileEntry;
		const filter = plugin.filter;
		let allow: unknown = true;
		if (filter) {
			allow = filter.call(ctx, file);
			processStep('filterPlugin', [file, allow]);
		}
		if (!allow) {
			nextPlugin();
			return;
		}
		processStep('beforePlugin');
		if (plugin.sync) {
			callbackPlugin(plugin.sync.call(ctx, file));
		} else if (plugin.async) {
			plugin.async.call(ctx, file, callbackPlugin);
		} else {
			// Neither body was provided. Report it through the normal error
			// path rather than throwing an opaque TypeError from deep inside.
			callbackPlugin(
				new TypeError(
					`dir-files: plugin at index ${pIndex}` +
						(plugin.name ? ` (${plugin.name})` : '') +
						' has neither a "sync" nor an "async" function',
				),
			);
		}
	}

	processStep('initialize');
	bounce(() => nextFile());
}

dir.plugins = plugins;
dir.timePlugins = timePlugins;
dir.SKIP = SKIP;
dir.fn = dirFn;

export default dir;
