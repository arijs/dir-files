var path = require('path');
var dirFiles = require('../dist/dir-files');

var dfp = dirFiles.plugins;
var argPath = process.argv[2];
var pluginOpt = {};

dirFiles({
	path: argPath
		? path.resolve(argPath)
		: path.join(__dirname, '..'),
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
		/*dfp.glob({
			include: ['*.js'],
			exclude: ['.*', 'node_modules', 'test', 'rollup.*']
		}),*/
		dfp.stat(),
		dfp.readDir(pluginOpt),
		dfp.queueDirFiles(pluginOpt),
		dfp.queueDir(pluginOpt),
		dfp.skip(dirFiles.fn.isEmptyFileName)
		/*function printFile(file) {
			if ( !file.stat.isDirectory() ) {
				console.log('~ '+path.join(file.dir.sub, file.name));
			}
		}*/
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
	beforeFile: dirFiles.timePlugins.beforeFile,
	afterPlugin: dirFiles.timePlugins.afterPlugin
});
