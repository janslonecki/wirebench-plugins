# Contributing

## The licence, and why it is not negotiable here

Everything in this repository is **GPL-3.0-or-later with the linking exception
in [EXCEPTION.md](EXCEPTION.md)**. A contribution under any other licence
cannot be merged, and `node tools/check-licences.mjs` fails the build rather
than leaving it to review.

By opening a pull request you certify the
[Developer Certificate of Origin](https://developercertificate.org/) — that
you wrote the contribution or have the right to submit it under this licence.
Sign off your commits:

```console
$ git commit -s
```

There is no CLA, and that has a consequence worth knowing before you spend an
afternoon on something.

## A contributed plugin stays here

We ask for a DCO rather than copyright assignment, which means contributors
keep their copyright. That is the right trade — a CLA is a real cost to ask of
someone donating a plugin — but it fixes where a contributed plugin can live:

**A plugin with outside contributions can never move into wirebench's own
catalog.** The catalog is bundled into a proprietary application; bundling
somebody else's GPL code into it is the combination question the exception
exists to avoid having, and we could not relicense their work to sidestep it.

So: plugins here are published as files, for good. If you want to propose
something that ships *inside* the app, say so in the issue first — that is a
different repository, a different licence, and a conversation about
maintenance rather than a pull request.

## What a plugin needs before it is merged

- `wirebench-plugin validate plugins/<name>` passes.
- The manifest declares `"licence": "GPL-3.0-or-later"` and a **namespaced**
  id. Bare ids belong to the plugins that ship inside the app, and the
  `wirebench.*` namespace to the plugins wirebench itself publishes — a
  contributed plugin is `you.thing`, and carries none of the reserved keys
  (`supersedes`, `pref`, `post`, …) that only a wirebench-pinned copy may.
- Every Python file carries the licence header, including the §7 paragraph.
  A file that travels on its own has to say what it is.
- A `README.md` saying what it is for, in the voice of somebody deciding
  whether to install it rather than somebody who already has.
- `scopes` is the **minimum** it needs. The app enforces the list as a
  ceiling and shows it before install; a plugin that asks for `doc` when it
  only reads is a plugin people decline, correctly.

## What will get a plugin turned down

- **It bundles a binary.** A `.wbplugin` carries text. Beyond the format, a
  plugin that shipped somebody else's GPL toolchain would make this repository
  a distributor of it, with everything §6 attaches to that — see wirebench
  `docs/interop-legal.md` §The plugin umbrella. A plugin may *drive* a tool the
  user has; it may not carry one.
- **It runs on its own.** Nothing here may act on opening a document. An
  action happens because a person picked it by name, and that is enforced on
  the app's side — but do not design around trying.
- **It phones home.** No analytics, no error reporting, no version pings.
  wirebench's telemetry is opt-in and consent-gated; a plugin sneaking past
  that is a plugin that gets removed.

## Testing

`wirebench-plugin validate` catches everything knowable without running: a
script path that escapes the folder, an entry your file never defines, an
entry that is not `async`, an unknown sink or scope.

To know it *works*, install it and press **Run** on its row in
Preferences ▸ Plugins. That button exists for exactly this.
