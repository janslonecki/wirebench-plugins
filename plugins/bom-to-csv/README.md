# BOM to supplier CSV

Exports the open project's bill of materials as a CSV with the column names
and the column *order* one distributor expects, so the file can be pasted
into their upload form without being rearranged first.

Both suppliers want the same facts under different headings, which is the
whole reason this is a plugin and not a menu item: the next supplier is
somebody else's fifteen lines, not a pull request against wirebench.

## Permissions

**None.** Reading the project — and asking wirebench for its BOM — costs no
consent. The install screen will say it asks for nothing, and that is not a
simplification.

## Settings

| Setting | Default | What it does |
|---|---|---|
| Supplier column order | `mouser` | Which distributor's headings and order to write. `mouser` or `digikey`. |

## Where it lands

The `download` sink — wirebench hands you `bom-<supplier>.csv` through the
normal save path. It writes nothing into your project.

## History

This one used to ship *inside* wirebench, as the worked example of a script
plugin. It moved here on 2026-08-29, when the app stopped bundling plugins
altogether: everything wirebench publishes now arrives the same way, through
Preferences ▸ Plugins, and can be uninstalled for good. Moving it across the
distribution boundary is what changed its licence from MIT to GPL — the rule
in the repository README, applied to itself.
