var path = require('path');
var dirFiles = require('../dist/dir-files');

var dfp = dirFiles.plugins;

dirFiles({
	path: path.join(__dirname, '..'),
	plugins: [
		function skipFile(file, callback) {
			var name = file.name;
			// example of manual skipping
			var skip = ('.' === name.charAt(0)) || ('node_modules' === name);
			callback(null, skip);
		},
		dfp.stat(),
		/*dfp.glob({
			include: ['*.js'],
			exclude: ['.*', 'node_modules', 'test', 'rollup.*']
		}),*/
		dfp.readDir(),
		dfp.addDirFiles(),
		dfp.rec(),
		function printFile(file, callback) {
			if ( file.name && !file.stat.isDirectory() ) {
				console.log(path.join(file.dir.sub, file.name));
			}
			callback();
		}
	],
	callback: function(err) {
		if (err) {
			throw err;
		}
		console.log(this.time);
	},
	beforeFile: dirFiles.timePlugins.beforeFile,
	afterPlugin: dirFiles.timePlugins.afterPlugin
})();
