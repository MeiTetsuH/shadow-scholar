# Privacy Policy — Shadow Scholar

Last updated: October 11, 2026. Applies to version 1.2.0 and later.

Shadow Scholar is an open-source Chrome extension for reading, studying, and discussing web content with an AI service that you choose. The developer, MeiTetsuH (publisher: Akira), does not operate a backend for the extension and does not receive your API keys, prompts, screenshots, or answers. This does **not** mean the extension never handles or transmits data: the processing described below is necessary for its features.

## What the extension accesses and why

| Data | When accessed and purpose | Storage and recipient |
| --- | --- | --- |
| Selected webpage text | Selection is read locally to display a floating action. Clicking that action or choosing the context menu requests an explanation. Selection alone does not send an AI request. | Sent directly to your configured AI endpoint only when you request AI help; completed inline questions and answers may be saved locally. |
| Page text and title | Clicking Analyze Page extracts up to 20,000 characters locally, with up to 8,000 characters included in the page-analysis prompt. Script, navigation, hidden attributes, and form controls are excluded where detectable. | Requested text and the page title are sent to your configured AI endpoint. Extraction cannot guarantee removal of all personal information in visible text. |
| Visible tab screenshot | A user request in Screenshot Mode captures the visible portion of the active HTTP/HTTPS tab. It can include names, messages, documents, images, or other personal or sensitive information visible on the page. It does not capture other windows or the entire desktop. | Sent directly to your configured AI endpoint for visual explanation. Image data is held temporarily for that request and is not written to the extension's saved history. |
| Typed messages, custom system prompts, conversation context, and AI responses | Used to answer questions and continue the conversation. Prior messages in the open panel are included in follow-up requests. Imported inline answers become part of that conversation. | Text is sent to the configured endpoint. Panel conversations are held in memory until cleared or the panel closes. Completed inline answers and pending transfers are stored locally as described below. |
| API key | Used to authenticate requests to the endpoint you configure. | Kept in `chrome.storage.session` memory, accessible only to trusted extension contexts. Sent as the Authorization header to your configured endpoint. It is not sent to the developer. It is cleared when Chrome restarts or the extension is disabled, reloaded, or updated. |
| API endpoint, model ID, language, mode, custom prompts, consent choice, and helper preference | Used to configure the requested features and remember your choices. | Saved in `chrome.storage.local` on this device. The model ID and applicable system prompt are included in AI requests. |
| Technical request metadata | Your AI provider receives network information, such as your IP address, request time, and HTTP headers, when you connect. | Received and potentially retained by your provider under its own policy. The extension has no analytics service. |

The extension does not read browser passwords, cookies, your full browsing history, or background tabs to build a profile. It does not record keystroke or pointer activity for analytics. It listens locally for selection and button interactions to operate the interface. Information that you type, select, or capture can itself contain personal communications, identifying information, or other sensitive data; review that content before requesting analysis.

## Transmission and your consent

Before the first AI request, the settings interface describes the data sent and asks you to explicitly agree. Consent is tied to the configured API endpoint. Changing that endpoint requires agreement again. You can revoke consent by unchecking the agreement and saving settings. The extension blocks AI requests until consent is present.

Text mode sends text. Every request in Screenshot Mode includes a new capture of the visible webpage, including requests made using the floating button, context menu, or panel. The mode is indicated in the interface. Requests occur in response to your actions, not on a background schedule. Closing or clearing an active conversation cancels its outstanding network request; this cannot recall data already received by a provider.

Remote endpoints must use HTTPS. Unencrypted HTTP is allowed only for a service on your own computer at localhost, 127.0.0.1, or ::1. Requests do not follow redirects and omit browser cookies. Provider responses are treated as text, and executable scripts and remote images are not rendered from AI responses.

## Who receives or can access the data

