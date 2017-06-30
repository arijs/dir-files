/*eslint no-console: 0*/

import path from 'path';

export default function(opt) {
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
