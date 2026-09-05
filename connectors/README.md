# Connect your assistant to WireBench

In a desktop build with local MCP support, open **Assistant → External
assistants → Enable local MCP**. Pair a separate client for each application.
Copy the displayed URL and token into the client configuration below, replacing
`PORT` and `PAIRING_TOKEN`. The token authorizes only drafts you start for that
client. Keep it private; revoke it from WireBench to disconnect the client.

Start a draft in WireBench, then ask your client:

> Use wirebench_status to read my authorized draft and brief. Discover the wb
> functions you need, build the project, commit, verify with numeric assertions
> in a fresh call, render the pages, and finish for my review. Use a unique
> operation_id for each call; reuse it only when retrying the same call.

Your assistant application owns sign-in and model choice. Use whatever account
and plan it supports. WireBench neither imports its credentials nor reuses a
subscription as an API key. API-key providers remain available inside WireBench.

## Claude Desktop

Build the [desktop extension](claude-desktop/README.md) with
`python3 tools/build-mcpb.py`, or obtain `wirebench.mcpb` from a compatible
release. Install it in Claude Desktop's desktop-extension settings and fill
in the URL and pairing token. Its Node runtime is supplied by the client;
Python is not required to run the extension.

[Official extension format](https://github.com/anthropics/mcpb/blob/main/MANIFEST.md).

## Claude Code

Add a local HTTP server to your MCP configuration (`.mcp.json` for a project,
or your client-managed user configuration). Do not commit the pairing token.

```json
{
  "mcpServers": {
    "wirebench": {
      "type": "http",
      "url": "http://127.0.0.1:PORT/mcp",
      "headers": { "Authorization": "Bearer PAIRING_TOKEN" }
    }
  }
}
```

[Claude Code MCP documentation](https://code.claude.com/docs/en/mcp).

## Codex / ChatGPT desktop client with local MCP support

For Codex, add this to your user `config.toml`:

```toml
[mcp_servers.wirebench]
url = "http://127.0.0.1:PORT/mcp"
http_headers = { Authorization = "Bearer PAIRING_TOKEN" }
tool_timeout_sec = 90
```

Alternatively use `bearer_token_env_var = "WIREBENCH_MCP_TOKEN"` and make
that environment variable available to the client. The value is the pairing
token alone. Sign in to Codex using its supported account flow. The local
transport does not require a WireBench OAuth application or provider approval.
A desktop client must explicitly support local MCP; a browser or cloud-only
ChatGPT connector cannot reach this loopback URL.

[Official MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

## Gemini CLI

Add to your user `.gemini/settings.json`:

```json
{
  "mcpServers": {
    "wirebench": {
      "httpUrl": "http://127.0.0.1:PORT/mcp",
      "headers": { "Authorization": "Bearer PAIRING_TOKEN" },
      "timeout": 90000
    }
  }
}
```

Keep the client's normal tool approval settings. Authenticate and choose a
model in Gemini CLI. [Official MCP configuration](https://geminicli.com/docs/tools/mcp-server/).

## Recovery and limits

Keep WireBench open. The server is loopback-only and rejects browser origins.
One API or external session may write at a time. A session allows 500 new tool
calls and 20 minutes; Resume in WireBench renews that budget. Completed calls
are saved with the draft and returned unchanged when their operation ID is
retried. Interrupted, unsaved work is discarded. Stop pauses new operations;
revoking a pairing also blocks reading old receipts. Only WireBench's review
screen can accept the draft into the original project.

The transport and codec fixtures are automated tests. Live account eligibility
and open-ended engineering quality need verification with each actual client
and account; protocol tests do not establish model quality.
