# Shadow Scholar 1.2.0

This release corrects the incomplete privacy disclosures in 1.1.0 and fixes streaming, clipboard, and browser-compatibility problems.

- Document all data categories, purposes, recipients, local retention, deletion controls, and user-selected AI-provider transfers. Add an in-product disclosure with endpoint-bound consent.
- Move API keys to trusted session memory, remove old persisted keys after migration, stop saving diagnostic content and page URLs/titles, and provide a saved-data clear control.
- Cancel network requests on disconnect; enforce response/header/request bounds; parse split UTF-8 and final SSE data; serialize storage updates and claim context-menu requests once per originating window.
- Fix CSP-blocked copy buttons and IME Enter handling. Sanitize Markdown in both UIs and coalesce streaming rendering.
- Remove intrusive page-global focus, visibility, execution, and timing patches while preserving editor paste/cut behavior. Fresh installs leave the narrow selection helper disabled.
- Use bounded text extraction without cloning the entire page. Keep runtime code packaged locally, upgrade Marked to 18.1.0, and remove the offscreen permission/document.
- Keep `<all_urls>` because Chrome requires that permission or a fresh `activeTab` grant for visible-tab capture. Runtime extraction and screenshot operations accept only HTTP/HTTPS tabs. Toolbar opening explicitly grants `activeTab`.

Validation: `npm run verify` runs 31 targeted behavior tests plus syntax/manifest/locale/CSP/dependency checks. `npm audit` reported zero known vulnerabilities on October 11, 2026. Real Chrome checks used a temporary localhost-only extension copy and synthetic local API: page extraction, Markdown response, message copying, screenshot capture, inline screenshot response, and automatic sidebar transfer worked. No paid provider key or private webpage was used. This does not establish compatibility with every third-party endpoint.

The ZIP is built from a 26-file allowlist and verified byte-for-byte against source, including archive CRC and SHA-256. Store review and publication are separate from successful local verification.
