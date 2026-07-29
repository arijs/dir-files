# Plugins

Every bundled plugin is a **factory**: call it with options, and it returns a
plugin object you put in the chain.

```js
const dfp = dirFiles.plugins;

plugins: [dfp.stat(), dfp.queueDir(), dfp.readDir(), dfp.queueDirFiles()];
```

The order above is the whole traversal, and it is worth reading once:

| Step | Runs for | Effect |
| --- | --- | --- |
| `stat` | entries with no `stat` | fills `file.stat` |
| `queueDir` | named entries that are directories | queues the entered directory |
| `readDir` | entered directories | fills `file.dir.files` |
| `queueDirFiles` | entered directories with a listing | queues one entry per name |

A plugin instance is stateless with respect to the traversal, so the same
instance can be reused across chains and across `dirFiles` calls.

---

## `stat(options)` / `statSync(options)`

Fills `file.stat` via `fs.stat` / `fs.statSync`. Skips entries that already have
one, so you can supply a stat yourself and this becomes a no-op.

A failed stat is reported as an error, and `file.stat` stays `null`. Use
`onError` to keep walking past unreadable entries.

| Option | Default | Meaning |
| --- | --- | --- |
| `verbose` | `false` | Log every call to the console. |

## `readDir(options)` / `readDirSync(options)`

Fills `file.dir.files` with the directory listing via `fs.readdir` /
`fs.readdirSync`. Runs only for entered directories that have a `stat`.

Like `stat`, a failure is reported as an error and the listing stays `null`.

| Option | Default | Meaning |
| --- | --- | --- |
| `verbose` | `false` | Log every call to the console. |

## `queueDir(options)`

Turns a *named* directory entry into an *entered* one and puts it at the front
of the queue. This is what makes the traversal recursive; leave it out and you
get a single-level listing.

| Option | Default | Meaning |
| --- | --- | --- |
| `filter` | — | Extra predicate; only matching directories are descended into. |
| `verbose` | `false` | Log every queued directory. |
| `pluginTimeIgnore` | `true` | Leave out of `timePlugins` reports. |

```js
// Walk everything except node_modules, without touching the outer chain.
dfp.queueDir({ filter: (file) => file.name !== 'node_modules' });
```

## `queueDirFiles(options)`

Turns each name in `file.dir.files` into its own entry, in listing order, at the
front of the queue.

| Option | Default | Meaning |
| --- | --- | --- |
| `filter` | — | Only entries matching this are queued. |
| `verbose` | `false` | Log each listing as it is queued. |
| `pluginTimeIgnore` | `true` | Leave out of `timePlugins` reports. |

The `filter` here runs on the *constructed entry*, before it is queued, so it is
cheaper than filtering later in the chain — but it runs before `stat`, so
`file.stat` is still `null`.

## `skip(predicate | options)`

Ends the plugin chain for entries matching a predicate. The most common way to
express "I am not interested in this one".

```js
dfp.skip(function skipHidden(file) {
	return file.name.startsWith('.');
});
```

Passing a named function is the idiomatic form: the function's own name becomes
the plugin name, which is what shows up in `timePlugins` reports.

The object form takes `{ filter, name, pluginTimeIgnore }`.

## `glob(options)`

Skips entries that fail an include/exclude pattern test, using
[micromatch](https://github.com/micromatch/micromatch).

```js
dfp.glob({ include: ['*.ts'], exclude: ['*.d.ts'] });
```

| Option | Default | Meaning |
| --- | --- | --- |
| `include` | — | Patterns an entry must match. Omit to accept everything. |
| `exclude` | — | Patterns that reject an entry, applied after `include`. |
| `options` | `{ nocase: true, matchBase: true }` | Matching options for both lists. |
| `includeOptions` | `options` | Overrides for the include list. |
| `excludeOptions` | `options` | Overrides for the exclude list. |
| `verbose` | `false` | Log every decision. |
| `pluginTimeIgnore` | `true` | Leave out of `timePlugins` reports. |

Patterns are matched against the entry's path relative to the traversal root,
always with `/` separators, so the same patterns work on Windows.

**Directories are always kept**, whatever the patterns say — otherwise an
`include: ['*.ts']` would stop the walk at the first directory. To prune a
directory, either `exclude` it explicitly or use `queueDir({ filter })`.

Matching options are micromatch/picomatch options. Two minimatch names are
accepted as aliases for the older option set: `matchBase` maps to `basename`,
and `noext` maps to `noextglob`. If you pass both an alias and its picomatch
name, the picomatch name wins.

---

## Writing a plugin

A plugin is an object:

```js
{
  name: 'countBytes',       // optional; used by timePlugins
  pluginTimeIgnore: false,  // optional; opt out of timing
  filter (file) { ... },    // optional; falsy result skips this plugin
  sync (file) { ... },      // OR
  async (file, callback) { ... }
}
```

`this` is the traversal context in all three.

### Reporting outcomes

| To say | `sync` | `async` |
| --- | --- | --- |
| all good | return nothing | `callback()` |
| skip the rest of this entry | `return this.SKIP` | `callback(this.SKIP)` |
| something went wrong | return the error | `callback(err)` |

There is no separate error channel — a truthy return *is* the error. That is why
`SKIP` is an object identity rather than a boolean.

### The short form

A bare function is expanded into a plugin object for you, with the mode chosen
from its declared arity:

```js
// sync: fewer than two parameters
function printFile(file) {
	console.log(file.fullpath);
}

// async: two or more
function readFile(file, callback) {
	fs.readFile(file.fullpath, (err, buf) => {
		file.contents = buf;
		callback(err);
	});
}
```

The function's name carries over, so named function expressions are worth the
few extra characters.

### A worked example

Collect the size of every regular file, and skip anything empty:

```js
const totals = { bytes: 0, files: 0 };

dirFiles({
	path: process.cwd(),
	plugins: [
		dfp.stat(),
		dfp.queueDir(),
		dfp.readDir(),
		dfp.queueDirFiles(),
		{
			name: 'measure',
			filter: (file) => !!file.name && file.stat.isFile(),
			sync (file) {
				if (file.stat.size === 0) return this.SKIP;
				totals.bytes += file.stat.size;
				totals.files++;
			},
		},
	],
	callback (err) {
		if (err) throw err;
		console.log(totals);
	},
});
```

Prefer `filter` over an early return inside the body: `filter` runs before the
timing hooks, so a filtered-out plugin costs nothing in the report, and it keeps
the body focused on the case it actually handles.

### In TypeScript

```ts
import type { DirContext, FileEntry, PluginObject } from 'dir-files';

export function measure(totals: { bytes: number }): PluginObject {
	return {
		name: 'measure',
		filter: (file: FileEntry) => !!file.name && !!file.stat?.isFile(),
		sync (this: DirContext, file: FileEntry) {
			if (file.stat!.size === 0) return this.SKIP;
			totals.bytes += file.stat!.size;
		},
	};
}
```
