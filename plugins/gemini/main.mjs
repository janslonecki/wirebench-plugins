// Copyright (C) 2026 wirebench. SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software under GNU GPL version 3 or later, without
// any warranty. See LICENSE and https://www.gnu.org/licenses/.
// Additional permission under GNU GPL version 3 section 7: the licensors
// permit conveying this work combined with wirebench, including modified
// versions covered by wirebench's licence. See EXCEPTION.md.

/** Native Interactions API, stateless history including signed thought steps. */
export function encode(request) {
  const input = [{ type: "user_input", content: [{ type: "text", text: request.prompt }] }];
  for (const turn of request.turns) {
    if (!Array.isArray(turn.continuation)) throw new Error("Invalid Gemini continuation");
    input.push(...turn.continuation);
    for (const result of turn.results) {
      const call = turn.continuation.find(s => s.type === "function_call" && s.id === result.id);
      if (!call) throw new Error("Gemini tool result has no matching call");
      input.push({ type: "function_result", name: call.name, call_id: result.id, result: [
        { type: "text", text: result.content },
        ...(result.images ?? []).flatMap(i => [{ type: "text", text: `Draft page: ${i.name}` }, { type: "image", mime_type: i.mimeType, data: i.data }]),
      ] });
    }
  }
  return { model: request.model, system_instruction: request.system, input, stream: true, store: false,
    generation_config: { max_output_tokens: request.maxOutputTokens },
    tools: request.tools.map(t => ({ type: "function", name: t.name, description: t.description, parameters: t.parameters })),
  };
}
const object = value => !!value && typeof value === "object" && !Array.isArray(value);
const count = value => { if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid Gemini usage"); return value; };
export function decoder() {
  const steps = [], partial = new Map(), closed = new Set();
  let complete = false, finalSteps, status, usage = {};
  return {
    push(data) {
      const e = JSON.parse(data), kind = e.event_type;
      if (complete) throw new Error("Gemini sent data after completion");
      if (kind === "error" || kind === "interaction.error") throw new Error("Gemini returned a stream error");
      if (kind === "interaction.status_update") {
        if (!["in_progress", "requires_action", "completed"].includes(e.status)) throw new Error("Gemini interaction did not complete");
        status = e.status;
      }
      if (kind === "step.start") {
        if (!Number.isInteger(e.index) || e.index !== steps.length || !object(e.step)) throw new Error("Malformed Gemini step start");
        steps.push(structuredClone(e.step));
      }
      if (kind === "step.delta") {
        const step = steps[e.index], delta = e.delta;
        if (!step || closed.has(e.index) || !object(delta)) throw new Error("Malformed Gemini step delta");
        if (e.metadata?.total_usage) usage = e.metadata.total_usage;
        if (delta.type === "arguments_delta" && step.type === "function_call" && typeof delta.arguments === "string") {
          partial.set(e.index, (partial.get(e.index) ?? "") + delta.arguments);
        } else if (delta.type === "text" && step.type === "model_output" && typeof delta.text === "string") {
          step.content ??= [];
          const last = step.content.at(-1);
          if (last?.type === "text") last.text += delta.text;
          else step.content.push({ type: "text", text: delta.text });
          return delta.text;
        } else if (delta.type === "thought_signature" && typeof delta.signature === "string") {
          step.signature = (step.signature ?? "") + delta.signature;
        } else if (delta.type === "thought_summary" && step.type === "thought" && object(delta.content)) {
          (step.summary ??= []).push(structuredClone(delta.content));
        } else if (delta.type === "text_annotation_delta" && step.type === "model_output" && step.content?.at(-1)?.type === "text" && object(delta.annotation)) {
          (step.content.at(-1).annotations ??= []).push(structuredClone(delta.annotation));
        } else throw new Error("Unsupported Gemini stream content");
      }
      if (kind === "step.stop") {
        if (!steps[e.index] || closed.has(e.index)) throw new Error("Malformed Gemini step stop");
        if (partial.has(e.index)) steps[e.index].arguments = JSON.parse(partial.get(e.index));
        closed.add(e.index);
      }
      if (kind === "interaction.completed") {
        if (!object(e.interaction)) throw new Error("Missing Gemini interaction");
        status = e.interaction.status ?? status;
        if (e.interaction.steps !== undefined) {
          if (!Array.isArray(e.interaction.steps)) throw new Error("Malformed Gemini final steps");
          finalSteps = structuredClone(e.interaction.steps);
        }
        usage = e.interaction.usage ?? usage;
        complete = true;
      }
    },
    finish() {
      if (!complete || !["completed", "requires_action"].includes(status) || steps.some((_, i) => !closed.has(i))) throw new Error("Gemini stream ended without a complete interaction");
      const continuation = finalSteps ?? steps;
      const ids = new Set();
      const calls = continuation.filter(s => s.type === "function_call").map(s => {
        if (typeof s.id !== "string" || !s.id || ids.has(s.id) || typeof s.name !== "string" || !s.name || !object(s.arguments)) throw new Error("Malformed Gemini function call");
        ids.add(s.id); return { id: s.id, name: s.name, arguments: s.arguments };
      });
      if (status === "requires_action" && !calls.length) throw new Error("Gemini requires an unsupported action");
      const input = count(usage.total_input_tokens ?? 0);
      const output = usage.total_tokens !== undefined ? count(count(usage.total_tokens) - input)
        : count(usage.total_output_tokens ?? 0) + count(usage.total_thought_tokens ?? 0) + count(usage.total_tool_use_tokens ?? 0);
      return { text: continuation.filter(s => s.type === "model_output").flatMap(s => (s.content ?? []).filter(c => c.type === "text").map(c => c.text)).join("\n"), calls, continuation, usage: { input, output } };
    },
  };
}
