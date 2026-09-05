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
tools/release.mjs          packs every plugin, writes releases.json, signs it
releases.json              the index a wirebench build updates from (tracked)
releases.json.sig          its Ed25519 signature (tracked)
release-key.pub            the public half of the maintainer's release key
dist/                      packed .wbplugin files (gitignored — output)
```

Plugin ids here are **namespaced** (`wirebench.design-report`). Bare ids are
reserved for the plugins that ship inside the app, and wirebench's own test
suite asserts that.

## Using one

```console
$ pip install -e ../wirebench/python          # the SDK
$ wirebench-plugin pack plugins/design-report -o dist/design-report.wbplugin
```

Then in the wirebench desktop app: **Preferences ▸ Plugins ▸ Install a
plugin…** and pick the file. wirebench itself reads it and tells you what it is
— name, version, licence, what it may do — before anything is written.

You rarely need the file at all: everything this repository releases is
listed under **Available from wirebench** in that same pane, found by the
search box at its top, and installed with one click from the signed index —
fetched from this repository's release, checked against the index's hashes,
and confirmed in the app's own dialog first. Plugins are a desktop feature;
the web build has none.

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

Once, ever — the maintainer's release key:

```console
$ node tools/release.mjs keygen
private key: ~/.config/wirebench/release.key   (0600, outside every repository)
public key:  release-key.pub                   (committed)
```

Back that private key up somewhere safe and paste the public half into
wirebench's `electron/releaseKey.cjs`. It never enters this repository and
never enters CI — CI only *verifies*, so a compromise of these Actions cannot
publish something a wirebench build will install by itself.

Then, per release:

```console
$ node tools/release.mjs        # dist/*.wbplugin + releases.json
$ node tools/release.mjs sign   # releases.json.sig
$ git add releases.json releases.json.sig && git commit -m "Release ..."
$ git tag v2026.08.29 && git push origin v2026.08.29
```

The tag runs `.github/workflows/release.yml`, which packs with the same tool,
runs `--check` (refusing a stale index, a missing signature, or one that does
not verify), and attaches every `.wbplugin` plus `releases.json` and its
signature to a GitHub release.

`releases.json` does three jobs. Its content hashes are what a wirebench build
copies into its catalog's `release` pointers — `plugin-catalog.test.ts` over
there recomputes them from this checkout and fails when they drift. The
*signed* copy is what an installed wirebench reads at launch to find out that
a newer version of one of these plugins exists: the signature is what lets it
believe a file it did not ship, which matters because that file lands in the
user's profile, where a plugin could otherwise write one naming its own hash.
And it is the list Preferences ▸ Plugins searches: each entry carries the
manifest's `name`, `summary`, `kind`, `author` and `homepage`, so the pane
can say what a plugin is without downloading it — the app bounds those fields
and `tools/release.mjs` refuses the same bounds before a release is cut.

**Bump the version when you change a plugin.** A re-cut under the same version
is deliberately never applied as an update by the app — "the version did not
change" is the one promise a version number makes.

## What is not here yet

**Anything binary.** A `.wbplugin` is one JSON document with its files base64
and decoded as text, capped at 10 MB. That is a deliberate security property —
no archive means no absolute members, no `..`, no symlinks, no zip-slip — so a
plugin here is source, JSON and project files, never a compiled anything.

## Assistant providers

`plugins/openai`, `plugins/anthropic` and `plugins/gemini` implement the desktop assistant's
`llm/1` protocol. They run only after Generate or Resume, transform provider
messages in isolated workers, and never receive API keys or a project handle.
wirebench owns the authenticated HTTP request, engineering tools and draft
review. Test the codecs with `node --test tools/test-llm.mjs`; the app repository
contains an Electron fixture test covering all three providers, local MCP and real Python
execution. Provider usage charges belong to the user's own API account.


## External clients

[Client setup](connectors/README.md) covers Claude Desktop/Code, Codex and Gemini CLI.
The separate Claude Desktop MCPB extension forwards requests to WireBench’s local
MCP listener. Build it with `python3 tools/build-mcpb.py`; no Python is needed at
runtime. Ship a compatible WireBench desktop build before publishing Gemini or
the extension. They are separate downloads, never bundled into the app.
