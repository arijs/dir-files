'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var path = _interopDefault(require('path'));
var mm = _interopDefault(require('minimatch'));
var fs = _interopDefault(require('fs'));

/*eslint no-console: 0*/

var hasOwnProperty = Object.prototype.hasOwnProperty;

function glob ( opt ) {
	opt || (opt = {});
	var Minimatch = mm.Minimatch;
	var mmOpts = opt.options || {
		nocase: true,
		matchBase: true
	};
	var includeOptions = opt.includeOptions || mmOpts;
	var excludeOptions = opt.excludeOptions || mmOpts;
	var includePatterns = [].concat( opt.include || [] );
	var excludePatterns = [].concat( opt.exclude || [] );
	var includeCount = includePatterns.length;
	var excludeCount = excludePatterns.length;
	var verbose = opt.verbose;
	var i;
	for ( i = 0; i < includeCount; i++ ) {
		includePatterns[i] = new Minimatch( includePatterns[i], includeOptions );
	}
	for ( i = 0; i < excludeCount; i++ ) {
		excludePatterns[i] = new Minimatch( excludePatterns[i], excludeOptions );
	}
	return {
		name: 'glob',
		filter: function ( file ) {
			return file.name;
		},
		pluginTimeIgnore: hasOwnProperty.call(opt, 'pluginTimeIgnore')
			? opt.pluginTimeIgnore
			: true,
		sync: function glob ( file ) {
			var allow = true;
			var stat = file.stat;
			allow = stat && stat.isDirectory();
			var fname = [].concat(file.dir.sub || [], file.name).join('/');
			if ( !allow ) {
				if (verbose) console.log('glob not', fname);
				for ( i = 0; i < includeCount; i++ ) {
					allow = includePatterns[i].match(fname);
					if ( allow ) {
						if (verbose) console.log('glob inc', fname, includePatterns[i].pattern);
						break;
					}
				}
			}
			if ( allow ) {
				if (verbose) console.log('glob is', fname);
				for ( i = 0; i < excludeCount; i++ ) {
					allow = !excludePatterns[i].match(fname);
					if ( !allow ) {
						if (verbose) console.log('glob exc', fname, excludePatterns[i].pattern);
						break;
					}
				}
			}
			return !allow;
		}
	};
}

/*eslint no-console: 0*/

function statPlugin(opt) {
	opt || (opt = {});
	return {
		name: 'stat',
		filter: function(file) {
			return !file.stat;
		},
		async: function stat(file, callback) {
			fs.stat(file.fullpath, function(err, stat) {
				if (opt.verbose) {
					console.log('stat', file.dir.sub, file.name, err, stat);
				}
				file.stat = stat;
				callback(err);
			});
		}
	};
}

/*eslint no-console: 0*/

function statSyncPlugin(opt) {
	return {
		name: 'stat',
		filter: function(file) {
			return !file.stat;
		},
		sync: function stat(file) {
			try {
				var stat = file.stat = fs.statSync(file.fullpath);
				if (opt && opt.verbose) {
					console.log('stat', file.dir.sub, file.name, undefined, stat);
				}
			} catch(err) {
				if (opt && opt.verbose) {
					console.log('stat', file.dir.sub, file.name, err, stat);
				}
				return err;
			}
		}
	};
}

/*eslint no-console: 0*/

var hasOwnProperty$1 = Object.prototype.hasOwnProperty;

function queueDirPlugin(opt) {
	opt || (opt = {});
	var filter = opt.filter;
	return {
		name: 'queueDir',
		pluginTimeIgnore: hasOwnProperty$1.call(opt, 'pluginTimeIgnore')
			? opt.pluginTimeIgnore
			: true,
		filter: function(file) {
			return file.name &&
				file.stat &&
				file.stat.isDirectory() &&
				( !filter || filter.call(this, file) );
		},
		sync: function(file) {
			if (opt.verbose) {
				console.log('queueDir', file.dir.sub, file.name);
			}
			var clean = this.fn.enterDirPath(file);
			this.queue = [clean].concat(this.queue);
		}
	};
}

