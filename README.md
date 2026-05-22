# Shadow Scholar

> An AI-powered browser study assistant for reading, problem analysis, and step-by-step explanations.

**Shadow Scholar** (影学者) is a Chrome extension that embeds an AI assistant directly into your browser. It helps you understand web content, organize selected text, analyze questions, and interact with your own configured AI provider from a focused side panel or inline overlay.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=google-chrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ Features

### 🤖 AI-Powered Answering
- **Inline floating button** — select text on any page and get instant AI answers in a sleek overlay panel
- **Side panel chat** — full conversation interface with streaming responses and Markdown rendering
- **Context menu** — right-click selected text to send it directly to the AI
- **Page analysis** — extract and analyze entire page content with one click

### 🔒 Local Privacy Controls
Optional local privacy and page-interaction controls run only in the browser:

- **Clipboard and selection support** — helps keep copy, paste, cut, text selection, and context menus available on supported pages
- **Local-only preferences** — settings are stored with `chrome.storage.local`
- **User-controlled page helper** — the optional page interaction helper can be toggled on or off from settings
- **No analytics** — no usage telemetry, advertising identifiers, or tracking scripts

### 🎨 Premium UI
- Glassmorphism design with backdrop blur effects
- Dark mode with vibrant gradient accents
- Smooth micro-animations and transitions
- Shadow DOM isolation — extension UI never interferes with page styles
- Draggable inline answer panel

### ⚡ Technical Highlights
- **Manifest V3** compatible
- **Streaming SSE** responses via `chrome.runtime.Port`
- **Offscreen document** keep-alive mechanism for long streaming sessions
- **Smart URL builder** — auto-detects and completes API endpoints for OpenAI, OpenRouter, Cloudflare Gateway, Ollama, etc.
- **Configurable** — custom API URL, model, system prompt, and API key

## 📦 Installation

### From Source (Developer Mode)

1. Clone this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/shadow-scholar.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **Developer mode** (top-right toggle)

4. Click **Load unpacked** and select the cloned directory

5. Click the extension icon → Open **Settings** → Configure your API key

### API Configuration

Shadow Scholar supports any OpenAI-compatible API endpoint:

| Provider | Example URL |
|----------|-------------|
| OpenAI | `https://api.openai.com/v1/chat/completions` |
| OpenRouter | `https://openrouter.ai/api/v1/chat/completions` |
| Cloudflare AI Gateway | `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway}/openrouter` |
| Ollama (local) | `http://localhost:11434` |
| DeepSeek | `https://api.deepseek.com` |
| Any compatible endpoint | Just paste the base URL — paths are auto-completed |

## 🚀 Usage

### Quick Start
1. **Select text** on any webpage → A floating "影" button appears
2. **Click the button** → An inline panel opens with the AI's answer (streaming)
3. **Copy** the answer or **send it to the side panel** for continued conversation

### Side Panel
- Click the extension icon to open the side panel
- Use **"Analyze Page"** to extract and answer all questions on the current page
- Use **"Analyze Selection"** to process selected text
- Chat freely with the AI — full conversation history is maintained per session

### Context Menu
- Select text → Right-click → **"影学者：解答这道题"**
- The side panel opens automatically with the AI's response

## 🏗️ Architecture

```
shadow-scholar/
├── manifest.json          # Extension manifest (MV3)
├── prompts.js             # Prompt templates and task prompt builders
├── settings.js            # Defaults, storage keys, migrations, API URL builder
├── extractors.js          # Page, question, and selection extraction helpers
├── anti-detect.js         # Optional local page interaction helper, dynamically registered
├── content.js             # Content script (ISOLATED world) — floating UI + inline panel
├── background.js          # Service worker — API calls, message routing, keep-alive
├── sidepanel.html/js/css  # Side panel — full chat interface
├── popup.html/js/css      # Popup — quick access & settings shortcut
├── offscreen.html/js      # Offscreen document — SW keep-alive during streaming
├── lib/
│   └── marked.min.js      # Markdown parser
└── icons/
    ├── logo.svg
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Key Design Decisions

- **Optional page interaction helper** — dynamically registered only when enabled and applied on new page loads
- **`content.js` runs in `ISOLATED` world** — keeps extension messaging secure and separate from page context
- **Shared helper layers** — prompt, settings, and extraction logic are centralized in `prompts.js`, `settings.js`, and `extractors.js`
- **Shadow DOM (`closed` mode)** — the inline UI is completely isolated from page CSS
- **Port-based streaming** — uses `chrome.runtime.connect()` instead of one-shot messages for reliable SSE streaming

## ⚙️ Configuration

All settings are stored in `chrome.storage.local`:

| Key | Description | Default |
|-----|-------------|---------|
| `apiUrl` | LLM API endpoint URL | User configured |
| `apiKey` | API authentication key | *(required)* |
| `model` | Model identifier | `openai/gpt-5.4-mini` |
| `systemPrompt` | System prompt for AI behavior | Built-in exam assistant prompt |
| `antiDetect` | Enable/disable the optional local page interaction helper | `true` |
| `mode` | Answer mode or idea mode | `answer` |

## 🔒 Privacy

- **No data collection** — all data stays in your browser's local storage
- **No external analytics** — zero tracking or telemetry
- **API key stored locally** — never transmitted except to your configured API endpoint
- **Conversation history** — stored only in-memory (side panel) or local storage (inline history)

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

## 🙏 Credits

- [marked.js](https://github.com/markedjs/marked) — Markdown parsing
- Icon design — custom emoji-based branding
