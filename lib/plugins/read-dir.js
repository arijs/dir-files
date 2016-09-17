/*eslint no-console: 0*/

import fs from 'fs';

export default function(opt) {
	opt || (opt = {});
	return function readDir(obj) {
		var stat = obj.file.stat;
		if ( !(stat && stat.isDirectory()) ) {
			return obj.callback();
		}
		var fpath = obj.file.fullpath;
		fs.readdir(fpath, function(err, dirFiles) {
			if (opt.verbose) {
				console.log('readdir', err, dirFiles);
			}
			if (err) return obj.callback(err);
			obj.file.dir.files = dirFiles;
			return obj.callback();
		});
	};
}
