import { test } from "node:test";
import assert from "node:assert/strict";
import * as openai from "../plugins/openai/main.mjs";
import * as anthropic from "../plugins/anthropic/main.mjs";
const request = { model: "test-model", system: "system", prompt: "brief", tools: [{ name: "python", description: "Execute draft Python", parameters: { type: "object", properties: { code: { type: "string" } }, required: ["code"], additionalProperties: false } }], maxOutputTokens: 4096, turns: [] };
test("OpenAI preserves reasoning, strict schemas, and tool call ids across turns", () => {
  const d = openai.decoder();
  const continuation = [{ type: "reasoning", encrypted_content: "opaque" }, { type: "function_call", call_id: "call1", name: "python", arguments: '{"code":"assert True"}' }];
  d.push(JSON.stringify({ type: "response.completed", response: { status: "completed", output: continuation, usage: { input_tokens: 12, output_tokens: 8 } } }));
  const reply = d.finish();
  assert.deepEqual(reply.calls, [{ id: "call1", name: "python", arguments: { code: "assert True" } }]);
  const next = openai.encode({ ...request, turns: [{ continuation: reply.continuation, results: [{ id: "call1", content: "ok" }] }] });
  assert.equal(next.store, false);
  assert.equal(next.tools[0].strict, true);
  assert.deepEqual(next.input.slice(1, 3), continuation);
  assert.deepEqual(next.input[3], { type: "function_call_output", call_id: "call1", output: "ok" });
});
test("OpenAI never executes an incomplete or malformed call", () => {
  assert.throws(() => openai.decoder().finish());
  assert.throws(() => openai.decoder().push('{"type":"response.incomplete"}'));
  const d = openai.decoder();
  d.push(JSON.stringify({ type: "response.completed", response: { status: "completed", output: [{ type: "function_call", call_id: "x", name: "python", arguments: '{"code":' }] } }));
  assert.throws(() => d.finish());
});
test("Anthropic joins partial JSON and retains signed thinking blocks", () => {
  const d = anthropic.decoder();
  const events = [
    { type: "message_start", message: { usage: { input_tokens: 10, cache_read_input_tokens: 5, cache_creation_input_tokens: 3 } } },
    { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "", signature: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "reason" } },
    { type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature: "signed" } },
    { type: "content_block_stop", index: 0 },
    { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "t1", name: "python", input: {} } },
    { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '{"code":' } },
    { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '"assert True"}' } },
    { type: "content_block_stop", index: 1 },
    { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 20 } },
    { type: "message_stop" },
  ];
  for (const e of events) d.push(JSON.stringify(e));
  const reply = d.finish();
  assert.deepEqual(reply.calls, [{ id: "t1", name: "python", arguments: { code: "assert True" } }]);
  assert.deepEqual(reply.usage, { input: 18, output: 20 });
  const next = anthropic.encode({ ...request, turns: [{ continuation: reply.continuation, results: [{ id: "t1", content: "ok" }] }] });
  assert.equal(next.messages[1].content[0].signature, "signed");
  assert.equal(next.messages[2].content[0].tool_use_id, "t1");
  assert.equal(next.tools[0].strict, true);
});
test("Anthropic truncation and transport errors never return tool calls", () => {
  assert.throws(() => anthropic.decoder().finish());
  assert.throws(() => anthropic.decoder().push('{"type":"error"}'));
  const d = anthropic.decoder();
  d.push('{"type":"message_delta","delta":{"stop_reason":"max_tokens"}}');
  d.push('{"type":"message_stop"}');
  assert.throws(() => d.finish());
});

import * as gemini from "../plugins/gemini/main.mjs";
const geminiEvents = [
  { event_type: "step.start", index: 0, step: { type: "thought" } },
  { event_type: "step.delta", index: 0, delta: { type: "thought_summary", content: { type: "text", text: "plan" } } },
  { event_type: "step.delta", index: 0, delta: { type: "thought_signature", signature: "signed-thought" } },
  { event_type: "step.stop", index: 0 },
  { event_type: "step.start", index: 1, step: { type: "function_call", id: "g1", name: "python", signature: "signed-call" } },
  { event_type: "step.delta", index: 1, delta: { type: "arguments_delta", arguments: '{"code":' } },
  { event_type: "step.delta", index: 1, delta: { type: "arguments_delta", arguments: '"assert True"}' } },
  { event_type: "step.stop", index: 1 },
  { event_type: "interaction.completed", interaction: { status: "requires_action", usage: { total_input_tokens: 10, total_output_tokens: 20, total_thought_tokens: 5, total_tokens: 35 } } },
];
test("Gemini reconstructs signed steps without terminal steps and sends matching image results", () => {
  const d = gemini.decoder(); for (const e of geminiEvents) d.push(JSON.stringify(e));
  const reply = d.finish();
  assert.deepEqual(reply.calls, [{ id: "g1", name: "python", arguments: { code: "assert True" } }]);
  assert.deepEqual(reply.usage, { input: 10, output: 25 });
  const next = gemini.encode({ ...request, turns: [{ continuation: reply.continuation, results: [{ id: "g1", content: "ok", images: [{ name: "Main", mimeType: "image/png", data: "cG5n" }] }] }] });
  assert.equal(next.store, false); assert.equal(next.stream, true);
  assert.equal(next.system_instruction, "system");
  assert.equal(next.tools[0].type, "function");
  assert.deepEqual(next.input.slice(1, 3), reply.continuation);
  assert.equal(next.input[1].signature, "signed-thought");
  assert.equal(next.input[2].signature, "signed-call");
  assert.deepEqual(next.input[3], { type: "function_result", name: "python", call_id: "g1", result: [{ type: "text", text: "ok" }, { type: "text", text: "Draft page: Main" }, { type: "image", mime_type: "image/png", data: "cG5n" }] });
});
test("Gemini text streaming and final snapshots preserve unknown signed metadata", () => {
  const d = gemini.decoder();
  d.push(JSON.stringify({ event_type: "step.start", index: 0, step: { type: "model_output" } }));
  assert.equal(d.push(JSON.stringify({ event_type: "step.delta", index: 0, delta: { type: "text", text: "Ready" } })), "Ready");
  d.push(JSON.stringify({ event_type: "step.stop", index: 0 }));
  d.push(JSON.stringify({ event_type: "interaction.completed", interaction: { status: "completed" } }));
  assert.equal(d.finish().text, "Ready");
  const final = gemini.decoder(), steps = [{ type: "thought", signature: "opaque", extra: { version: 2 } }];
  final.push(JSON.stringify({ event_type: "interaction.completed", interaction: { status: "completed", steps } }));
  assert.deepEqual(final.finish().continuation, steps);
});
test("Gemini rejects truncated, failed, malformed and unsupported streams before executing tools", () => {
  for (const events of [geminiEvents.slice(0, -1), geminiEvents.filter(e => e.event_type !== "step.stop"), [{ event_type: "interaction.completed", interaction: { status: "incomplete" } }], [{ event_type: "error", error: { message: "private account details" } }], [{ event_type: "step.delta", index: 0, delta: { type: "text", text: "bad" } }], [{ event_type: "interaction.completed", interaction: { status: "requires_action", steps: [{ type: "function_call", id: "x", name: "python", arguments: "bad" }] } }]]) {
    assert.throws(() => { const d = gemini.decoder(); for (const e of events) d.push(JSON.stringify(e)); d.finish(); });
  }
});
