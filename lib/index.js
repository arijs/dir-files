import path from 'path';
import glob from './plugins/glob';
import stat from './plugins/stat';
import queueDir from './plugins/queue-dir';
import readDir from './plugins/read-dir';
import queueDirFiles from './plugins/queue-dir-files';
import skipEmptyName from './plugins/skip-empty-name';
import timePlugins from './time-plugins';

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
	glob,
	stat,
	queueDir,
	readDir,
	queueDirFiles,
	skipEmptyName
};
var dirFn = {
	rootPath,
	subDirPath,
	enterDirPath,
	pluginWrap
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
