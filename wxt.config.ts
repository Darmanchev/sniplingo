import { defineConfig } from 'wxt';
import { fileURLToPath } from 'node:url';

const DEVELOPMENT_API_URL = 'http://127.0.0.1:8787/v1/translate';
const PREPARE_API_URL = 'https://sniplingo-build.invalid/v1/translate';

export default defineConfig({
  vite: () => ({
    resolve: {
      alias: {
        'regenerator-runtime/runtime': fileURLToPath(
          new URL('./services/regeneratorRuntimeShim.ts', import.meta.url),
        ),
      },
    },
  }),
  manifest: ({ browser, mode, manifestVersion }) => {
    const apiUrl = readApiUrl(mode);
    const hostPermission = `${apiUrl.origin}/*`;
    const hostPermissions = [
      hostPermission,
      // Playwright starts selection by messaging the service worker directly,
      // which does not grant activeTab like a real action click or command does.
      // Keep the broader capture permission isolated to the E2E package.
      ...(mode === 'e2e' ? ['<all_urls>'] : []),
    ];
    const permissions = [
      'activeTab',
      'clipboardWrite',
      'notifications',
      'scripting',
      'storage',
      ...(manifestVersion === 3 ? ['offscreen'] : []),
    ];

    const actionCommand =
      manifestVersion === 2 ? '_execute_browser_action' : '_execute_action';

    return {
      name: 'SnipLingo — OCR & Translate',
      description: 'Select a page area, recognize its text, and translate it.',
      action: {},
      permissions:
        manifestVersion === 2
          ? [...permissions, ...hostPermissions]
          : permissions,
      ...(manifestVersion === 3
        ? {
            host_permissions: hostPermissions,
            content_security_policy: {
              extension_pages:
                "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
            },
          }
        : {}),
      commands: {
        [actionCommand]: {
          suggested_key: { default: 'Alt+Shift+S' },
          description: 'Select an area to recognize and translate',
        },
      },
      ...(browser === 'firefox'
        ? {
            browser_specific_settings: {
              gecko: {
                id: 'sniplingo@darmanchev',
                strict_min_version: '140.0',
                data_collection_permissions: {
                  required: ['websiteContent' as const],
                },
              },
            },
          }
        : {}),
    };
  },
});

function readApiUrl(mode: string): URL {
  const value =
    process.env.WXT_TRANSLATION_API_URL ??
    (mode === 'development' || mode === 'e2e'
      ? DEVELOPMENT_API_URL
      : isPrepareCommand()
        ? PREPARE_API_URL
        : undefined);

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

function isPrepareCommand(): boolean {
  return process.argv.some((argument) => argument === 'prepare');
}
