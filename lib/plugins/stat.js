/*eslint no-console: 0*/

import fs from 'fs';

export default function statPlugin(opt) {
	opt || (opt = {});
	return {
		name: 'stat',
		filter: function(file) {
			return !file.stat;
		},
		async: function stat(file, callback) {
			fs.stat(file.fullpath, function(err, stat) {
				if (opt.verbose) {
					console.log('stat', file.dir.sub, file.name, err, stat);
				}
				file.stat = stat;
				callback(err);
			});
		}
	};
}
