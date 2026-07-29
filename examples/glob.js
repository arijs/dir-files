// Filter the walk with include/exclude patterns.
//
//   node examples/glob.js

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dirFiles from '../dist/dir-files.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dfp = dirFiles.plugins;

dirFiles({
	path: path.join(here, '..'),
	plugins: [
		dfp.skip(function skipSpecial(file) {
			const charZero = file.name.charAt(0);
			return charZero === '.' || charZero === '$' || file.name === 'node_modules';
		}),
		dfp.stat(),
		dfp.glob({ include: ['*.ts'], exclude: ['*.d.ts'] }),
		dfp.queueDir(),
		dfp.readDir(),
		dfp.queueDirFiles(),
		dfp.skip(function skipEmptyNameOrDir(file) {
			return !file.name || file.stat.isDirectory();
		}),
		function printFile(file) {
			console.log('~ ' + path.join(file.dir.sub, file.name));
		},
	],
	callback(err) {
		if (err) throw err;
	},
});
