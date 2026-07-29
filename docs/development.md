# Development

```sh
npm install
npm run check     # lint + typecheck + test + build
npm test          # vitest
npm run coverage  # vitest with a coverage report
npm run build     # vite library build into dist/
```

Every script calls its tool by bare name (`eslint .`, `vitest run`), which relies
on npm putting `node_modules/.bin` at the front of `PATH` for the duration of the
script. There is no `.npmrc` in the repository and no custom `script-shell`, so
on a stock toolchain this works with no setup beyond `npm install`.

## Windows

### `npm run` cannot find the local binaries under Volta

If you manage Node with [Volta](https://volta.sh) on Windows, `npm run` and `npx`
may fail to resolve any project binary:

```
> eslint .

'eslint' is not recognized as an internal or external command,
operable program or batch file.
```

The same failure hits every script that shells out to a dependency — `lint`,
`test`, `typecheck`, `build` — and therefore `check` as well.

This is not a problem with the repository, and the following were all ruled out
on a machine that reproduced it:

| Checked | Result |
| --- | --- |
| `node_modules\.bin\eslint.cmd` exists | Yes, and runs correctly when invoked directly |
| `PATHEXT` contains `.CMD` | Yes |
| `node_modules\.bin` present in the script `PATH` | Yes, confirmed via `npm run env` |
| `eslint` invoked from the shell directly | Works |
| Downgrading to the npm bundled with Node | Still fails |

The remaining difference is Volta's shim layer, which sits between the shell and
`node`/`npm`/`npx`. Node, npm and npx all resolve to `C:\Program Files\Volta\`
rather than to a Node installation.

**Workaround** — call the shims directly, bypassing `npm run`:

```powershell
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\vitest.cmd run
.\node_modules\.bin\tsc.cmd --noEmit
.\node_modules\.bin\vite.cmd build
```

Contributors who are not on Volta, and CI, are unaffected — `npm run check` works
normally there.

### The stack safety tests are slow

The two tests in the `stack safety` block build their fixture on a real
filesystem: one creates 20,000 files in a single directory, the other nests 400
directories. Creating those files takes well under a second on Linux and roughly
25 times longer on Windows, where NTFS and real-time antivirus scanning charge
per file created.

Both tests carry a 60 second timeout for that reason. The traversal being tested
is fast on every platform — walking the 20,000 entries takes about 70 ms — so a
failure here is worth reading carefully before assuming it is just slowness. If
these tests dominate your local runs, excluding antivirus scanning from your
temp directory is the change that helps most.
