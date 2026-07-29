# API reference

```js
import dirFiles from 'dir-files';
```

The default export is a function. It also carries four statics:

| Static                | What it is                                          |
| --------------------- | --------------------------------------------------- |
| `dirFiles.plugins`    | The bundled plugin factories. See [plugins](plugins.md). |
| `dirFiles.timePlugins`| A process plugin that measures the traversal.       |
| `dirFiles.SKIP`       | The marker that ends a plugin chain for one entry.   |
| `dirFiles.fn`         | Helpers for building entries.                        |

---

## `dirFiles(options)`

Starts a traversal. Returns `undefined` — everything is reported through
`options.callback`.

### Options

#### `path`

`string | string[]`

One or more absolute paths to walk. Each becomes a root entry at the front of
the queue. Omitting it starts with an empty queue, which is useful when the
first entries come from somewhere else.

#### `plugins`

`Plugin[]`

The chain applied to every entry. A plugin is either an object or a bare
function; see [writing a plugin](plugins.md#writing-a-plugin).

The array is **live**: `dirFiles` reads `this.plugins` before each step, so a
plugin can append to it or replace it and the change takes effect immediately.
Bare functions are replaced in place by their expanded object form on first use.

#### `processPlugins`

`ProcessPlugin[]`

Observers of the traversal lifecycle. Unlike plugins they do not run per entry
in a chain — they are hooks called at fixed points, with the context as `this`.

| Hook | When | Arguments |
| --- | --- | --- |
| `initialize` | once, before the first entry | — |
| `beforeFile` | before an entry's chain | `file` |
| `filterPlugin` | after a plugin's `filter` ran | `file`, `result` |
| `beforePlugin` | before a plugin body | — |
| `afterPlugin` | after a plugin body | `err`, `skip` |
| `afterFile` | after an entry's chain | `file`, `err`, `skip` |
| `finalize` | once, when the queue drains or an error stops the walk | `err`, `result` |

#### `result`

`any`

An arbitrary value carried on the context as `this.result` and handed back to
`callback`. A convenient place to accumulate output.

#### `callback`

`(err, result) => void`, called with the context as `this`.

Runs exactly once, when the traversal ends. `err` is set only when an error was
not handled by `onError`.

#### `onError`

`(err, file) => void`, called with the context as `this`.

Providing it makes errors **non-fatal**: the failing entry is abandoned, the
error is reported here, and the traversal continues with the next entry. Without
it, the first error ends the traversal and reaches `callback`.

---

## The context

Every plugin, process plugin and callback runs with the traversal context as
`this`.

| Property | Type | Notes |
| --- | --- | --- |
| `queue` | `FileEntry[]` | Pending entries. Push or unshift to add work. |
| `file` | `FileEntry \| undefined` | The entry being processed. |
| `lastFile` | `FileEntry \| undefined` | The entry processed before it. |
| `plugins` | `Plugin[]` | The active chain; reassignable mid-traversal. |
| `pIndex` | `number` | Index of the running plugin. |
| `result` | `any` | The value from `options.result`. |
| `SKIP` | `object` | Return this to end the chain for the current entry. |
| `fn` | `object` | The entry helpers, same as `dirFiles.fn`. |
| `opt` | `object` | The options the traversal was started with. |
| `time` | `object` | Present only with `timePlugins`. |

---

## Entries

An entry describes one unit of work.

```js
{
  name: 'index.ts',                    // '' when the entry IS the directory
  fullpath: '/abs/path/src/index.ts',  // always root + sub + name
  stat: Stats | null,                  // filled by the stat plugin
  parent: FileEntry | null,            // the entry this directory was entered from
  dir: {
    root: '/abs/path',                 // the traversal root
    sub: 'src',                        // path from root to this directory
    parent: DirEntry | null,
    files: ['index.ts', ...] | null    // filled by the readDir plugin
  }
}
```

The distinction that drives every bundled plugin's `filter`:

- **`name` is set** — a child of `dir` that has not been entered. `stat` it,
  and if it is a directory, `queueDir` it.
- **`name` is `''`** — `dir` itself, already entered. `readDir` it, then
  `queueDirFiles` its listing.

---

## `dirFiles.fn`

Helpers for building entries. Also available as `this.fn`.

| Helper | Returns |
| --- | --- |
| `rootPath(pathname)` | A root entry for an absolute path. |
| `subDirPath(file, name)` | An entry for `name` inside the same `dir` as `file`. |
| `enterDirPath(file)` | An entry that descends into the directory `file` names. |
| `isEmptyFileName(file)` | `true` when the entry is an entered directory. |
| `isDir(file)` | `true` when `file.stat` says directory. |
| `isFile(file)` | `true` when `file.stat` says regular file. |
| `pluginWrap(fn)` | Expands a bare function into a plugin object. |

`pluginWrap` picks the mode from the function's declared arity: fewer than two
parameters means `sync`, two or more means `async`.

---

## `dirFiles.timePlugins()`

A process plugin that records how long each plugin takes.

```js
dirFiles({
	path,
	plugins,
	processPlugins: [dirFiles.timePlugins()],
	callback(err) {
		if (err) throw err;
		console.log(this.time.total);    // ms for the whole traversal
		console.log(this.time.files);    // stats over per-entry durations
		console.log(this.time.over);     // per-entry time spent outside plugins
		console.log(this.time.plugins);  // one stats entry per named plugin
	},
});
```

Each stats object is `{ name, sum, count, avg, min, max, octiles }`. `octiles`
holds up to seven cut points of the sorted series, so you can see the shape of
the distribution rather than just its average.

Plugins are grouped by `name`. A plugin with no name, or with
`pluginTimeIgnore: true`, is left out — all the bundled queue and filter plugins
opt out by default, since their cost is bookkeeping rather than I/O.

Three helpers are exposed for reuse: `timePlugins.stats(series)`,
`timePlugins.median(sortedSeries, count)` and
`timePlugins.subtree(sortedSeries, count, level)`.

---

## TypeScript

Types ship with the package and are exported from the entry point:

```ts
import dirFiles from 'dir-files';
import type {
	DirContext,
	DirEntry,
	DirOptions,
	FileEntry,
	Plugin,
	PluginObject,
	ProcessPlugin,
	TimeStats,
} from 'dir-files';
```

`DirOptions<R>` is generic over the `result` type, so `callback(err, result)`
and `this.result` are typed:

```ts
const found: string[] = [];

dirFiles<string[]>({
	path: process.cwd(),
	result: found,
	plugins: [
		/* ... */
	],
	callback(err, result) {
		result.push('done'); // result is string[]
	},
});
```

Plugins themselves see the context as `DirContext<unknown>`. This is deliberate:
a plugin is meant to be reusable across traversals, and threading the result
type through the plugin chain would stop plugin instances from being shared. In
practice plugins accumulate through a closure, as above, rather than through
`this.result`.
