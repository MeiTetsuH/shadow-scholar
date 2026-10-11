# The reading desk

A Japanese editorial and stationery direction for Shadow Scholar: warm paper, forest-black ink, vermilion bookmarks, restrained rules, serif display headings, and readable sans-serif interface text. No remote fonts, glass filters, or ornamental gradients.

## Assets

- `icons/icon1024.png`: source icon created with the built-in imagegen tool; PNG sizes 16, 48, and 128 are exported for Chrome.
- `icons/logo.svg`: matching, editable geometric brand mark.
- `ui-icons.js`: local SVG interface symbols.
- `docs/images/store-{zh,en}-{01,02,03}.png`: 1280 × 800 store graphics using the actual interface and illustrative content.

The image-generation prompt requested a single open ivory book on deep charcoal green, a narrow fold and a vermilion bookmark, Japanese stationery proportions, and no lettering, badges, sparkles, or mockup scene. The built-in tool was used; no API key or external CLI image service was needed. The full generation prompt is in `icon-prompt.txt`.

- `docs/images/promo-small.png`: 440 × 280 RGB small promotional tile.
- `docs/images/promo-marquee.png`: 1400 × 560 RGB marquee promotional tile.

## Reproduce a visual fixture

Run `npm run design`, then open `http://localhost:11438/?slide=1&lang=zh`. Use slides 1, 2, or 3 and languages zh or en. The fixed canvas is 1280 × 800; capture at 100% browser zoom. The iframe loads the real side-panel source with a separate Chrome API fixture and synthetic response. `design/` is never included in the extension archive. No credentials are used or stored by the fixture.

For promotional tiles, open `/design/promo.html?size=small` at 440 × 280 or `/design/promo.html?size=marquee` at 1400 × 560, at 100% browser zoom.

The UI remains Chinese/English. The small Japanese phrase 読む、考える。is a decorative brand line, not a claim of Japanese localization.

Local-data statements always include the condition: the model runs on the same computer and the server does not forward content to the cloud. Cloud requests send content to the selected provider.
