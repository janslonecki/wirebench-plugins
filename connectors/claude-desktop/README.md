# WireBench for Claude Desktop

Build `dist/wirebench.mcpb` with `python3 tools/build-mcpb.py`. Install it through
Claude Desktop's desktop-extension settings. In WireBench, open Assistant →
External assistants, enable local MCP, and pair a client named Claude Desktop.
Copy the displayed URL and pairing token into this extension's settings.

Start a draft for this paired client in WireBench. Ask Claude to use
`wirebench_status`, construct and verify the draft, then `wirebench_finish`.
Review and accept in WireBench. Claude owns its sign-in, model selection,
usage limits and billing; this extension does not sign in to Anthropic.

The bundled Node transport talks only to the configured loopback MCP endpoint.
It has no engineering tools or project access of its own. It forwards MCP JSON
and image results without executing provider code or a native toolchain.
WireBench must remain running. Stop preserves completed calls; retry the same
operation ID after a disconnect. Resume in WireBench grants another call/time
budget. Revoke a pairing in WireBench to remove this extension's access.

This is a separate GPL distribution with the repository's §7 permission. It
is not bundled into WireBench and does not require a Python runtime for use.
Python is only used to create the ZIP archive during development.
