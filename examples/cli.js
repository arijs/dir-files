// Walk a directory given on the command line and report timings.
//
//   node examples/cli.js ../some/path

import path from 'node:path';

import dirFiles from '../dist/dir-files.js';

const target = process.argv[2];
if (!target) {
	console.error('usage: node examples/cli.js <path>');
	process.exit(1);
}

const dfp = dirFiles.plugins;
const pluginOpt = {};

dirFiles({
	path: path.resolve(target),
	plugins: [
		dfp.skip(function skipSpecial(file) {
			const charZero = file.name.charAt(0);
			return charZero === '.' || charZero === '$' || file.name === 'node_modules';
		}),
		dfp.stat(pluginOpt),
		dfp.queueDir(pluginOpt),
		dfp.readDir(pluginOpt),
		dfp.queueDirFiles(pluginOpt),
		dfp.skip(function skipEmptyNameOrDir(file) {
			return !file.name || file.stat.isDirectory();
		}),
		function printFile(file) {
			const parent = file.parent;
			console.log(
				'~ ' +
					path.join(file.dir.sub, file.name) +
					(parent ? ` (${parent.dir.sub}:${parent.name})` : ''),
			);
		},
	],
	onError(err, file) {
		console.log('! ' + path.join(file.dir.sub, file.name));
		console.error(err);
	},
	callback(err) {
		if (err) throw err;
		const time = this.time;
		for (const p of time.plugins) {
			if (p) console.log('plugin', p);
		}
		console.log('files', time.files);
		console.log('over', time.over);
		console.log('total', time.total);
	},
	processPlugins: [dirFiles.timePlugins()],
});
