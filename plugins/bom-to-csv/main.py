# BOM to supplier CSV, a wirebench plugin.
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

# Export the project's BOM as a supplier-ready CSV.
#
# The worked example of a script plugin. It is an ordinary wirebench script:
# paste the body of `export_bom` into the script bench and press Run and it
# does the same thing. That is the authoring loop — prototype in the bench,
# then wrap it — so nothing here is plugin-only magic.
#
# The one plugin-shaped thing is the ending: the function RETURNS, and the
# manifest says where the value goes ("sink": "download"). There is no
# wb.download to call, and a script still never sees a path.

import wb
import json

# Column order per supplier. Both want the same facts under different names,
# which is the whole reason this is a plugin and not a menu item: the next
# supplier is somebody else's fifteen lines, not our pull request.
COLUMNS = {
    "mouser": ["Mouser Part Number", "Quantity", "Description", "Designators"],
    "digikey": ["Digi-Key Part Number", "Quantity", "Description", "Reference"],
}


def _csv_cell(value):
    text = "" if value is None else str(value)
    # Quote when the cell would otherwise break the row apart. Doubling the
    # quote is CSV's own escape, not an approximation of one.
    if any(ch in text for ch in [",", '"', "\n", "\r"]):
        return '"' + text.replace('"', '""') + '"'
    return text


async def export_bom(settings):
    supplier = settings.get("supplier", "mouser")
    header = COLUMNS.get(supplier, COLUMNS["mouser"])

    # wb.export is free — reading the user's own document costs no consent
    # (docs/scripting-v4.md §6). The BOM builder is the same one the File menu
    # and `wb pcb export bom` drive, so all three agree byte for byte.
    result = json.loads(await wb.export("bom"))
    files = result.get("files", [])
    if not files:
        return None

    rows = []
    for line in _parse(files[0].get("text", "")):
        rows.append(
            [
                line.get("part", ""),
                line.get("qty", ""),
                line.get("value", ""),
                line.get("refs", ""),
            ]
        )

    if not rows:
        # An empty BOM: say so in a way the run strip can show, rather than
        # handing the user an empty file they have to open to discover that.
        # Parts WITHOUT a part number are still exported, with that cell
        # blank -- a BOM that silently dropped them would be worse than one
        # with gaps in it, because the gaps are the thing to go and fill in.
        print("This project has no parts to list.")
        return None

    out = [",".join(_csv_cell(c) for c in header)]
    out.extend(",".join(_csv_cell(c) for c in row) for row in rows)
    return ("bom-" + supplier + ".csv", "\n".join(out) + "\n")


def _parse(text):
    """The app's BOM CSV back into records.

    Deliberately tolerant: a column that moves should degrade to a blank cell
    rather than a traceback, because the interesting failure for a user is
    "my part numbers are missing", not "line 41 raised IndexError".
    """
    # The app's BOM opens with a "#" attribution line, so the header is the
    # first line that is not a comment -- not simply the first line.
    lines = [ln for ln in text.splitlines() if ln.strip() and not ln.lstrip().startswith("#")]
    if not lines:
        return []
    head = [h.strip().strip('"').lower() for h in lines[0].split(",")]

    def index_of(*names):
        for name in names:
            if name in head:
                return head.index(name)
        return None

    idx = {
        "refs": index_of("references", "designators", "refs"),
        "value": index_of("value", "description"),
        "qty": index_of("quantity", "qty"),
        "part": index_of("mpn", "part", "part number"),
    }
    records = []
    for ln in lines[1:]:
        cells = _split_row(ln)
        rec = {}
        for key, at in idx.items():
            rec[key] = cells[at].strip() if at is not None and at < len(cells) else ""
        records.append(rec)
    return records


def _split_row(line):
    cells, cur, quoted = [], "", False
    i = 0
    while i < len(line):
        ch = line[i]
        if quoted:
            if ch == '"':
                if i + 1 < len(line) and line[i + 1] == '"':
                    cur += '"'
                    i += 1
                else:
                    quoted = False
            else:
                cur += ch
        elif ch == '"':
            quoted = True
        elif ch == ",":
            cells.append(cur)
            cur = ""
        else:
            cur += ch
        i += 1
    cells.append(cur)
    return cells
