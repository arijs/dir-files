import path from 'path';
import glob from './plugins/glob';
import stat from './plugins/stat';
import statSync from './plugins/stat-sync';
import queueDir from './plugins/queue-dir';
import readDir from './plugins/read-dir';
import readDirSync from './plugins/read-dir-sync';
import queueDirFiles from './plugins/queue-dir-files';
import skip from './plugins/skip';
import timePlugins from './time-plugins';

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
	glob,
	stat,
	statSync,
	queueDir,
	readDir,
	readDirSync,
	queueDirFiles,
	skip
};
var dirFn = {
	rootPath,
	subDirPath,
	enterDirPath,
	isEmptyFileName,
	isDir,
	isFile,
	pluginWrap
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

export default dir;
