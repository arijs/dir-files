import stat from './plugins/stat';
import glob from './plugins/glob';
import readDir from './plugins/read-dir';
import addDirFiles from './plugins/add-dir-files';
import rec from './plugins/rec';
import timePlugins from './time-plugins';

var plugins = {
	stat,
	glob,
	readDir,
	addDirFiles,
	rec
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
			afterFile.call(obj, file, err, skip);
		}
		next(err);
	};
	return next;
}

dir.plugins = plugins;
dir.timePlugins = timePlugins;

export default dir;
