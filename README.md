# dir-files

Example: `examples/recursive.js`

```
var path = require('path');
var dirFiles = require('../dist/dir-files');

var dfp = dirFiles.plugins;

dirFiles({
	path: path.join(__dirname, '..'),
	plugins: [
		function(file, callback) {
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
		function(file, callback) {
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
	}
})();
```

Output:

```
README.md
dist
examples
lib
package.json
rollup.config.js
rollup.config.test.js
test
dist/dir-files.esm.js
dist/dir-files.js
examples/recursive.js
lib/index.js
lib/plugins
test/index_test.esm.js
test/istanbul.reporter.js
test/mocha.opts
lib/plugins/add-dir-files.js
lib/plugins/read-dir.js
lib/plugins/rec.js
lib/plugins/stat.js
```
