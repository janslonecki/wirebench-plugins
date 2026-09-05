// Copyright (C) 2026 wirebench. SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software under GNU GPL version 3 or later, without
// any warranty. See LICENSE and https://www.gnu.org/licenses/.
// Additional permission under GNU GPL version 3 section 7: the licensors
// permit conveying this work combined with wirebench, including modified
// versions covered by wirebench's licence. See EXCEPTION.md.

/** llm/1 adapter. Continuations retain signed thinking blocks verbatim. */
export function encode(request) {
  const messages = [{ role: "user", content: request.prompt }];
  for (const turn of request.turns) {
    messages.push({ role: "assistant", content: turn.continuation });
    if (turn.results.length) messages.push({ role: "user", content: turn.results.map(r => ({ type: "tool_result", tool_use_id: r.id, content: r.images?.length ? [{ type: "text", text: r.content }, ...r.images.flatMap(image => [{ type: "text", text: `Draft page: ${image.name}` }, { type: "image", source: { type: "base64", media_type: image.mimeType, data: image.data } }])] : r.content })) });
  }
  return { model: request.model, system: request.system, messages, stream: true, max_tokens: request.maxOutputTokens,
    tools: request.tools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters, strict: true })),
  };
}
export function decoder() {
  const blocks = [], json = new Map(), closed = new Set();
  let complete = false, reason, input = 0, output = 0;
  return {
    push(data) {
      const e = JSON.parse(data);
      if (e.type === "error") throw new Error("Anthropic returned a stream error");
      if (e.type === "message_start") {
        input = (e.message.usage?.input_tokens ?? 0) + (e.message.usage?.cache_read_input_tokens ?? 0) + (e.message.usage?.cache_creation_input_tokens ?? 0);
        output = e.message.usage?.output_tokens ?? 0;
      }
      if (e.type === "content_block_start") { blocks[e.index] = structuredClone(e.content_block); if (e.content_block.type === "tool_use") json.set(e.index, ""); }
      if (e.type === "content_block_delta") {
        const b = blocks[e.index], d = e.delta;
        if (!b || closed.has(e.index)) throw new Error("Malformed Anthropic content stream");
        if (d.type === "text_delta") { b.text += d.text; return d.text; }
        if (d.type === "input_json_delta") json.set(e.index, (json.get(e.index) ?? "") + d.partial_json);
        if (d.type === "thinking_delta") b.thinking += d.thinking;
        if (d.type === "signature_delta") b.signature = (b.signature ?? "") + d.signature;
      }
      if (e.type === "content_block_stop") {
        if (json.get(e.index)) blocks[e.index].input = JSON.parse(json.get(e.index));
        closed.add(e.index);
      }
      if (e.type === "message_delta") { reason = e.delta.stop_reason; output = e.usage?.output_tokens ?? output; }
      if (e.type === "message_stop") complete = true;
    },
    finish() {
      if (!complete || !["end_turn", "tool_use", "stop_sequence"].includes(reason) || blocks.some((_, i) => !closed.has(i))) throw new Error("Anthropic stream ended without a complete message");
      return { text: blocks.filter(b => b.type === "text").map(b => b.text).join("\n"),
        calls: blocks.filter(b => b.type === "tool_use").map(b => ({ id: b.id, name: b.name, arguments: b.input })),
        continuation: blocks, usage: { input, output } };
    },
  };
}
