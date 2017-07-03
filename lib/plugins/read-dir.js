/*eslint no-console: 0*/

import fs from 'fs';

export default function readDirPlugin(opt) {
	opt || (opt = {});
	return {
		name: 'readDir',
		filter: function(file) {
			return !file.name && file.stat && file.stat.isDirectory();
		},
		async: function readDir(file, callback) {
			fs.readdir(file.fullpath, function(err, dirFiles) {
				if (opt.verbose) {
					console.log('readdir', file.dir.sub, file.name, err, dirFiles.length);
				}
				file.dir.files = dirFiles;
				callback(err);
			});
		}
	};
}
