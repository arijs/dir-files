'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var fs = _interopDefault(require('fs'));
var mm = _interopDefault(require('minimatch'));
var path = _interopDefault(require('path'));

/*eslint no-console: 0*/

function stat(opt) {
	opt || (opt = {});
	return function stat(obj) {
		var fpath = obj.file.fullpath;
		fs.stat(fpath, function(err, stat) {
			if (opt.verbose) {
				console.log('stat', err, stat);
			}
			if (err) return obj.callback(err);
			obj.file.stat = stat;
			return obj.callback();
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
	return function glob ( obj ) {
		var file = obj.file;
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
		return obj.callback(null, !allow);
	};
}

/*eslint no-console: 0*/

function readDir(opt) {
	opt || (opt = {});
	return function readDir(obj) {
		var stat = obj.file.stat;
		if ( !(stat && stat.isDirectory()) ) {
			return obj.callback();
		}
		var fpath = obj.file.fullpath;
		fs.readdir(fpath, function(err, dirFiles) {
			if (opt.verbose) {
				console.log('readdir', err, dirFiles);
			}
			if (err) return obj.callback(err);
			obj.file.dir.files = dirFiles;
			return obj.callback();
		});
	};
}

/*eslint no-console: 0*/

function addDirFiles(opt) {
	opt || (opt = {});
	return function addDirFiles(obj) {
		var file = obj.file;
		var dir = file.dir;
		var dirFiles = dir.files;
		if (!file.name && dirFiles) {
			var count = dirFiles.length;
			for ( var i = 0; i < count; i++ ) {
				var subFile = dirFiles[i];
				obj.queue.splice(i, 0, {
					name: subFile,
					fullpath: path.join(dir.name, dir.sub, subFile),
					stat: null,
					dir: dir
				});
			}
			if (opt.verbose) {
				console.log('addDirFiles', dir);
			}
		}
		return obj.callback();
	};
}

/*eslint no-console: 0*/

function rec(opt) {
	opt || (opt = {});
	return function rec(obj) {
		var file = obj.file;
		var stat = file.stat;
		if ( !(file.name && stat && stat.isDirectory()) ) {
			return obj.callback();
		}
		var test = opt.test || true;
		if (test instanceof Function) {
			test = test({
				file: file,
				result: obj.result
			});
		}
		if (test) {
			var dir = file.dir;
			obj.queue.unshift({
				name: '',
				fullpath: path.join(dir.name, dir.sub, file.name),
				stat: null,
				dir: {
					name: dir.name,
					sub: path.join(dir.sub, file.name),
					files: null
				}
			});
		}
		obj.callback();
	};
}

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
		}
	});
}

function all(obj) {
	var nextPlugin = obj.plugins[obj.pIndex];
	if (nextPlugin) {
		nextPlugin({
			file: obj.file,
			queue: obj.queue,
			setQueue: obj.setQueue,
			result: obj.result,
			callback: function(err, skip) {
				if (err) return obj.callback(err);
				if (skip) return obj.callback();
				setTimeout(function() {
					obj.pIndex++;
					all(obj);
				}, 0);
			}
		});
	} else {
		obj.callback();
	}
}

function dir(opt) {
	function next(err) {
		if (err) return opt.callback(err);
		var file = queue.shift();
		if (file) {
			all({
				plugins: plugins,
				pIndex: 0,
				file: file,
				queue: queue,
				result: result,
				callback: next
			});
		} else {
			opt.callback(null, result);
		}
	}
	var queue = [].concat(opt.path || []).map(pathToFile);
	var plugins = opt.plugins || [];
	var result = opt.result;
	return next;
}

dir.plugins = plugins;

module.exports = dir;