- **Your configured AI provider or gateway:** the exact API address in settings receives requests. Examples include OpenAI, OpenRouter, DeepSeek, Cloudflare AI Gateway, or a local OpenAI-compatible server such as Ollama. Only the endpoint you select is contacted; these examples are not additional automatic recipients. If you select a gateway or proxy, it may forward requests to an upstream model provider. Consult both policies and settings.
- **The extension developer:** does not receive extension usage data and has no access to your local extension storage. There are no developer-operated analytics, advertising, or telemetry endpoints.
- **People with access to your browser profile/device:** may be able to access saved local answers and preferences. Local storage is not a password vault and the extension does not claim to encrypt saved history. Avoid saving secrets in prompts or the API URL.
- **GitHub or the Chrome Web Store:** opening a source, support, privacy-policy, or store link visits that service under its own policies. If you voluntarily post an issue, its contents may be public. Do not include API keys or private prompts in public issues.

External providers determine their own retention, training, regional processing, access, and deletion practices. The developer does not control these practices. A local endpoint stays on your computer only if the local server itself does not forward requests. Cloud AI features require connectivity and may incur charges from your chosen provider; the extension does not process payments.

## Local retention and deletion

- Preferences and custom prompts remain locally until you change them or uninstall the extension.
- API keys remain in browser session memory only. On upgrade from a version that stored a key locally, the extension copies it into session memory before removing the old persistent copy.
- Inline history retains at most 50 completed question/answer records. Pending transfers retain at most 100 records until imported and acknowledged by the side panel. Each collection also has a size limit and evicts older records first. Records include a timestamp and mode; pending transfers may include a local window ID used to route them correctly.
- Context-menu requests are kept locally until claimed, replaced, cleared, or discarded as expired when the panel next checks them. They include text, a timestamp, and local tab/window identifiers.
- Screenshots are not saved in extension history. Text extracted or inferred by the AI may appear in a saved answer.
- Clear Conversation removes the current panel conversation from memory. **Settings → Clear saved local answers and pending requests** removes saved inline history, pending transfers, queued requests, and old diagnostic logs, and clears the open conversation.
- Previous versions could save page URLs/titles with inline answers and diagnostic logs. The 1.2.0 upgrade removes those record fields and clears previous diagnostic logs. New versions do not persist debug logs.
- Removing the extension removes its local extension storage. These controls do not delete requests already retained by your AI provider; contact that provider to request deletion.

## Permissions and optional page helper

`activeTab` and `scripting` enable user-requested extraction and visible-tab capture. `contextMenus` provides the selected-text action. `sidePanel` displays the conversation. `storage` saves the local preferences and session data described above.

The `<all_urls>` host permission is required by Chrome for visible-tab capture when a panel action does not carry a fresh `activeTab` grant. Page extraction and screenshots are restricted by the extension to HTTP/HTTPS tabs. Host access also lets the floating selection interface work on supported webpages and lets you choose an arbitrary compatible API endpoint. It is not used for automatic page uploads or browsing analytics. Browser-internal pages and store pages may prohibit extension access. You can restrict site access in Chrome; some features will then be unavailable on those sites.

The optional selection helper is off by default on a fresh install and can be disabled in settings. It helps preserve copying, text selection, and context menus outside editable controls. It does not read the clipboard, alter pasting/cutting, falsify focus or visibility, intercept JavaScript execution, or transmit data. Refresh existing pages after changing this setting.

## Limited Use

Shadow Scholar's use and transfer of information received from Google APIs adheres to the Chrome Web Store User Data Policy, including its Limited Use requirements. Data is used only for the prominently described reading and study features. The extension does not sell user data, use it for advertising or creditworthiness decisions, or provide it to the developer for human review. Transfers to the user-selected AI endpoint occur only to fulfill the user's request.

## Changes and contact

Policy updates will be published here with a new date. Material changes to endpoint data handling require an updated in-product disclosure and consent flow.

For questions, contact the maintainer through [GitHub Issues](https://github.com/MeiTetsuH/shadow-scholar/issues). Share only non-sensitive details because issues are public.
