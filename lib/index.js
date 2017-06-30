import stat from './plugins/stat';
import glob from './plugins/glob';
import readDir from './plugins/read-dir';
import addDirFiles from './plugins/add-dir-files';
import rec from './plugins/rec';

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
