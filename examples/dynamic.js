// Build the plugin chain per entry instead of running one fixed chain.
//
//   node examples/dynamic.js

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dirFiles from '../dist/dir-files.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dfp = dirFiles.plugins;
const pluginOpt = {};

const skipSpecial = dfp.skip(function skipSpecial(file) {
	const charZero = file.name.charAt(0);
	return charZero === '.' || charZero === '$' || file.name === 'node_modules';
});
const stat = dfp.stat(pluginOpt);
const queueDir = dfp.queueDir(pluginOpt);
const readDir = dfp.readDir(pluginOpt);
const queueDirFiles = dfp.queueDirFiles(pluginOpt);

const printFile = function printFile(file) {
	console.log('~ ' + path.join(file.dir.sub, file.name));
};

// Runs right after `stat`, and appends whatever should happen next.
const pluginAfterStat = function pluginAfterStat(file) {
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

const initialPlugins = [skipSpecial, stat, pluginAfterStat];

dirFiles({
	path: path.join(here, '..'),
	processPlugins: [
		{
			beforeFile() {
				this.plugins = initialPlugins.slice();
			},
		},
	],
	callback(err) {
		if (err) throw err;
	},
});
