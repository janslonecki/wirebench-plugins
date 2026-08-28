# Design report, a wirebench plugin.
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

# Design report — a Markdown summary of the project, for a design review.
#
# An ordinary wirebench script: paste the body of `report` into the script
# bench and press Run and it does the same thing. The one plugin-shaped part
# is the ending — the function RETURNS, and the manifest says the value goes
# to the download sink.
#
# It asks for **no capabilities at all**. Everything here is a read, and
# reading your own project is free (docs/scripting-v4.md §6: consent is for
# writing the document, driving the window and installing software, never for
# spending your CPU). A plugin that wants nothing should say so, and the
# install screen then says so for it.

import wb
import json

# What to count as a "part" for the summary. Wires and junctions are
# structure, not bill-of-materials, and listing them buries the real content.
STRUCTURAL = ("wire", "junction", "label", "netclassflag", "designrule", "text")


def _rows(text):
    """The tab-separated line formats wb's read verbs return, as lists.

    Deliberately tolerant of trailing blank lines and of a column that moves:
    the interesting failure for a user is a section that reads oddly, not a
    traceback halfway through their report.
    """
    out = []
    for line in (text or "").split("\n"):
        if line.strip():
            out.append(line.split("\t"))
    return out


def _tally(pairs):
    """Count by key, preserving first-seen order (MicroPython has no Counter)."""
    order, counts = [], {}
    for key in pairs:
        if key not in counts:
            order.append(key)
            counts[key] = 0
        counts[key] += 1
    return [(k, counts[k]) for k in order]


def _anonymous(token):
    """Whether a net token is bookkeeping rather than a name."""
    if not token:
        return True
    if token.isdigit():          # "0" is ground; "2" is an unnamed node
        return True
    return token[0] == "n" and token[1:].isdigit()   # the nN form


def _table(header, rows):
    if not rows:
        return []
    out = ["| " + " | ".join(header) + " |", "|" + "|".join(["---"] * len(header)) + "|"]
    for row in rows:
        out.append("| " + " | ".join(str(c) for c in row) + " |")
    out.append("")
    return out


async def report(settings):
    lines = ["# Design report", ""]

    # --- Pages -------------------------------------------------------------
    pages = _rows(wb.doc_pages())
    lines.append("## Pages")
    lines.append("")
    lines.extend(
        _table(
            ["Page", "Role", "Elements"],
            [(p[0], p[1] if len(p) > 1 else "", p[2] if len(p) > 2 else "") for p in pages],
        )
    )

    # --- Parts -------------------------------------------------------------
    elements = _rows(wb.doc_elements())
    parts = [e for e in elements if e[1] not in STRUCTURAL] if elements else []
    lines.append("## Parts")
    lines.append("")
    lines.append(
        "%d part%s across %d page%s."
        % (len(parts), "" if len(parts) == 1 else "s", len(pages), "" if len(pages) == 1 else "s")
    )
    lines.append("")
    lines.extend(_table(["Type", "Count"], _tally([p[1] for p in parts])))

    if settings.get("list-parts"):
        rows = []
        for p in parts:
            label = p[2] if len(p) > 2 and p[2] else "—"
            page = p[3] if len(p) > 3 and p[3] else "—"
            rows.append((label, p[1], page))
        # Sorted by designator so the reader can find a part they are holding.
        rows.sort(key=lambda r: r[0])
        lines.append("### Every part")
        lines.append("")
        lines.extend(_table(["Designator", "Type", "Page"], rows))

    # --- Nets --------------------------------------------------------------
    nets = _rows(wb.nets())
    # A net is "named" when a person gave it one. wb.nets() addresses nets by
    # their SPICE node token, which is the label where there is one and
    # otherwise a bare number ("0" is ground) or "nN" -- both of those are
    # netlist bookkeeping, and a big circuit has hundreds of them.
    named = [n for n in nets if n and not _anonymous(n[0])]
    lines.append("## Nets")
    lines.append("")
    lines.append(
        "%d net%s, %d of them named."
        % (len(nets), "" if len(nets) == 1 else "s", len(named))
    )
    lines.append("")
    # Named nets are the ones a person chose, so they are the ones worth
    # listing; the anonymous nN nets are an implementation detail of the
    # netlist and there can be hundreds.
    lines.extend(
        _table(["Net", "Connections"], [(n[0], n[1] if len(n) > 1 else "") for n in named])
    )

    # --- Rule check --------------------------------------------------------
    lines.append("## Electrical rule check")
    lines.append("")
    findings = _rows(wb.erc("doc"))
    if not findings:
        lines.append("No findings.")
        lines.append("")
    else:
        errors = [f for f in findings if len(f) > 1 and f[1] == "error"]
        lines.append(
            "%d finding%s, %d of them error%s."
            % (
                len(findings),
                "" if len(findings) == 1 else "s",
                len(errors),
                "" if len(errors) == 1 else "s",
            )
        )
        lines.append("")
        lines.extend(
            _table(
                ["Rule", "Severity", "Element", "Net"],
                [
                    (
                        f[0],
                        f[1] if len(f) > 1 else "",
                        f[2] if len(f) > 2 else "",
                        f[3] if len(f) > 3 else "",
                    )
                    for f in findings
                ],
            )
        )

    # --- Bill of materials -------------------------------------------------
    if settings.get("include-bom"):
        result = json.loads(await wb.export("bom"))
        files = result.get("files", [])
        if files:
            lines.append("## Bill of materials")
            lines.append("")
            lines.append("```csv")
            lines.append(files[0].get("text", "").strip())
            lines.append("```")
            lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("Generated by the design-report plugin. Values are the project's own;")
    lines.append("verify anything you are about to order or manufacture from.")
    lines.append("")

    return ("design-report.md", "\n".join(lines))
