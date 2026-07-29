# dir-files

Micro library to walk a directory tree with middlewares.

`dir-files` does not decide how to walk. It gives you a queue of entries and runs
a chain of plugins over each one; the plugins decide what gets read, what gets
queued next, and what gets skipped. Reading a directory, descending into it and
filtering by pattern are all just plugins, and so is anything you write yourself.

```js
import path from 'node:path';
import dirFiles from 'dir-files';

const dfp = dirFiles.plugins;

dirFiles({
	path: process.cwd(),
	plugins: [
		dfp.skip(function skipSpecial(file) {
			const c = file.name.charAt(0);
			return c === '.' || c === '$' || file.name === 'node_modules';
		}),
		dfp.stat(),
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
```

```
~ README.md
~ examples/cli.js
~ examples/dynamic.js
~ examples/glob.js
~ examples/recursive.js
~ package.json
~ src/index.ts
~ src/plugins/glob.ts
...
```

## Install

```sh
npm install dir-files
```

Requires **Node 20 or newer**. The package is **ESM only** and ships TypeScript
declarations; there is no CommonJS build.

## How it works

The traversal is a queue of **entries**. Each entry is either a *named* entry —
a child of some directory that has not been entered yet — or an *entered
directory*, whose `name` is `''`.

For every entry taken off the queue, the plugin chain runs in order:

1. Each plugin may declare a `filter`. If it returns falsy, that plugin is
   skipped for this entry and the chain moves on.
2. The plugin body runs. Synchronous plugins return; asynchronous ones call a
   callback.
3. Returning (or calling back with) `this.SKIP` ends the chain for this entry.
   Returning anything else truthy is treated as an **error**.

Plugins move work along by mutating `this.queue`. `queueDir` turns a named
directory into an entered one; `readDir` lists an entered directory into
`dir.files`; `queueDirFiles` turns that listing back into named entries. New
work goes on the *front* of the queue, which makes the walk depth-first.

Everything is mutable on purpose: a plugin can push onto `this.queue`, swap out
`this.plugins` mid-traversal, or hang extra data on the entry. See
[`examples/dynamic.js`](examples/dynamic.js) for a chain that rebuilds itself
per entry.

## Documentation

- **[API reference](docs/api.md)** — options, the context, entries, errors.
- **[Plugins](docs/plugins.md)** — every bundled plugin, and how to write one.
- **[Migrating from 1.0](docs/migration.md)** — what changed in 1.1.

## Examples

Run them against a build (`npm run build` first):

```sh
node examples/recursive.js   # print every file in the repo
node examples/glob.js        # filter with include/exclude patterns
node examples/dynamic.js     # build the plugin chain per entry
node examples/cli.js <path>  # walk a path and report per-plugin timings
```

## Development

```sh
npm install
npm run check     # lint + typecheck + test + build
npm test          # vitest
npm run coverage  # vitest with a coverage report
npm run build     # vite library build into dist/
```

## License

MIT
