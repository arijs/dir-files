/*eslint no-console: 0*/

import path from 'path';

export default function(opt) {
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
			obj.queue.push({
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
