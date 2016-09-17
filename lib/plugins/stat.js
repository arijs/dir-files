/*eslint no-console: 0*/

import fs from 'fs';

export default function(opt) {
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
