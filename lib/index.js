import stat from './plugins/stat';
import readDir from './plugins/read-dir';
import addDirFiles from './plugins/add-dir-files';
import rec from './plugins/rec';

var plugins = {
	stat,
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
		}
	});
}

function all(obj) {
	var nextPlugin = obj.plugins[obj.pIndex];
	if (nextPlugin) {
		nextPlugin({
			file: obj.file,
			queue: obj.queue,
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

export default dir;
