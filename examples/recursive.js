var path = require('path');
var dirFiles = require('../dist/dir-files');

var dfp = dirFiles.plugins;
var pluginOpt = {};

dirFiles({
	path: path.join(__dirname, '..'),
	plugins: [
		dfp.skip(function skipSpecial(file) {
			var name = file.name;
			// example of manual skipping
			var charZero = name.charAt(0);
			var skip = ('.' === charZero) ||
				('$' === charZero) ||
				('node_modules' === name);
			return skip;
		}),
		dfp.stat(pluginOpt),
		dfp.queueDir(pluginOpt),
		dfp.readDir(pluginOpt),
		dfp.queueDirFiles(pluginOpt),
		dfp.skip(function skipEmptyNameOrDir(file) {
			return !file.name || file.stat.isDirectory();
		}),
		function printFile(file) {
			console.log('~ '+path.join(file.dir.sub, file.name));
		}
	],
	callback: function(err) {
		if (err) throw err;
	}
});
