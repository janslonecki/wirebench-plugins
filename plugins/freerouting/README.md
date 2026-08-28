# freerouting

Board autorouting for wirebench, through [freerouting](https://www.freerouting.app)
— a separate program, run in its own process over the Specctra DSN/SES
exchange. This plugin is the *declaration*: how to find freerouting, how to
run it, and where wirebench may fetch it from (the freerouting project's own
release page, plus an Eclipse Temurin JRE to run the jar), each file pinned by
checksum. **Nothing here is freerouting itself**, and wirebench neither
bundles it nor is part of it.

## What you get

- The *Board autorouting* row in Preferences ▸ Plugins: detection, *Set up*
  (a download from the authors' release host, with the licence named
  first), Browse… for a copy you already have, and the version check.
- *Autoroute with freerouting* (⌘K), which writes the active board page as a
  DSN, runs the router headless, and lands the session in the
  review-then-apply dialog — one undo step, adds only.
- The knobs under Preferences ▸ Autorouting.

## Licences

The plugin is GPL-3.0-or-later with the linking exception in
[EXCEPTION.md](../../EXCEPTION.md). freerouting is GPL-3.0; the Temurin JRE
is GPL-2.0 with the Classpath Exception. Both are obtained by you, from their
authors, under their licences — wirebench conveys neither.

## Why this exists alongside the copy in the app

wirebench ships the same declaration in its catalog (MIT, its own text), so a
fresh install can find a freerouting you already have without fetching
anything. This published copy is the one that moves *between* app releases:
a wirebench build pins the version it was tested with, and installing it
replaces the built-in row. It is first-party only when its content matches
what your wirebench pins — a bundle with this id from anywhere else is
refused, because it would be asking for wirebench's own integration
privileges.
