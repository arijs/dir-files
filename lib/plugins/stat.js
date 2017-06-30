/*eslint no-console: 0*/

import fs from 'fs';

export default function(opt) {
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
}
