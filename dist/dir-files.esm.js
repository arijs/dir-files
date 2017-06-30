import fs from 'fs';
import mm from 'minimatch';
import path from 'path';

/*eslint no-console: 0*/

var stat = function(opt) {
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
};

/*eslint no-console: 0*/

var glob = function ( opt ) {
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
};

/*eslint no-console: 0*/

var readDir = function(opt) {
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
};

/*eslint no-console: 0*/

var addDirFiles = function(opt) {
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
};

/*eslint no-console: 0*/

var rec = function(opt) {
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
	var pIndex = obj.pIndex;
	var nextPlugin = obj.plugins[pIndex];
	var beforePlugin = obj.beforePlugin;
	var afterPlugin = obj.afterPlugin;
	if (nextPlugin) {
		var callbackPlugin = function(err, skip) {
			if (afterPlugin) {
				afterPlugin(obj, err, skip);
			}
			if (err || skip) return callbackFile(err, skip);
			obj.pIndex++;
			process.nextTick(all, obj, callbackFile);
		};
		if (beforePlugin) {
			beforePlugin(obj);
		}
		nextPlugin.call(obj, obj.file, callbackPlugin);
	} else {
		callbackFile();
	}
}

function dir(opt) {
	function next(err) {
		if (err) return callback.call(obj, err);
		var file = obj.queue.shift();
		obj.file = file;
		obj.pIndex = 0;
		if (file) {
			if (beforeFile) {
				beforeFile(obj);
			}
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
		queue: [].concat(opt.path || []).map(pathToFile),
		result: opt.result,
		beforePlugin: opt.beforePlugin,
		afterPlugin: opt.afterPlugin,
		opt: opt
	};
	var callbackFile = function(err, skip) {
		if (afterFile) {
			afterFile(obj, err, skip);
		}
		next(err);
	};
	return next;
}

dir.plugins = plugins;

export default dir;
