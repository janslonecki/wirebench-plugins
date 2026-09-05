# Anthropic

A `llm/1` provider for the desktop wirebench assistant. Install its signed release through Plugins, open Assistant, enter a model identifier supported by your account, and configure your API key. The application encrypts persistent keys using the operating system; the plugin never receives them.

Generate sends the prompt and draft project context to `https://api.anthropic.com/v1/messages`. Provider charges apply. The plugin only encodes requests and decodes streams in an isolated worker. Project tools, budgets, cancellation, checkpoints, review and acceptance belong to wirebench. It exposes no action or automatic startup code.

This plugin requires a wirebench build supporting `llm/1`. Older builds cannot run it. No Python packages or additional dependencies are needed.

Protocol reference: [official streaming documentation](https://platform.claude.com/docs/en/build-with-claude/streaming).
