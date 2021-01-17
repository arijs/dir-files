/*eslint no-console: 0*/

import fs from 'fs';

export default function readDirSyncPlugin(opt) {
	return {
		name: 'readDir',
		filter: function(file) {
			return !file.name && file.stat && file.stat.isDirectory();
		},
		sync: function readDir(file) {
			try {
				var dirFiles = file.dir.files = fs.readdirSync(file.fullpath);
				if (opt && opt.verbose) {
					console.log('readdir', file.dir.sub, file.name, undefined, dirFiles.length);
				}
			} catch (err) {
				if (opt && opt.verbose) {
					console.log('readdir', file.dir.sub, file.name, err, dirFiles.length);
				}
				return err;
			}
		}
	};
}
