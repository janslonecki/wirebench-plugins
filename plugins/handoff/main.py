# Handoff package, a wirebench plugin.
# Copyright (C) 2026 wirebench
#
# This program is free software: you can redistribute it and/or modify it
# under the terms of the GNU General Public License as published by the Free
# Software Foundation, either version 3 of the License, or (at your option)
# any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU
# General Public License for more details. You should have received a copy
# along with it; if not, see <https://www.gnu.org/licenses/>.
#
# Additional permission under GNU GPL version 3 section 7: if you modify this
# program, or any covered work, by linking or combining it with wirebench (or
# a modified version of wirebench), containing parts covered by the terms of
# wirebench's licence, the licensors of this program grant you additional
# permission to convey the resulting work. See EXCEPTION.md.

# Export everything a handoff needs, as one zip.
#
# The roadmap called this a "jobset": one saved, ordered list over the export
# registry, run in a batch. docs/pivot.md says where a whole specialised
# workflow lands — in `wb`, as a script somebody can read and change, before
# it is ever a panel — and this is that script. Every document it writes comes
# from the same `wb.export` the File menu and `wirebench export` drive, so all
# three produce identical bytes; what this adds is the *list*, the gate, and
# the packaging.
#
# It is an ordinary wirebench script. Paste `handoff`'s body into the script
# bench and press Run and it does the same thing. The one plugin-shaped part
# is the ending: the function RETURNS, and the manifest says where the value
# goes ("sink": "bundle"). There is no wb.download to call and a script never
# sees a path.

import wb
import json

# The eleven the default list names, in the order a recipient reads them:
# what the board IS, then what it is made of, then how to build it.
#
# `wb.export` is deliberately UNGATED — a script author is the gate, and a
# script that wants a Gerber of a board with errors is entitled to one. A
# handoff is different: it is the thing you send to somebody else, so this
# checks by default and says exactly what it found. The setting exists
# because "I know, send it anyway" is a real answer.


async def handoff(settings):
    ids = [s.strip() for s in str(settings.get("formats", "")).split(",") if s.strip()]
    if not ids:
        print("No documents selected. Set `formats` to a comma-separated list of export ids.")
        return None

    known = {line.split("\t")[0] for line in (await wb.export_formats()).splitlines() if line}
    unknown = [i for i in ids if i not in known]
    if unknown:
        # Naming what is available beats "unknown format": the id list is the
        # thing the author needs and it is one call away.
        print("Not export ids: " + ", ".join(unknown))
        print("Available: " + ", ".join(sorted(known)))
        return None

    if settings.get("check", True):
        blocked = await _check()
        if blocked:
            print(blocked)
            print("Fix these, or turn off the check in the plugin's settings.")
            return None

    files = []
    notes = []
    for fmt in ids:
        result = json.loads(await wb.export(fmt))
        for note in result.get("notes", []):
            notes.append(fmt + ": " + note)
        for f in result.get("files", []):
            # A binary member (the PDF) arrives base64 under `b64`. The bundle
            # sink takes text, so a base64 payload would have to be decoded
            # here -- and MicroPython has no `binascii.a2b_base64` in every
            # build. Rather than ship a package that sometimes silently omits
            # the PDF, say so and let the author fetch it from the File menu.
            if "text" in f:
                files.append({"name": f["name"], "text": f["text"]})
            else:
                notes.append(fmt + ": " + f.get("name", "?") + " is binary and is not in the zip")

    if not files:
        print("Nothing to package — every selected document came back empty.")
        return None

    # A manifest of what is in the box, and of what did not make it. A fab
    # reading a folder should not have to guess which files are the order.
    files.append({"name": "MANIFEST.txt", "text": _manifest(ids, files, notes)})

    for n in notes:
        print(n)
    print("Packaged " + str(len(files)) + " file(s).")
    return ("handoff", json.dumps(files))


async def _check():
    """ERC and DRC, as one sentence — or None when both are clean."""
    problems = []

    erc = json.loads(wb.erc())
    erc_errors = [f for f in erc if f.get("severity") == "error"]
    if erc_errors:
        problems.append(str(len(erc_errors)) + " ERC error(s): " + _first(erc_errors))

    drc = json.loads(await wb.drc())
    drc_errors = [f for f in drc if f.get("severity") == "error"]
    if drc_errors:
        problems.append(str(len(drc_errors)) + " DRC error(s): " + _first(drc_errors))

    return "; ".join(problems) if problems else None


def _first(findings):
    """The first two, named. A count alone tells nobody where to look."""
    shown = [str(f.get("message") or f.get("rule") or "?") for f in findings[:2]]
    return ", ".join(shown) + ("…" if len(findings) > 2 else "")


def _manifest(ids, files, notes):
    lines = ["wirebench handoff package", ""]
    lines.append("Documents requested: " + ", ".join(ids))
    lines.append("")
    lines.append("Contents:")
    for f in files:
        lines.append("  " + f["name"])
    if notes:
        lines.append("")
        lines.append("Notes:")
        for n in notes:
            lines.append("  " + n)
    lines.append("")
    return "\n".join(lines)
