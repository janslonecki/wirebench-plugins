// Copyright (C) 2026 wirebench. SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software under GNU GPL version 3 or later, without
// any warranty. See LICENSE and https://www.gnu.org/licenses/.
// Additional permission under GNU GPL version 3 section 7: the licensors
// permit conveying this work combined with wirebench, including modified
// versions covered by wirebench's licence. See EXCEPTION.md.

// A stdio/HTTP transport adapter only. WireBench owns tools and permissions.
import { StringDecoder } from "node:string_decoder";
let url;
try {
  url = new URL(process.env.WIREBENCH_MCP_URL);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port || url.pathname !== "/mcp" || url.search || url.hash || url.username || url.password) throw new Error();
  if (!/^[a-f0-9]{64}$/.test(process.env.WIREBENCH_MCP_TOKEN ?? "")) throw new Error();
} catch { console.error("Configure the local MCP URL and pairing token from WireBench Assistant."); process.exit(1); }
let version, pending = "", active = 0;
const decoder = new StringDecoder("utf8"), aborts = new Set();
const send = value => process.stdout.write(JSON.stringify(value) + "\n");
async function forward(message) {
  const hasId = Object.hasOwn(message, "id");
  const fail = text => { if (hasId) send({ jsonrpc: "2.0", id: message.id, error: { code: -32000, message: text } }); };
  if (active >= 16) { fail("Too many concurrent WireBench calls"); return; }
  active++;
  const abort = new AbortController(); aborts.add(abort);
  const timer = setTimeout(() => abort.abort(), 90000);
  try {
    const response = await fetch(url, { method: "POST", redirect: "error", signal: abort.signal,
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", Authorization: `Bearer ${process.env.WIREBENCH_MCP_TOKEN}`, ...(version ? { "MCP-Protocol-Version": version } : {}) }, body: JSON.stringify(message) });
    if (response.status === 202 && !hasId) return;
    if (!response.ok) { await response.body?.cancel(); fail(`WireBench MCP HTTP ${response.status}. Check pairing and the running desktop app.`); return; }
    if (!response.headers.get("content-type")?.includes("application/json")) throw new Error();
    const chunks = []; let bytes = 0;
    for await (const chunk of response.body) { bytes += chunk.length; if (bytes > 64 * 1024 * 1024) throw new Error(); chunks.push(chunk); }
    const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (result.jsonrpc !== "2.0" || !hasId || result.id !== message.id) throw new Error();
    if (message.method === "initialize" && typeof result.result?.protocolVersion === "string") version = result.result.protocolVersion;
    send(result);
  } catch { fail("WireBench connection interrupted. Keep the draft_id and retry with the same operation_id; WireBench returns saved receipts without repeating edits."); }
  finally { clearTimeout(timer); aborts.delete(abort); active--; }
}
process.stdin.on("data", chunk => {
  pending += decoder.write(chunk);
  let end;
  while ((end = pending.indexOf("\n")) >= 0) {
    const line = pending.slice(0, end); pending = pending.slice(end + 1);
    if (Buffer.byteLength(line) > 1024 * 1024) { console.error("MCP input exceeds the limit"); process.exit(1); }
    if (!line.trim()) continue;
    try {
      const message = JSON.parse(line);
      if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string" || Array.isArray(message)) throw new Error();
      void forward(message);
    } catch { send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Invalid MCP JSON request" } }); }
  }
  if (Buffer.byteLength(pending) > 1024 * 1024) { console.error("MCP input exceeds the limit"); process.exit(1); }
});
process.stdin.on("end", () => { for (const abort of aborts) abort.abort(); });
