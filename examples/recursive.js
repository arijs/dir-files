var path = require('path');
var dirFiles = require('../dist/dir-files');

var dfp = dirFiles.plugins;

dirFiles({
	path: path.join(__dirname, '..'),
	plugins: [
		function(obj) {
			var name = obj.file.name;
			var skip = ('.' === name.charAt(0)) || ('node_modules' === name);
			obj.callback(null, skip);
		},
		dfp.stat(),
		dfp.readDir(),
		dfp.addDirFiles(),
		dfp.rec(),
		function(obj) {
			var file = obj.file;
			if ( file.name ) {
				console.log(path.join(file.dir.sub, file.name));
			}
			obj.callback();
		}
	],
	callback: function(err) {
		if (err) throw err;
	}
})();