/*eslint no-console: 0*/

function readDirPlugin(opt) {
	opt || (opt = {});
	return {
		name: 'readDir',
		filter: function(file) {
			return !file.name && file.stat && file.stat.isDirectory();
		},
		async: function readDir(file, callback) {
			fs.readdir(file.fullpath, function(err, dirFiles) {
				if (opt.verbose) {
					console.log('readdir', file.dir.sub, file.name, err, dirFiles.length);
				}
				file.dir.files = dirFiles;
				callback(err);
			});
		}
	};
}

/*eslint no-console: 0*/

function readDirSyncPlugin(opt) {
	return {
		name: 'readDir',
		filter: function(file) {
			return !file.name && file.stat && file.stat.isDirectory();
		},
		sync: function readDir(file) {
			try {
				var dirFiles = file.dir.files = fs.readdirSync(file.fullpath);
				if (opt && opt.verbose) {
					console.log('readdir', file.dir.sub, file.name, undefined, dirFiles.length);
				}
			} catch (err) {
				if (opt && opt.verbose) {
					console.log('readdir', file.dir.sub, file.name, err, dirFiles.length);
				}
				return err;
			}
		}
	};
}

/*eslint no-console: 0*/

var hasOwnProperty$2 = Object.prototype.hasOwnProperty;

function queueDirFilesPlugin(opt) {
	opt || (opt = {});
	var filter = opt.filter;
	return {
		name: 'queueDirFiles',
		pluginTimeIgnore: hasOwnProperty$2.call(opt, 'pluginTimeIgnore')
			? opt.pluginTimeIgnore
			: true,
		filter: function(file) {
			return !file.name &&
				file.stat &&
				file.stat.isDirectory() &&
				file.dir.files;
		},
		sync: function(file) {
			var self = this;
			var dir = file.dir;
			var fileList = dir.files;
			if (opt.verbose) {
				console.log('queueDirFiles', dir.sub, file.name, fileList.length);
			}
			var clean = [];
			if ( !(filter instanceof Function) ) {
				filter = void 0;
			}
			fileList.forEach(function queueFile(subFile) {
				subFile = self.fn.subDirPath(file, subFile);
				if (filter && !filter.call(self, subFile)) return;
				clean.push(subFile);
			});
			this.queue = clean.concat(this.queue);
		}
	};
}

var hasOwnProperty$3 = Object.prototype.hasOwnProperty;

function skipPlugin(opt) {
	var filter = opt && (opt instanceof Function ? opt : opt.filter);
	return {
		name: opt.name || 'skip',
		pluginTimeIgnore: hasOwnProperty$3.call(opt, 'pluginTimeIgnore')
			? opt.pluginTimeIgnore
			: true,
		filter: filter,
		sync: function skip(/*file*/) {
			return this.SKIP;
		}
	};
}

var hasOwnProperty$4 = Object.prototype.hasOwnProperty;

function median(series, count) {
	var odd = count % 2;
	var half = (count - odd) * 0.5;
	return odd
		? series[half]
		: (series[half-1] + series[half]) * 0.5;
}

function subtree(series, count, level) {
	var odd = count % 2;
	var half = (count - odd) * 0.5;
	var halfodd = half+odd;
	var median = odd
		? series[half]
		: (series[half-1] + series[half]) * 0.5;
	return (level > 1 && half > 0)
		? [].concat(
				subtree(series.slice(0, half), half, level-1),
				[median],
				subtree(series.slice(halfodd, count), half, level-1)
			)
		: [median];
}

function numericSort(a,b) {
	return a - b;
}

