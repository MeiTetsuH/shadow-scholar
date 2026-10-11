# Shadow Scholar

A Chrome Manifest V3 reading and study assistant. Select webpage text, discuss it in a side panel, or explicitly capture the visible page for explanation by **your chosen OpenAI-compatible AI provider**.

## Features

- Floating selection action, context-menu analysis, and side-panel conversations.
- Answer, guided-hint, and screenshot modes, with editable prompts.
- Streaming Markdown, safe links, tables, and working copy buttons.
- English and Chinese interfaces.
- Optional selection helper for copy/selection/context menus outside editors. It does not interfere with paste, focus, visibility, timers, or JavaScript execution.

## Install and configure

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/fjokopekhdlkbdaegfjnphiocpmiaimj), or load this directory as an unpacked extension from `chrome://extensions`. Chrome 116 or later is required.

1. Open the extension's side panel and Settings.
2. Enter a compatible API endpoint, API key, and the provider's exact model ID.
3. Read the data-use disclosure, agree if you want to send requests to that endpoint, and save.
4. Select text and click the floating action, use the context menu, or use Analyze Page / Analyze Selection. In Screenshot Mode, each AI request includes a capture of the visible webpage.

| Provider | Example endpoint | Model ID example |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | `gpt-5.4-mini` |
| OpenRouter | `https://openrouter.ai/api/v1` | `openai/gpt-5.4-mini` |
| DeepSeek | `https://api.deepseek.com` | Provider-supported model ID |
| Cloudflare AI Gateway | The gateway's OpenAI-compatible provider base URL | Provider-supported model ID |
| Local Ollama | `http://localhost:11434/v1` | Installed local model name |

Base URLs have `/chat/completions` appended; a bare origin gets `/v1/chat/completions`. Existing complete paths and query parameters are preserved. Ollama's local `/api` and `/api/chat` inputs are converted to its compatible `/v1/chat/completions` endpoint. Remote servers require HTTPS; HTTP is allowed only on loopback. Local servers can be used without an API key. Screenshot requests require a vision-capable model.

The extension is free; cloud providers may charge for requests. It does not include a provider account, paid API credits, or native Anthropic Messages API support.

## Privacy and storage

The developer operates no backend and receives no prompts, keys, screenshots, or answers. **Requested content does leave the browser when you use a remote AI provider.** Your selected text, page excerpts, typed messages, conversation context, and explicit screenshots are sent directly to the configured endpoint. The provider also receives network metadata. Its own retention and processing policies apply.

- API keys are held in trusted browser session memory and cleared on restart/reload/update. You will need to enter the key again after that. Preferences remain saved locally.
- Up to 50 inline answers and 100 pending transfers are saved locally, with additional size limits. Use Settings → Clear saved local answers and pending requests to remove them.
- Side-panel conversations live in memory. Clear Conversation removes the current conversation and cancels any active request.
- The extension does not persist screenshot images, collect telemetry, load remote executable code, or render remote images from AI responses.
- Consent is required before sending data, and changing the endpoint requires consent again.

See the complete [privacy policy](PRIVACY.md), including data categories, recipients, retention, deletion, and permission justifications.

## Development and verification

Node.js 22+ and npm are required for development. Install the locked dependencies with `npm ci --ignore-scripts`.

```sh
npm run verify
npm audit
npm run package
```

`verify` checks syntax, manifest references, translation coverage, MV3 inline-handler restrictions, the vendored Markdown dependency, and the affected behavior tests. Tests simulate Chrome APIs and DOM interactions; real Chrome release validation is also necessary.

`package` creates `dist/shadow-scholar-1.2.0.zip` using a fixed allowlist and verifies every archived file, CRC, and SHA-256. Private files, tests, dependencies, and local settings are excluded. The extension runs entirely from the packaged files; npm is not needed to use it.

## Architecture

- `background.js`: trusted settings, session credentials, extraction, context-menu routing, and cancellable requests.
- `stream.js`: bounded SSE decoding and stream cleanup.
- `settings.js`: defaults, migration, and endpoint validation.
- `extractors.js`: bounded page traversal without cloning the entire DOM.
- `content.js`: isolated floating interface and inline responses.
- `sidepanel.*`: chat, settings, consent, and local-data controls.
- `markdown.js`: shared HTML allowlist around the vendored Marked parser.
- `anti-detect.js`: legacy filename retained for the optional, narrowly scoped selection helper.

Long requests use a bounded, request-scoped keep-alive in accordance with Chrome's service-worker guidance. No hidden offscreen page is needed. Concurrent requests have independent cancellation and cleanup.

## License

[MIT](LICENSE). The packaged [Marked parser](https://github.com/markedjs/marked) is also MIT-licensed; its license is included in `lib/marked.LICENSE`.
