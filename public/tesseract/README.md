# Local Tesseract runtime

These runtime assets are copied from the installed npm packages:

- `tesseract.js@7.0.0`
- `tesseract.js-core@7.0.0`
- `@tesseract.js-data/eng@1.0.0`
- `@tesseract.js-data/rus@1.0.0`

The extension loads the worker, WASM core, and `eng`/`rus` trained data from
its own package. No executable OCR code is loaded from a CDN.