function stats(series) {
	series = series && series.sort(numericSort);
	var count = series && series.length;
	var sum = 0;
	//var sumDev = 0;
	var min = +Infinity;
	var max = -Infinity;
	var i, t;
	for ( i = 0; i < count; i++ ) {
		t = series[i];
		sum += t;
		(t < min) && (min = t);
		(t > max) && (max = t);
	}
	var avg = count ? sum / count : sum;
	/*
	for ( i = 0; i < count; i++ ) {
		t = series[i];
		sumDev += Math.pow(t-avg, 2);
	}
	var variance = count ? sumDev / count : sumDev;
	*/
	return {
		sum: sum,
		count: count,
		avg: avg,
		min: min,
		max: max,
		//variance: variance,
		//stdDev: Math.sqrt(variance),
		//median: count ? median(series, count) : 0,
		octiles: count ? subtree(series, count, 3) : [0]
	};
}

function initialize() {
	this.time = {
		start: Date.now(),
		plugins: [],
		files: [],
		over: [],
		total: 0
	};
	this.timePluginMap = {};
}

function finalize() {
	var time = this.time;
	var now = Date.now();
	time.total = now - time.start;
	time.files = stats(time.files);
	time.over = stats(time.over);
	time.plugins = time.plugins.map(function(v, i) {
		var name = v.name;
		v = stats(v.times);
		v.name = name || 'plugin #'+(i+1);
		return v;
	});
}

function beforeFile(file) {
	var now = Date.now();
	file.time = {
		start: now,
		startPlugin: now,
		plugins: [],
		pluginsSum: 0,
		total: 0
	};
}

function afterFile(file) {
	var time = this.time;
	var ftime = file.time;
	var ftotal;
	var fover;
	ftime.total = ftotal = ftime.startPlugin - ftime.start;
	ftime.over = fover = ftotal - ftime.pluginsSum;
	time.files.push(ftotal);
	time.over.push(fover);
}

function afterPlugin() {
	var file = this.file;
	var ftime = file.time;
	var startPlugin = ftime.startPlugin;
	var now = Date.now();
	ftime.startPlugin = now;
	var pIndex = this.pIndex;
	var pluginObj = this.plugins[pIndex];
	var pName = pluginObj.name;
	//
	if ( !pName || pluginObj.pluginTimeIgnore ) return;
	//
	var time = this.time;
	var timePluginMap = this.timePluginMap;
	var tpIndex;
	if (hasOwnProperty$4.call(timePluginMap, pName)) {
		tpIndex = timePluginMap[pName];
	} else {
		timePluginMap[pName] = tpIndex = time.plugins.length;
	}
	var timePlugin = now - startPlugin;
	var timePluginObj = time.plugins[tpIndex];
	if ( !timePluginObj ) {
		time.plugins[tpIndex] = timePluginObj = {
			name: pName,
			times: []
		};
	}
	timePluginObj.times.push(timePlugin);
	ftime.plugins[pIndex] = {
		name: pName,
		time: timePlugin
	};
	ftime.pluginsSum += timePlugin;
}

var timePluginsObj = {
	//median,
	//stats,
	initialize: initialize,
	finalize: finalize,
	beforeFile: beforeFile,
	afterFile: afterFile,
	afterPlugin: afterPlugin
};

function timePlugins() {
	return timePluginsObj;
}

timePlugins.median = median;
timePlugins.subtree = subtree;
timePlugins.stats = stats;

function rootPath(pathname) {
	return ({
		name: '',
		fullpath: pathname,
		stat: null,
		parent: null,
		dir: {
			root: pathname,
			sub: '',
			parent: null,
			files: null
		}
	});
}

function subDirPath(file, subFile) {
	var dir = file.dir;
	return ({
		name: subFile,
		fullpath: path.join(dir.root, dir.sub, subFile),
		stat: null,
		parent: file.parent,
		dir: dir
	});
}

function enterDirPath(file) {
	var dir = file.dir;
	var subFile = file.name;
	return ({
		name: '',
		fullpath: path.join(dir.root, dir.sub, subFile),
		stat: file.stat,
		parent: file,
		dir: {
			root: dir.root,
			sub: path.join(dir.sub, subFile),
			parent: dir,
			files: null
		}
	});
}

function isEmptyFileName(file) {
	return !file.name;
}

