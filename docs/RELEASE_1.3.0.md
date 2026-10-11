# Shadow Scholar 1.3.0

The reading interface now uses warm paper, ink, and a vermilion bookmark, with a simpler book icon and a consistent Chinese/English reading vocabulary. The side panel, inline selection panel, settings, README, and store artwork share this design.

- Packaged SVG controls replace decorative emoji. No remote fonts or UI services are loaded.
- Settings traps keyboard focus, supports Escape, restores focus, and makes the underlying interface inert.
- Inline controls are buttons, Escape closes the panel, and narrow screens constrain the panel to the viewport. Removed obsolete animation-triggering forced layout reads.
- Both store descriptions and the interface distinguish local-only processing from cloud providers. Ollama keeps submitted content local only when the model runs on this computer and its service does not forward requests to the cloud.
- Six 1280 × 800 RGB PNG store graphics use the real interface with illustrative content. The preview fixture and high-resolution source art are excluded from the extension ZIP.

## Validation

`npm run verify` passes all 33 behavior tests plus manifest, syntax, localization, CSP-handler, and vendored-dependency checks. The deterministic package contains 27 allowlisted files and passes archive integrity and exact-byte checks.

Chrome browser verification used the actual UI source with a separate localhost-only Chrome API fixture: English at 320 × 568 has no horizontal document overflow; mode state, Settings/Escape focus restoration, and streamed response rendering work. The closed-shadow inline selection button, response panel, and Escape dismissal were also exercised through native browser controls. This fixture is not a live remote-provider or store-installed extension test; the 1.2.0 release notes retain the earlier integration checks.

No dependency or extension permission changes. Store review and public availability must be confirmed independently in the developer dashboard.
