/*eslint no-console: 0*/

import fs from 'fs';

export default function statSyncPlugin(opt) {
	return {
		name: 'stat',
		filter: function(file) {
			return !file.stat;
		},
		sync: function stat(file) {
			try {
				var stat = file.stat = fs.statSync(file.fullpath);
				if (opt && opt.verbose) {
					console.log('stat', file.dir.sub, file.name, undefined, stat);
				}
			} catch(err) {
				if (opt && opt.verbose) {
					console.log('stat', file.dir.sub, file.name, err, stat);
				}
				return err;
			}
		}
	};
}
