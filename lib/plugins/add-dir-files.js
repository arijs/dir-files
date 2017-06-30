/*eslint no-console: 0*/

import path from 'path';

export default function(opt) {
	opt || (opt = {});
	return function addDirFiles(file, callback) {
		var dir = file.dir;
		var dirFiles = dir.files;
		if (!file.name && dirFiles) {
			var count = dirFiles.length;
			for ( var i = 0; i < count; i++ ) {
				var subFile = dirFiles[i];
				this.queue.splice(i, 0, {
					name: subFile,
					fullpath: path.join(dir.name, dir.sub, subFile),
					stat: null,
					dir: dir,
					time: {}
				});
			}
			if (opt.verbose) {
				console.log('addDirFiles', dir);
			}
		}
		return callback();
	};
}
