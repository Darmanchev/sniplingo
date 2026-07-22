// SnipLingo targets modern extension browsers with native async/generator
// support. Tesseract's browser entrypoint imports the legacy runtime only for
// compatibility with obsolete engines; omitting it also avoids an unreachable
// Function-constructor fallback in extension bundles.
export {};
