var path = require('path');
var dirFiles = require('../dist/dir-files');

var dfp = dirFiles.plugins;

dirFiles({
	path: path.join(__dirname, '..'),
	plugins: [
		function(obj) {
			var name = obj.file.name;
			// example of manual skipping
			var skip = ('.' === name.charAt(0)) || ('node_modules' === name);
			obj.callback(null, skip);
		},
		dfp.stat(),
		dfp.glob({
			include: ['*.js'],
			exclude: ['.*', 'node_modules', 'test', 'rollup.*']
		}),
		dfp.readDir(),
		dfp.addDirFiles(),
		dfp.rec(),
		function(obj) {
			var file = obj.file;
			if ( file.name && !file.stat.isDirectory() ) {
				console.log(path.join(file.dir.sub, file.name));
			}
			obj.callback();
		}
	],
	callback: function(err) {
		if (err) throw err;
	}
})();
