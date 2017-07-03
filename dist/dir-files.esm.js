import path from 'path';
import mm from 'minimatch';
import fs from 'fs';

/*eslint no-console: 0*/

function glob ( opt ) {
	var Minimatch = mm.Minimatch;
	opt || (opt = {});
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
	return function glob ( file, callback ) {
		var allow = true;
		if ( file.name ) {
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
		}
		return callback(null, !allow);
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

function queueDirPlugin(opt) {
	opt || (opt = {});
	var filter = opt.filter;
	return {
		name: 'queueDir',
		filter: function(file) {
			return file.name &&
				file.stat &&
				file.stat.isDirectory() &&
				( !filter || filter(file) );
		},
		sync: function(file) {
			if (opt.verbose) {
				console.log('queueDir', file.dir.sub, file.name);
			}
			var clean = this.fn.enterDirPath(file.dir, file.name, file.stat);
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

function queueDirFilesPlugin(opt) {
	opt || (opt = {});
	var filter = opt.filter;
	return {
		name: 'queueDirFiles',
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
				subFile = self.fn.subDirPath(dir, subFile, null);
				if (filter && !filter(subFile)) return;
				clean.push(subFile);
			});
			this.queue = clean.concat(this.queue);
		}
	};
}

var skipEmptyNamePlugin = {
	name: 'skipEmptyName',
	sync: function skipEmptyName(file) {
		if (!file.name) {
			return this.SKIP;
		}
	}
};

function median(series, count) {
	var odd = count % 2;
	var half = (count - odd) * 0.5;
	return odd
		? series[half]
		: (series[half-1] + series[half]) * 0.5;
}

function stats(series) {
	series = series && series.sort();
	var count = series && series.length;
	var sum = 0;
	var sumDev = 0;
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
	for ( i = 0; i < count; i++ ) {
		t = series[i];
		sumDev += Math.pow(t-avg, 2);
	}
	var variance = count ? sumDev / count : sumDev;
	return {
		sum: sum,
		count: count,
		avg: avg,
		min: min,
		max: max,
		variance: variance,
		stdDev: Math.sqrt(variance),
		median: count ? median(series, count) : 0
	};
}

function beforeFile(file) {
	var time = this.time;
	var last = this.lastFile;
	var ltime = last && last.time;
	var ltotal;
	var lover;
	var now = Date.now();
	if ( !time ) {
		this.time = time = {
			start: now,
			plugins: [],
			files: [],
			over: [],
			total: 0
		}
	}
	if ( ltime ) {
		ltime.total = ltotal = now - ltime.start;
		ltime.over = lover = now - ltime.startPlugin;
		time.files.push(ltotal);
		time.over.push(lover);
	}
	if ( file ) {
		file.time = {
			start: now,
			startPlugin: now,
			plugins: [],
			total: 0
		};
	} else {
		var plugins = this.plugins;
		time.total = now - time.start;
		time.files = stats(time.files);
		time.over = stats(time.over);
		time.plugins = time.plugins.map(function(v, i) {
			v = stats(v);
			var name = plugins[i].name;
			v.name = name || 'plugin #'+(i+1);
			return v;
		});
	}
}

function afterPlugin() {
	var pIndex = this.pIndex;
	if (this.plugins[pIndex].sync) return;
	var time = this.time;
	var file = this.file;
	var ftime = file.time;
	var startPlugin = ftime.startPlugin;
	var now = Date.now();
	var timePlugin = now - startPlugin;
	var timePluginArray = time.plugins[pIndex];
	ftime.startPlugin = now;
	if ( !timePluginArray ) {
		time.plugins[pIndex] = timePluginArray = [];
	}
	timePluginArray.push(timePlugin);
	ftime.plugins[pIndex] = timePlugin;
}

var timePlugins = {
	median: median,
	stats: stats,
	beforeFile: beforeFile,
	afterPlugin: afterPlugin
};

function rootPath(pathname) {
	return ({
		name: '',
		fullpath: pathname,
		stat: null,
		dir: {
			root: pathname,
			sub: '',
			files: null
		}
	});
}

function subDirPath(dir, subFile, stat) {
	return ({
		name: subFile,
		fullpath: path.join(dir.root, dir.sub, subFile),
		stat: stat,
		dir: dir
	});
}

function enterDirPath(dir, subFile, stat) {
	return ({
		name: '',
		fullpath: path.join(dir.root, dir.sub, subFile),
		stat: stat,
		dir: {
			root: dir.root,
			sub: path.join(dir.sub, subFile),
			files: null
		}
	});
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
	queueDir: queueDirPlugin,
	readDir: readDirPlugin,
	queueDirFiles: queueDirFilesPlugin,
	skipEmptyName: skipEmptyNamePlugin
};
var dirFn = {
	rootPath: rootPath,
	subDirPath: subDirPath,
	enterDirPath: enterDirPath,
	pluginWrap: pluginWrap
};
var SKIP = {};

function all(obj, callbackFile) {
	function next() {
		obj.pIndex++;
		process.nextTick(all, obj, callbackFile);
	}
	function callbackPlugin(err) {
		var skip;
		if (err === SKIP) {
			skip = true;
			err = void 0;
		}
		if (afterPlugin) {
			afterPlugin.call(obj, err, skip);
		}
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
	if (nextFilter && !nextFilter.call(obj, obj.file)) {
		return next();
	}
	var beforePlugin = obj.beforePlugin;
	var afterPlugin = obj.afterPlugin;
	if (beforePlugin) {
		beforePlugin.call(obj);
	}
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
				return callback.call(obj, err, obj.result);
			}
		}
		var file = obj.queue.shift();
		obj.lastFile = obj.file;
		obj.file = file;
		obj.pIndex = 0;
		if (beforeFile) {
			beforeFile.call(obj, file);
		}
		if (file) {
			all(obj, callbackFile);
		} else {
			callback.call(obj, null, obj.result);
		}
	}
	var beforeFile = opt.beforeFile;
	var afterFile = opt.afterFile;
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
		if (afterFile) {
			afterFile.call(obj, obj.file, err, skip);
		}
		next(err);
	};
	next();
}

dir.plugins = plugins;
dir.timePlugins = timePlugins;
dir.SKIP = SKIP;
dir.fn = dirFn;

export default dir;