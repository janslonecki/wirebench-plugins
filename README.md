# wirebench-plugins

The plugins wirebench publishes but does not ship. Everything here is
**GPL-3.0-or-later** with a linking exception ([EXCEPTION.md](EXCEPTION.md)),
distributed as `.wbplugin` files rather than bundled into the app.

It is a separate repository on purpose, and the reason is a rule worth
stating in one line: **the licence follows the distribution path.**

| | lives in | licence |
|---|---|---|
| Plugins the app **bundles** (its catalog) | `wirebench/examples/plugins/` | MIT |
| Plugins we **hand out as a file** | here | GPL-3.0-or-later + §7 |

A plugin that ships *inside* wirebench is code we bundle into a proprietary
application, which is the combination question the GPL raises — against
ourselves, pointlessly. A plugin we publish as a file is conveyed on its own,
combined with nothing, and GPL costs nothing and says something. So the split
is not filing: it is the licence boundary, and the app's build makes it a hard
one anyway (`catalog.ts` imports its plugins at build time, from inside the
workspace root).

Deliberately **not** a git submodule of wirebench, for the same four reasons
the media repo is not one — the `Stop` hook's `git add -A` has no
`--recurse-submodules`, `man git-worktree` BUGS advises against multiple
checkouts of a superproject, `git worktree add` never initialises a submodule,
and working trees are not shared between worktrees. See wirebench
`docs/recording.md` §Why not a submodule.

## Layout

```
plugins/<name>/
  wirebench-plugin.json    the manifest
  main.py                  the code, carrying the licence notice (script plugins)
  README.md                what it is for
tools/check-licences.mjs   every plugin declares the repo's licence
tools/release.mjs          packs every plugin and writes releases.json
dist/                      packed .wbplugin files + releases.json (gitignored)
```

Plugin ids here are **namespaced** (`wirebench.design-report`). Bare ids are
reserved for the plugins that ship inside the app, and wirebench's own test
suite asserts that.

## Using one

```console
$ pip install -e ../wirebench/python          # the SDK
$ wirebench-plugin pack plugins/design-report -o dist/design-report.wbplugin
```

Then in wirebench: **Preferences ▸ Plugins ▸ Install a plugin…** and pick the
file. On the desktop, wirebench itself reads it and tells you what it is —
name, version, licence, what it may do — before anything is written.

## Writing one

`wirebench-plugin new plugins/my-plugin` gives you a working plugin; the
authoring guide is wirebench `docs/plugin-authoring.md`, and
`docs/plugins.md` is the reference for the contracts. Two house rules on top
of it:

- **Declare the repo's licence** in the manifest and carry the notice in every
  Python file. `node tools/check-licences.mjs` enforces both.
- **Ask for nothing you do not need.** `scopes` is a ceiling the app enforces,
  and it is shown to the user before they install. `design-report` asks for
  nothing at all, because reading a project is free.

## The tool plugins, and the app's copies of them

`freerouting`, `arduino-cli` and `avr-gcc` are here **and** in wirebench's
catalog, and the two are one declaration. The catalog's copy (MIT, the app's
own text) is the baseline in the box, so a fresh install finds a program you
already have without fetching anything. The copy here (GPL, `wirebench.*`,
`supersedes` naming the built-in row) is the one that moves between app
releases: each catalog manifest carries a `release` pointer — this
repository's release URL, the file's sha256 and the **content hash** — and
*Install the published copy* in Preferences ▸ Plugins fetches it against
that pin and lets it stand in for the built-in row. A copy is first-party
only when its content matches what a wirebench build pins; a `wirebench.*`
bundle from anywhere else is refused, because an id in that namespace is a
claim to be ours.

They carry the **reserved keys** that name code paths inside wirebench
(`post`, `candidates`, `pref`, `configFile`, `progress`, `supersedes`), so
they validate with `wirebench-plugin validate --first-party`. Nothing else in
this repository may use them.

## Releasing

```console
$ node tools/release.mjs        # dist/*.wbplugin + dist/releases.json
$ git tag v2026.08.28 && git push origin v2026.08.28
```

The tag runs `.github/workflows/release.yml`, which packs with the same
tool and attaches every `.wbplugin` and `releases.json` to a GitHub release.
The content hashes in `releases.json` are what a wirebench build copies into
its catalog's `release` pointers — `plugin-catalog.test.ts` over there
recomputes them from this checkout and fails when they drift.

## What is not here yet

**Anything binary.** A `.wbplugin` is one JSON document with its files base64
and decoded as text, capped at 10 MB. That is a deliberate security property —
no archive means no absolute members, no `..`, no symlinks, no zip-slip — so a
plugin here is source, JSON and project files, never a compiled anything.
