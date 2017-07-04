var path = require('path');
var dirFiles = require('../dist/dir-files');

var dfp = dirFiles.plugins;
var pluginOpt = {};

var skipSpecial = dfp.skip(function skipSpecial(file) {
	var name = file.name;
	// example of manual skipping
	var charZero = name.charAt(0);
	var skip = ('.' === charZero) ||
		('$' === charZero) ||
		('node_modules' === name);
	return skip;
});
var stat = dfp.stat(pluginOpt);
var queueDir = dfp.queueDir(pluginOpt);
var readDir = dfp.readDir(pluginOpt);
var queueDirFiles = dfp.queueDirFiles(pluginOpt);
/*var skipEmptyNameOrDir = dfp.skip(function skipEmptyNameOrDir(file) {
	return !file.name || file.stat.isDirectory();
});*/
var printFile = function printFile(file) {
	console.log('~ '+path.join(file.dir.sub, file.name));
};
var pluginAfterStat = function (file) {
	if (file.stat.isDirectory()) {
		if (file.name) {
			this.plugins.push(queueDir);
		} else {
			this.plugins.push(readDir, queueDirFiles);
		}
	} else if (file.stat.isFile()) {
		this.plugins.push(printFile);
	}
};
var initialPlugins = [
	skipSpecial,
	stat,
	pluginAfterStat
];

dirFiles({
	path: path.join(__dirname, '..'),
	/*plugins: [
		skipSpecial,
		stat,
		queueDir,
		readDir,
		queueDirFiles,
		skipEmptyNameOrDir,
		printFile
	],*/
	beforeFile: function() {
		this.plugins = initialPlugins.slice();
		//this.pIndex = 0;
	},
	callback: function(err) {
		if (err) throw err;
	}
});
