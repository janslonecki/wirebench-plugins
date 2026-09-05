// Copyright (C) 2026 wirebench. SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software under GNU GPL version 3 or later, without
// any warranty. See LICENSE and https://www.gnu.org/licenses/.
// Additional permission under GNU GPL version 3 section 7: the licensors
// permit conveying this work combined with wirebench, including modified
// versions covered by wirebench's licence. See EXCEPTION.md.

/** llm/1 adapter. No fetch, keys, filesystem, or project handle. */
export function encode(request) {
  const input = [{ role: "user", content: request.prompt }];
  for (const turn of request.turns) {
    input.push(...turn.continuation);
    for (const result of turn.results) {
      input.push({ type: "function_call_output", call_id: result.id, output: result.content });
      if (result.images?.length) input.push({ role: "user", content: result.images.flatMap(image => [{ type: "input_text", text: `Draft page: ${image.name}` }, { type: "input_image", image_url: `data:${image.mimeType};base64,${image.data}`, detail: "high" }]) });
    }
  }
  return {
    model: request.model, instructions: request.system, input, stream: true, store: false,
    include: ["reasoning.encrypted_content"], max_output_tokens: request.maxOutputTokens,
    parallel_tool_calls: false,
    tools: request.tools.map(tool => ({ type: "function", ...tool, strict: true })),
  };
}

export function decoder() {
  let response;
  return {
    push(data) {
      if (data === "[DONE]") return;
      const e = JSON.parse(data);
      if (["error", "response.failed", "response.incomplete"].includes(e.type)) throw new Error(`OpenAI response did not complete: ${e.type}`);
      if (e.type === "response.completed") response = e.response;
      if (e.type === "response.output_text.delta") return e.delta;
    },
    finish() {
      if (!response || response.status !== "completed" || !Array.isArray(response.output)) throw new Error("OpenAI stream ended before a completed response");
      const calls = response.output.filter(o => o.type === "function_call").map(o => ({ id: o.call_id, name: o.name, arguments: JSON.parse(o.arguments) }));
      const text = response.output.filter(o => o.type === "message").flatMap(o => o.content ?? []).map(c => c.type === "output_text" ? c.text : c.type === "refusal" ? c.refusal : "").join("\n");
      return { text, calls, continuation: response.output, usage: { input: response.usage?.input_tokens ?? 0, output: response.usage?.output_tokens ?? 0 } };
    },
  };
}
