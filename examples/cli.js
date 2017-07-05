var path = require('path');
var dirFiles = require('../dist/dir-files');

var dfp = dirFiles.plugins;
var dfTime = dirFiles.timePlugins;
var pluginOpt = {};

dirFiles({
	path: path.resolve(process.argv[2]),
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
	onError: function(err, file) {
		console.log('! '+path.join(file.dir.sub, file.name));
		console.error(err);
	},
	callback: function(err) {
		if (err) {
			throw err;
		}
		var time = this.time;
		//console.log(this.time);
		time.plugins.forEach(function(p) {
			p && console.log('plugin', p);
		});
		console.log('files', time.files);
		console.log('over', time.over);
		console.log('total', time.total);
	},
	initialize: dfTime.initialize,
	beforeFile: dfTime.beforeFile,
	afterFile: dfTime.afterFile,
	afterPlugin: dfTime.afterPlugin
});
