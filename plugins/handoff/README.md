# Handoff package

Exports everything a fab house, an assembler or a colleague needs from the
open project and hands it back as a single zip — the schematic and board
documents, the fabrication set, and the files that say what the board is made
of, in the order a recipient reads them.

The roadmap called this a "jobset": one saved, ordered list over the export
registry, run as a batch. It is a plugin rather than a menu item because the
list is the part that differs — your fab wants eleven documents, somebody
else's wants four and a different drill format, and that is a setting, not a
pull request against wirebench.

## Permissions

**None.** Reading the project and asking wirebench to export from it costs no
consent, so the install screen will say it asks for nothing.

## Settings

| Setting | Default | What it does |
|---|---|---|
| Documents to include | the eleven below | Comma-separated export ids, in the order they go into the zip. |
| Refuse to build the package when ERC or DRC reports an error | on | Checks before packaging and says what it found. |

The default list is `bom`, `net`, `kicad_sch`, `kicad_pcb`, `pdf`, `gerbers`,
`drill`, `gbrjob`, `compfiles`, `drillmap`, `pos`. An unknown id is named
back to you along with what *is* available, rather than failing as "unknown
format".

The check is on by default because a handoff is the thing you send to
somebody else. `wb.export` itself is deliberately ungated — a script author
is the gate, and a script that wants a Gerber of a board with errors is
entitled to one — so the setting exists for "I know, send it anyway".

## Where it lands

The `bundle` sink. That is not an exception to wirebench's one-file-per-run
cap on downloads; it keeps it — the run still produces one file, and the file
is an archive. Every name inside it is checked segment-wise, because an
archive is where path traversal lives. A malformed entry throws rather than
being dropped: a handoff missing one of its documents is worse than one that
failed loudly.

Every document is written by the same `wb.export` the File menu and
`wirebench export` drive, so all three produce identical bytes. What this
adds is the list, the gate and the packaging.

## History

Written against the `bundle` sink, which exists for it. Published here from
the start — nothing ships inside wirebench any more, so a first-party plugin
is authored in the app's repository and distributed from this one, which is
what puts it under the GPL rather than MIT.
