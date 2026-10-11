# Shadow Scholar — review guide

This guide describes source version **1.3.0**, extension ID `fjokopekhdlkbdaegfjnphiocpmiaimj`, publisher **Akira**, and the public repository [MeiTetsuH/shadow-scholar](https://github.com/MeiTetsuH/shadow-scholar). It provides reproducible review steps and links to implementation evidence. It is not a certification of store approval. Check the developer dashboard and public listing for the current review and published versions.

## Purpose and public documents

The single purpose is to help users understand webpages: explain selected text, discuss page excerpts in a side panel, or explain a user-requested visible-page screenshot with their chosen AI model. No Shadow Scholar account or developer-operated backend is required. AI access is supplied by the user through a compatible provider or a local model service.

| Document | Scope |
| --- | --- |
| [Privacy policy](../PRIVACY.md) | Data accessed, recipients, transmission, consent, retention, deletion, and permissions |
| [Chinese README](../README.md) / [English README](README.en.md) | User-facing capabilities, setup, data boundaries, and interface screenshots |
| [MIT license](../LICENSE) / [third-party notices](../THIRD_PARTY_NOTICES.md) | Repository license and bundled component notices |
| [1.3.0 release notes](RELEASE_1.3.0.md) / [1.2.0 security and reliability changes](RELEASE_1.2.0.md) | Changes, checks, and verification limits |
| [Public support](https://github.com/MeiTetsuH/shadow-scholar/issues) | Non-sensitive reports and reproducible issues |

## Local review without a cloud API key

1. Use Chrome 116 or later. Load the review package or the repository as an unpacked extension. Open an ordinary HTTP/HTTPS page with non-sensitive sample text.
2. Run Ollama on the same computer with an installed local model. Configure that service to permit the extension's origin if its origin policy requires it. Use a vision-capable local model when testing Capture. The extension does not install or start Ollama.
3. Open the toolbar action, then Settings. Enter `http://localhost:11434/v1` and the exact installed model name. Leave the API key blank when the local service does not require authentication.
4. Read the in-product data disclosure, check consent, and save. Before consent, an AI request must be blocked. Changing the endpoint requires consent again.
5. Select sample text and click the floating book button. Confirm that an explanation streams into the inline panel. Copy the answer, send it to the side panel, and use Escape or Close to dismiss the inline panel.
6. In the side panel, use **Read this page**, ask a follow-up, and switch between **Explain** and **Explore**. Check Markdown, tables, and copied code with a model response that contains those structures. **Clear conversation** removes panel messages and cancels an active request.
7. Select **Capture** with a vision-capable model. Each request in this mode captures the currently visible active webpage. It should not capture the desktop or a different source tab.
8. Open Settings with the keyboard. Tab stays within the dialog; Escape closes it and restores focus to its trigger. Use **Clear saved local answers and pending requests** to remove saved inline answers and queued transfers.
9. When a key is used, restarting Chrome or reloading/updating the extension clears it. Other preferences remain local. To test a cloud provider, configure your own compatible HTTPS endpoint, model, and key, then accept the new endpoint's disclosure.

Content stays on this computer only if the model service runs on the same computer and does not forward requests to the cloud. A localhost gateway or cloud-backed model can still transmit data. The developer does not control a user's chosen provider's retention policy. Clearing local data cannot delete requests already retained by a provider.

## Permissions and source evidence

The current declarations are in [`manifest.json`](../manifest.json). No permission exists solely for analytics or advertising.

| Permission | Purpose | Source |
| --- | --- | --- |
| `activeTab` | Access for user-invoked actions on the active tab | [`background.js`](../background.js) |
| `contextMenus` | Selected-text analysis action | [`background.js`](../background.js) |
| `storage` | Local preferences and bounded history; trusted session-only API keys | [`background.js`](../background.js), [`settings.js`](../settings.js) |
| `scripting` | User-requested extraction and registration of the optional selection helper | [`background.js`](../background.js), [`extractors.js`](../extractors.js), [`anti-detect.js`](../anti-detect.js) |
| `sidePanel` | Reading conversation and configuration | [`sidepanel.html`](../sidepanel.html), [`sidepanel.js`](../sidepanel.js) |
| `<all_urls>` host access | Selection interface on supported HTTP/HTTPS webpages, arbitrary user-configured compatible AI endpoints, and visible-tab capture from panel actions that lack a fresh active-tab grant | [`manifest.json`](../manifest.json), [`content.js`](../content.js), [`background.js`](../background.js) |

Selection is processed locally to show the floating action. AI requests require a user action and endpoint-specific consent. Requests use the configured endpoint, omit browser cookies, and do not follow redirects. All extension JavaScript is packaged; model responses are rendered as sanitized text/Markdown, not executable code. Remote response images are excluded by [`markdown.js`](../markdown.js).

The optional selection helper is off by default on fresh installs. It supports copying, selection, and context menus outside editors without modifying paste, focus, visibility, timers, or script execution. Refresh a page after changing this preference. Protected browser and store pages may prohibit extension operation.

## Packaging, checks, and visual materials

```sh
npm ci --ignore-scripts
npm run verify
npm run package
```

`verify` runs manifest, syntax, locale, CSP-handler, vendored-library checks, and behavior tests. `package` creates a deterministic archive from an explicit runtime allowlist, checks exact bytes and archive integrity, and writes a SHA-256 file. The ZIP excludes development dependencies, tests, design fixtures, store artwork, and this guide. The repository's `LICENSE`, `PRIVACY.md`, and complete Marked license are included.

The [design directory](../design/README.md) documents the actual-UI fixtures, icon provenance, and export process. All six screenshots are 1280 × 800; the small and marquee tiles are 440 × 280 and 1400 × 560. These are RGB PNGs without alpha. Artwork uses illustrative passages and responses and makes no claim that every model produces those exact answers.

The local design workbench is a visual fixture, not a substitute for testing the real extension with a model. See release notes for the checks actually performed and their limits.

## Policy references

The [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies) cover disclosures, permissions, data handling, and accurate marketing. The [review process documentation](https://developer.chrome.com/docs/webstore/review-process) explains review outcomes. These links are references, not statements that Google has certified this project. The designated privacy policy and product disclosures remain the authoritative explanations of this extension's data handling.
