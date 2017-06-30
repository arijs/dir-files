/*eslint no-console: 0*/

import fs from 'fs';

export default function(opt) {
	opt || (opt = {});
	return function readDir(file, callback) {
		var stat = file.stat;
		if ( !(stat && stat.isDirectory()) ) {
			return callback();
		}
		var fpath = file.fullpath;
		fs.readdir(fpath, function(err, dirFiles) {
			if (opt.verbose) {
				console.log('readdir', err, dirFiles);
			}
			if (err) return callback(err);
			file.dir.files = dirFiles;
			return callback();
		});
	};
}
