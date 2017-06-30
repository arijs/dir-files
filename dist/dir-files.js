'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var fs = _interopDefault(require('fs'));
var mm = _interopDefault(require('minimatch'));
var path = _interopDefault(require('path'));

/*eslint no-console: 0*/

function stat(opt) {
	opt || (opt = {});
	return function stat(file, callback) {
		var fpath = file.fullpath;
		fs.stat(fpath, function(err, stat) {
			if (opt.verbose) {
				console.log('stat', err, stat);
			}
			file.stat = stat;
			callback(err);
		});
	};
}

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

function readDir(opt) {
	opt || (opt = {});
	return function readDir(file, callback) {
		var stat = file.stat;
		if ( !(stat && stat.isDirectory()) ) {
			return callback();
		}
		var fpath = file.fullpath;
		fs.readdir(fpath, function(err, dirFiles) {
			if (opt.verbose) {
				console.log('readdir', err, dirFiles);
			}
			if (err) return callback(err);
			file.dir.files = dirFiles;
			return callback();
		});
	};
}

/*eslint no-console: 0*/

function addDirFiles(opt) {
	opt || (opt = {});
	return function addDirFiles(file, callback) {
		var this$1 = this;

		var dir = file.dir;
		var dirFiles = dir.files;
		if (!file.name && dirFiles) {
			var count = dirFiles.length;
			for ( var i = 0; i < count; i++ ) {
				var subFile = dirFiles[i];
				this$1.queue.splice(i, 0, {
					name: subFile,
					fullpath: path.join(dir.name, dir.sub, subFile),
					stat: null,
					dir: dir,
					time: {}
				});
			}
			if (opt.verbose) {
				console.log('addDirFiles', dir);
			}
		}
		return callback();
	};
}

/*eslint no-console: 0*/

function rec(opt) {
	opt || (opt = {});
	return function rec(file, callback) {
		var stat = file.stat;
		if ( !(file.name && stat && stat.isDirectory()) ) {
			return callback();
		}
		var test = opt.test || true;
		if (test instanceof Function) {
			test = test.call(this, file);
		}
		if (test) {
			var dir = file.dir;
			this.queue.unshift({
				name: '',
				fullpath: path.join(dir.name, dir.sub, file.name),
				stat: null,
				dir: {
					name: dir.name,
					sub: path.join(dir.sub, file.name),
					files: null
				},
				time: {}
			});
		}
		callback();
	};
}

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
	var time = this.time;
	var file = this.file;
	var ftime = file.time;
	var startPlugin = ftime.startPlugin;
	var pIndex = this.pIndex;
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

var plugins = {
	stat: stat,
	glob: glob,
	readDir: readDir,
	addDirFiles: addDirFiles,
	rec: rec
};

function pathToFile(name) {
	return ({
		name: '',
		fullpath: name,
		stat: null,
		dir: {
			name: name,
			sub: '',
			files: null
		},
		time: {}
	});
}

function all(obj, callbackFile) {
	function callbackPlugin(err, skip) {
		if (afterPlugin) {
			afterPlugin.call(obj, err, skip);
		}
		if (err || skip) return callbackFile(err, skip);
		obj.pIndex++;
		process.nextTick(all, obj, callbackFile);
	}
	var pIndex = obj.pIndex;
	var nextPlugin = obj.plugins[pIndex];
	var beforePlugin = obj.beforePlugin;
	var afterPlugin = obj.afterPlugin;
	if (beforePlugin) {
		beforePlugin.call(obj);
	}
	if (nextPlugin) {
		nextPlugin.call(obj, obj.file, callbackPlugin);
	} else {
		callbackFile();
	}
}

function dir(opt) {
	function next(err) {
		if (err) return callback.call(obj, err);
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
			callback.call(obj);
		}
	}
	var beforeFile = opt.beforeFile;
	var afterFile = opt.afterFile;
	var callback = opt.callback;
	var obj = {
		plugins: opt.plugins || [],
		pIndex: 0,
		file: void 0,
		lastFile: void 0,
		queue: [].concat(opt.path || []).map(pathToFile),
		result: opt.result,
		beforePlugin: opt.beforePlugin,
		afterPlugin: opt.afterPlugin,
		opt: opt
	};
	var callbackFile = function(err, skip) {
		if (afterFile) {
			afterFile.call(obj, obj.file, err, skip);
		}
		next(err);
	};
	return next;
}

dir.plugins = plugins;
dir.timePlugins = timePlugins;

module.exports = dir;