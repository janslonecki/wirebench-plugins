# Design report

Writes a Markdown summary of the open project — the thing you would otherwise
assemble by hand before a design review, or paste into a pull request when
somebody asks what changed.

It reports:

- **Pages**, with their roles and element counts.
- **Parts**, tallied by type, with wires and junctions left out because they
  are structure rather than content. Optionally every part individually,
  sorted by designator.
- **Nets**, counting all of them but listing only the ones somebody *named* —
  the anonymous node tokens are netlist bookkeeping and a real board has
  hundreds.
- **Electrical rule check** findings, across every schematic page.
- Optionally the **bill of materials**, verbatim, in a fenced block.

## Permissions

**None.** Every call it makes is a read, and reading your own project costs no
consent in wirebench. The install screen will say it asks for nothing, and
that is not a simplification.

## Settings

| Setting | Default | What it does |
|---|---|---|
| List every part individually | off | Adds a table of every part by designator. Useful for review, long for a big board. |
| Append the bill of materials | off | Embeds the BOM CSV in the report. |

## Where it lands

The `download` sink — wirebench hands you `design-report.md` through the
normal save path. It writes nothing into your project.
