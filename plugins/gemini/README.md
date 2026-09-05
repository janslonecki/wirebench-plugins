# Google Gemini

Native Gemini Interactions API provider for the WireBench desktop assistant.
Install the plugin in a build that supports `x-goog-api-key` providers, enter a
Google AI Studio API key in Assistant, refresh models, and choose a model from
your account's live catalog. A catalog entry does not guarantee support for
Interactions, function calling and image input; choose a model with all three.
API usage is billed by Google. A Gemini app subscription is not an API key.

The adapter uses streamed `/v1beta/interactions` with `store: false`, retains
signed thought and tool steps across stateless turns, and returns rendered
schematics as image tool results. WireBench owns authentication and HTTP;
this module receives no keys, filesystem access or project handle.

Reference: https://ai.google.dev/api/interactions
Models: https://ai.google.dev/api/models

Run `node --test tools/test-llm.mjs` from the repository root.
