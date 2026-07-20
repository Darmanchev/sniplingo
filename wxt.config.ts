import { defineConfig } from 'wxt';

const DEVELOPMENT_API_URL = 'http://127.0.0.1:8787/v1/translate';

export default defineConfig({
  manifest: ({ mode, manifestVersion }) => {
    const apiUrl = readApiUrl(mode);
    const hostPermission = `${apiUrl.origin}/*`;
    const permissions = [
      'activeTab',
      'clipboardWrite',
      'scripting',
      'storage',
    ];

    return {
      name: 'SnipLingo — OCR & Translate',
      description: 'Select a page area, recognize its text, and translate it.',
      action: {},
      permissions:
        manifestVersion === 2
          ? [...permissions, hostPermission]
          : permissions,
      ...(manifestVersion === 3
        ? { host_permissions: [hostPermission] }
        : {}),
    };
  },
});

function readApiUrl(mode: string): URL {
  const value =
    process.env.WXT_TRANSLATION_API_URL ??
    (mode === 'development' ? DEVELOPMENT_API_URL : undefined);

  if (!value) {
    throw new Error(
      'WXT_TRANSLATION_API_URL is required for a production build.',
    );
  }

  const url = new URL(value);
  if (mode === 'production' && url.protocol !== 'https:') {
    throw new Error('Production WXT_TRANSLATION_API_URL must use HTTPS.');
  }
  if (
    mode === 'production' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  ) {
    throw new Error('Production WXT_TRANSLATION_API_URL cannot use localhost.');
  }
  return url;
}
