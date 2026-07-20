import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'SnipLingo — OCR & Translate',
    description: 'Select a page area, recognize its text, and translate it.',
    permissions: [
      'activeTab',
      'clipboardWrite',
      'storage',
      'http://127.0.0.1:8787/*',
    ],
  },
});
