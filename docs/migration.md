# Migrating from 1.0 to 1.1

The runtime API is unchanged. `dirFiles(opt)`, `dirFiles.plugins`,
`dirFiles.SKIP`, `dirFiles.fn` and `dirFiles.timePlugins` all keep the same
names, the same shapes and the same semantics. Plugins written against 1.0 keep
working.

What changed is everything around it: the package format, the glob engine, and
a handful of bugs that made some paths unusable.

## 1. The package is ESM only

`require('dir-files')` no longer works. There is a single ESM build.

```js
// before
var dirFiles = require('dir-files');

// after
import dirFiles from 'dir-files';
```

If you cannot move to ESM yet, `await import('dir-files')` works from CommonJS,
or stay on `1.0.0-rc.15`.

## 2. Node 20 is the minimum

`engines.node` is `>=20`. 1.0 had no floor and ran on Node 4-era output.

## 3. `minimatch` was replaced by `micromatch`

`minimatch@3` — the only runtime dependency 1.0 had — carries four ReDoS
advisories, starting with
[GHSA-f8q6-p94x-37v3](https://github.com/advisories/GHSA-f8q6-p94x-37v3), and is
no longer maintained at that major.

Patterns behave the same for ordinary use. Two option names differ, and both old
names are still accepted as aliases:

| 1.0 (minimatch) | 1.1 (micromatch) | Status |
| --- | --- | --- |
| `matchBase` | `basename` | old name still accepted |
| `noext` | `noextglob` | old name still accepted |

Other minimatch-only options (`nocomment`, `flipNegate`) have no equivalent and
are ignored. If you rely on an exotic pattern, check it against micromatch
before upgrading.

## 4. Bug fixes that change behaviour

These are the only places where 1.1 does something different on purpose. All
three made the affected feature unusable in 1.0, so nothing sensible could have
depended on the old behaviour — but they are worth knowing about.

### `glob` rejected entries as errors

In 1.0 the `glob` plugin returned `!allow` — a plain `true` — for an entry that
failed the patterns. A truthy return is an *error*, so the first non-matching
file aborted the whole traversal unless you also passed `onError`.

1.1 returns `this.SKIP`, which is what a filtering plugin is supposed to do.

### `glob` with no `include` matched nothing

In 1.0, an empty include list left `allow` false, so an `exclude`-only
configuration rejected every file. 1.1 treats "no include patterns" as "nothing
is required", and lets `exclude` have the final say.

### `readDir` and `stat` crashed on their own error path

With `verbose: true`, the error branches logged `dirFiles.length` and
`stat` — variables that are `undefined` at exactly that point. Any failed
`readdir` or `stat` threw a `TypeError` instead of reporting the real error.

## 5. Deep or wide trees no longer overflow the stack

1.0 advanced the traversal with direct recursion: one stack frame per plugin,
per entry, for the whole walk. A directory with 20 000 entries and a four-plugin
chain reliably threw `RangeError: Maximum call stack size exceeded`.

1.1 runs the same steps through a trampoline. Ordering is identical — synchronous
plugins still run synchronously, in the same sequence — but the stack stays flat
regardless of tree size.

## 6. Smaller robustness changes

- Omitting `callback` no longer throws; the traversal just runs to completion.
- A plugin object with neither a `sync` nor an `async` body is reported as a
  `TypeError` through the normal error path, instead of throwing an opaque
  "not a function" from inside the loop.
- `queueDirFiles` no longer discards its own `filter` after the first directory
  it processed.
- `glob` no longer shares loop state between concurrent traversals.
- `timePlugins.stats(series)` no longer sorts the array you passed in.
- `glob` matches against `/`-separated paths on every platform, so the same
  patterns work on Windows.

## 7. TypeScript

Declarations ship with the package; `@types/dir-files` is not needed.

`DirOptions<R>` is generic over the `result` type. Plugins see the context as
`DirContext<unknown>` so that a plugin instance stays reusable across
traversals — accumulate through a closure rather than through `this.result`.
See the [API reference](api.md#typescript).

## 8. Repository layout

| 1.0 | 1.1 |
| --- | --- |
| `lib/*.js` (ES5 + ESM syntax) | `src/*.ts` |
| Rollup + Buble | Vite library mode |
| Mocha + Istanbul, tests against `dist` | Vitest + v8 coverage, tests against `src` |
| ESLint 7 `.eslintrc` | ESLint 10 flat config, type-aware |
| Travis CI | GitHub Actions (`.github/workflows/ci.yml`) |
| `dist/` committed | `dist/` built on demand |
