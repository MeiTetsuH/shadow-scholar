# Third-party notices

Shadow Scholar is distributed under the [repository's MIT license](LICENSE). This file records bundled third-party code and visual provenance; it does not replace upstream license notices or grant rights to third-party service names, trademarks, or generated content.

## Bundled runtime code

| Component | Version | Location | License and upstream |
| --- | --- | --- | --- |
| Marked | 18.1.0 | [`lib/marked.min.js`](lib/marked.min.js) | [Complete upstream license](lib/marked.LICENSE); [MarkedJS](https://github.com/markedjs/marked) |

The complete Marked license file, including its additional notices, is included in the extension archive. `npm run verify` checks that the vendored runtime matches the locked dependency. Development and test dependencies are listed in `package-lock.json` and are excluded from the release archive by `scripts/package.py`.

## Visual assets

- The book icon source was created with the built-in image generation tool. The prompt and export process are documented in [`design/`](design/README.md).
- The editable SVG brand mark, packaged interface symbols, layout, and promotional compositions are maintained in this repository.
- Store artwork renders the actual interface with synthetic reading passages and illustrative responses. It does not depict private user conversations or assert model output quality.
- The interface uses system fonts and packaged assets. No third-party font files or remote icon libraries are bundled.

Provider and browser product names identify compatibility or destinations; they do not imply endorsement or affiliation. AI provider terms and output rights depend on the service and content used.
