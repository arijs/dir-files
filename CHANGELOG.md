# Changelog

## 2.0.0

Full rewrite of the internals with the public API held fixed. See
[docs/migration.md](docs/migration.md) for the upgrade guide.

### Breaking

- **ESM only.** `require('dir-files')` no longer works; there is no CommonJS
  build. The package is `"type": "module"` with an `exports` map.
- **Node 20 or newer** is required (`engines.node: ">=20"`).
- **`minimatch` replaced by `micromatch`** in the `glob` plugin. Pattern syntax
  is compatible; `matchBase` and `noext` are accepted as aliases for picomatch's
  `basename` and `noextglob`. minimatch-only options are ignored.
- `dist/` is no longer committed to the repository.

### Fixed

- `glob` reported a non-matching entry as an **error** rather than a skip, which
  aborted the traversal on the first rejected file. It now returns `this.SKIP`.
- `glob` with an `exclude` list but no `include` list rejected **every** file.
  An empty include list now means "nothing is required".
- `readDir`, `readDirSync`, `stat` and `statSync` threw a `TypeError` from their
  own error branch under `verbose: true`, masking the real failure.
- Deep or wide trees threw `RangeError: Maximum call stack size exceeded`. The
  traversal now advances through a trampoline; ordering is unchanged, stack
  depth is constant.
- `queueDirFiles` discarded its own `filter` after the first directory it
  processed.
- `glob` shared loop state across traversals through a closure variable.
- `timePlugins.stats(series)` sorted the caller's array in place.
- `glob` matched against platform-native separators, so path patterns silently
  failed on Windows. Matching is now always `/`-separated.
- Omitting `callback` threw; the traversal now completes quietly.
- A plugin object with neither `sync` nor `async` threw an opaque
  "not a function"; it is now a `TypeError` on the normal error path.

### Security

- Removed all 28 known advisories present in 1.0.0-rc.15 (8 critical, 15 high,
  4 moderate, 1 low), including the four ReDoS advisories against the runtime
  `minimatch@3` dependency. `npm audit` reports zero findings.

### Added

- **TypeScript.** Source is TypeScript under `src/`; declarations ship in the
  package. `DirOptions<R>` is generic over the `result` type.
- **Tests.** 101 Vitest tests covering the core, every plugin, the timing
  helpers, error paths and stack safety, at ~98% statement coverage. Coverage
  thresholds are enforced.
- **Docs.** `docs/api.md`, `docs/plugins.md` and `docs/migration.md`, plus a
  rewritten README and a new `examples/glob.js`.
- **CI.** GitHub Actions running lint, typecheck, tests, build, the examples and
  `npm audit` on Node 20, 22 and 24.

### Changed

- Build moved from Rollup 0.34 + Buble to Vite library mode.
- Tests moved from Mocha + Istanbul (run against `dist/`) to Vitest + v8
  coverage (run against `src/`).
- Lint moved from ESLint 7 `.eslintrc` to ESLint 10 flat config, type-aware.
- CI moved from Travis to GitHub Actions.
- Examples rewritten as ESM.

## 1.0.0-rc.15

Previous releases; see the git history.
