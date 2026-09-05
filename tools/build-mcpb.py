#!/usr/bin/env python3
"""Build a reproducible MCPB archive using the Python standard library."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
root = Path(__file__).resolve().parent.parent
source = root / "connectors" / "claude-desktop"
files = {p.name: p.read_bytes() for p in source.iterdir() if p.is_file()}
files.update({name: (root / name).read_bytes() for name in ("LICENSE", "EXCEPTION.md")})
out = root / "dist" / "wirebench.mcpb"
out.parent.mkdir(exist_ok=True)
with ZipFile(out, "w", compression=ZIP_DEFLATED) as archive:
    for name, data in sorted(files.items()):
        info = ZipInfo(name, (2026, 9, 5, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, data)
print(out)