function isDir(file) {
	var stat = file.stat;
	return stat && stat.isDirectory();
}

function isFile(file) {
	var stat = file.stat;
	return stat && stat.isFile();
}

function pluginWrap(fn) {
	var ptype = fn.length < 2 ? 'sync' : 'async';
	var plugin = { name: fn.name };
	plugin[ptype] = fn;
	return plugin;
}

var plugins = {
	glob: glob,
	stat: statPlugin,
	statSync: statSyncPlugin,
	queueDir: queueDirPlugin,
	readDir: readDirPlugin,
	readDirSync: readDirSyncPlugin,
	queueDirFiles: queueDirFilesPlugin,
	skip: skipPlugin
};
var dirFn = {
	rootPath: rootPath,
	subDirPath: subDirPath,
	enterDirPath: enterDirPath,
	isEmptyFileName: isEmptyFileName,
	isDir: isDir,
	isFile: isFile,
	pluginWrap: pluginWrap
};
var SKIP = {};

function runPlugins(obj, processStep, callbackFile) {
	function next() {
		obj.pIndex++;
		// process.nextTick(
		runPlugins(obj, processStep, callbackFile);
	}
	function callbackPlugin(err) {
		var skip;
		if (err === SKIP) {
			skip = true;
			err = void 0;
		}
		processStep('afterPlugin', obj, [err, skip]);
		if (err || skip) {
			callbackFile(err, skip);
		} else {
			next();
		}
	}
	var pIndex = obj.pIndex;
	var nextPlugin = obj.plugins[pIndex];
	if (!nextPlugin) {
		return callbackFile();
	}
	if (nextPlugin instanceof Function) {
		obj.plugins[pIndex] = nextPlugin = pluginWrap(nextPlugin);
	}
	var nextFilter = nextPlugin.filter;
	var nextFilterResult = true;
	if (nextFilter) {
		nextFilterResult = nextFilter.call(obj, obj.file);
		processStep('filterPlugin', obj, [obj.file, nextFilterResult]);
	}
	if (!nextFilterResult) {
		return next();
	}
	processStep('beforePlugin', obj);
	if (nextPlugin.sync) {
		callbackPlugin(nextPlugin.sync.call(obj, obj.file));
	} else {
		nextPlugin.async.call(obj, obj.file, callbackPlugin);
	}
}

function dir(opt) {
	function next(err) {
		if (err) {
			if (onError) {
				onError.call(obj, err, obj.file);
			} else {
				finished(err);
				return;
			}
		}
		var file = obj.queue.shift();
		obj.lastFile = obj.file;
		obj.file = file;
		obj.pIndex = 0;
		if (file) {
			processStep('beforeFile', obj, [file]);
			runPlugins(obj, processStep, callbackFile);
		} else {
			finished();
		}
	}
	function finished(err) {
		processStep('finalize', obj, [err, obj.result]);
		callback.call(obj, err, obj.result);
	}
	function processStep(name, ctx, args) {
		var count = processPlugins.length;
		for ( var i = 0; i < count; i++ ) {
			var p = processPlugins[i];
			var fn = p && p[name];
			if (fn instanceof Function) {
				fn.apply(ctx, args);
			}
		}
	}
	var processPlugins = opt.processPlugins || [];
	var callback = opt.callback;
	var onError = opt.onError;
	var obj = {
		plugins: opt.plugins || [],
		pIndex: 0,
		file: void 0,
		lastFile: void 0,
		queue: [].concat(opt.path || []).map(rootPath),
		result: opt.result,
		beforePlugin: opt.beforePlugin,
		afterPlugin: opt.afterPlugin,
		SKIP: SKIP,
		fn: dirFn,
		opt: opt
	};
	var callbackFile = function(err, skip) {
		processStep('afterFile', obj, [obj.file, err, skip]);
		next(err);
	};
	processStep('initialize', obj);
	next();
}

dir.plugins = plugins;
dir.timePlugins = timePlugins;
dir.SKIP = SKIP;
dir.fn = dirFn;

module.exports = dir;