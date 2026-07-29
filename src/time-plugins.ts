import type {
	DirContext,
	FileEntry,
	MaybeError,
	PluginObject,
	ProcessPlugin,
	TimeCollecting,
	TimeFinal,
	TimeStats,
} from './types.js';

function numericSort(a: number, b: number): number {
	return a - b;
}

/**
 * Middle value of an already sorted series.
 *
 * @param series - values sorted ascending.
 * @param count - how many values to consider.
 */
function median(series: number[], count: number): number {
	const odd = count % 2;
	const half = (count - odd) * 0.5;
	return odd ? series[half] : (series[half - 1] + series[half]) * 0.5;
}

/**
 * Recursively splits a sorted series at its median.
 *
 * At `level` 3 this yields the seven octile cut points: the median, the two
 * quartiles around it, and the four octiles around those.
 *
 * @param series - values sorted ascending.
 * @param count - how many values to consider.
 * @param level - how many times to recurse.
 */
function subtree(series: number[], count: number, level: number): number[] {
	const odd = count % 2;
	const half = (count - odd) * 0.5;
	const halfodd = half + odd;
	const mid = odd ? series[half] : (series[half - 1] + series[half]) * 0.5;
	return level > 1 && half > 0
		? ([] as number[]).concat(
				subtree(series.slice(0, half), half, level - 1),
				[mid],
				subtree(series.slice(halfodd, count), half, level - 1),
			)
		: [mid];
}

/**
 * Descriptive statistics over a series of durations.
 *
 * The input is not modified.
 *
 * @param series - durations in milliseconds, in any order.
 */
function stats(series?: number[] | null): TimeStats {
	const sorted = series ? series.slice().sort(numericSort) : [];
	const count = sorted.length;
	let sum = 0;
	let min = +Infinity;
	let max = -Infinity;
	for (let i = 0; i < count; i++) {
		const t = sorted[i];
		sum += t;
		if (t < min) min = t;
		if (t > max) max = t;
	}
	return {
		sum,
		count,
		avg: count ? sum / count : sum,
		min,
		max,
		octiles: count ? subtree(sorted, count, 3) : [0],
	};
}

function initialize(this: DirContext): void {
	const collecting: TimeCollecting = {
		start: Date.now(),
		plugins: [],
		files: [],
		over: [],
		total: 0,
	};
	this.time = collecting;
	this.timePluginMap = {};
}

function finalize(this: DirContext): void {
	const time = this.time as TimeCollecting | undefined;
	if (!time) return;
	const now = Date.now();
	const final: TimeFinal = {
		start: time.start,
		total: now - time.start,
		files: stats(time.files),
		over: stats(time.over),
		plugins: time.plugins.map((v, i) => {
			const out = stats(v && v.times);
			out.name = (v && v.name) || `plugin #${i + 1}`;
			return out;
		}),
	};
	this.time = final;
}

function beforeFile(this: DirContext, file: FileEntry): void {
	const now = Date.now();
	file.time = {
		start: now,
		startPlugin: now,
		plugins: [],
		pluginsSum: 0,
		total: 0,
	};
}

function afterFile(this: DirContext, file: FileEntry): void {
	const time = this.time as TimeCollecting | undefined;
	const ftime = file.time;
	if (!time || !ftime) return;
	const ftotal = (ftime.total = ftime.startPlugin - ftime.start);
	const fover = (ftime.over = ftotal - ftime.pluginsSum);
	time.files.push(ftotal);
	time.over.push(fover);
}

function afterPlugin(this: DirContext, _err?: MaybeError, _skip?: boolean): void {
	const file = this.file;
	const ftime = file && file.time;
	if (!ftime) return;
	const startPlugin = ftime.startPlugin;
	const now = Date.now();
	ftime.startPlugin = now;

	const pIndex = this.pIndex;
	const pluginObj = this.plugins[pIndex] as PluginObject | undefined;
	const pName = pluginObj && typeof pluginObj !== 'function' ? pluginObj.name : undefined;

	if (!pName || (pluginObj as PluginObject).pluginTimeIgnore) return;

	const time = this.time as TimeCollecting | undefined;
	const timePluginMap = this.timePluginMap;
	if (!time || !timePluginMap) return;

	let tpIndex: number;
	if (Object.hasOwn(timePluginMap, pName)) {
		tpIndex = timePluginMap[pName];
	} else {
		timePluginMap[pName] = tpIndex = time.plugins.length;
	}

	const elapsed = now - startPlugin;
	let timePluginObj = time.plugins[tpIndex];
	if (!timePluginObj) {
		timePluginObj = time.plugins[tpIndex] = { name: pName, times: [] };
	}
	timePluginObj.times.push(elapsed);
	ftime.plugins[pIndex] = { name: pName, time: elapsed };
	ftime.pluginsSum += elapsed;
}

const timePluginsObj: ProcessPlugin = {
	initialize,
	finalize,
	beforeFile,
	afterFile,
	afterPlugin,
};

/**
 * A process plugin that records how long the traversal spends in each plugin.
 *
 * Adds `this.time` to the context: while running it collects raw durations,
 * and `finalize` replaces them with {@link TimeStats} summaries.
 *
 * @example
 * ```ts
 * dirFiles({ path, plugins, processPlugins: [dirFiles.timePlugins()], callback () {
 *   console.log(this.time);
 * } })
 * ```
 */
function timePlugins(): ProcessPlugin {
	return timePluginsObj;
}

timePlugins.median = median;
timePlugins.subtree = subtree;
timePlugins.stats = stats;

export default timePlugins;
