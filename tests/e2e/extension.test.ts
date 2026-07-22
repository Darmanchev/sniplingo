import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import path from 'node:path';
import { chromium, expect, test, type BrowserContext } from '@playwright/test';

declare const chrome: {
  scripting: {
    executeScript(details: {
      files: string[];
      target: { tabId: number };
    }): Promise<unknown>;
  };
  storage: {
    local: {
      get(key: string): Promise<Record<string, unknown>>;
    };
  };
  tabs: {
    query(details: {
      active: boolean;
      lastFocusedWindow: boolean;
    }): Promise<Array<{ id?: number }>>;
    sendMessage(tabId: number, message: unknown): Promise<unknown>;
  };
};

const extensionPath = path.resolve('.output/chrome-mv3-e2e');
const playwrightChromiumPath = chromium.executablePath();
const localChromePath =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
let context: BrowserContext;
let pageServer: Server;
let translationServer: Server;

test.beforeAll(async () => {
  pageServer = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(`<!doctype html>
      <meta charset="utf-8">
      <style>
        body { margin: 0; background: white; font-family: Arial, sans-serif; }
        #capture { position: absolute; top: 150px; left: 100px; padding: 24px;
          color: #111; background: #fff; font-size: 42px; line-height: 1.3; }
      </style>
      <div id="capture">Hello, world! Price: $10.50</div>`);
  });
  translationServer = createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (request.method === 'OPTIONS') {
      response.writeHead(204).end();
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body.text.includes('Hello') || body.targetLanguage !== 'ru') {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'Unexpected E2E request.' }));
      return;
    }

    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(
      JSON.stringify({
        translatedText: 'Привет, мир! Цена: $10.50',
        detectedSourceLanguage: 'EN',
      }),
    );
  });

  await Promise.all([
    listen(pageServer, 4173),
    listen(translationServer, 18787),
  ]);

  context = await chromium.launchPersistentContext('', {
    // captureVisibleTab returns blank pixels in Chromium's headless mode.
    // CI runs this headed browser inside Xvfb.
    headless: false,
    ...(existsSync(playwrightChromiumPath)
      ? { executablePath: playwrightChromiumPath }
      : existsSync(localChromePath)
        ? { executablePath: localChromePath }
        : {}),
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
    viewport: { width: 1000, height: 700 },
  });
});

test.afterAll(async () => {
  await context?.close();
  await Promise.all([close(pageServer), close(translationServer)]);
});

test('selects an area, performs local OCR, and translates the result', async ({}, testInfo) => {
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173');

  const serviceWorker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent('serviceworker', { timeout: 15_000 }));

  // Playwright cannot click browser chrome. This executes the same tab message
  // and runtime injection used by the toolbar action and its keyboard command.
  await serviceWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id === undefined) throw new Error('Active E2E tab was not found.');
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'START_SELECTION' });
    } catch {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['/content-scripts/content.js'],
      });
    }
  });

  await expect(page.locator('[data-sniplingo="selection-overlay"]')).toHaveCount(1);
  const captureBox = await page.locator('#capture').boundingBox();
  expect(captureBox).not.toBeNull();
  if (captureBox === null) return;

  await page.mouse.move(captureBox.x, captureBox.y);
  await page.mouse.down();
  await page.mouse.move(
    captureBox.x + captureBox.width,
    captureBox.y + captureBox.height,
    { steps: 8 },
  );
  await page.mouse.up();

  const panel = page.locator('[data-sniplingo="result-panel"]');
  await expect(panel).toHaveCount(1);
  const croppedImage = await serviceWorker.evaluate(async () => {
    const stored = await chrome.storage.local.get('e2eCroppedImage');
    return stored.e2eCroppedImage;
  });
  if (typeof croppedImage === 'string') {
    const croppedImageBuffer = Buffer.from(croppedImage.split(',')[1], 'base64');
    await writeFile(testInfo.outputPath('cropped-selection.png'), croppedImageBuffer);
    await testInfo.attach('cropped-selection.png', {
      body: croppedImageBuffer,
      contentType: 'image/png',
    });
  }
  const originalText = panel.locator('#ocr-text');
  await expect(originalText).toHaveValue(/Hello.*world/s);
  await expect(panel.locator('#privacy-disclosure')).toContainText(
    'Screenshots and OCR stay on this device',
  );

  await panel.locator('#target-language').selectOption('ru');
  await panel.locator('#translate').click();
  await expect(panel.locator('#translated-text')).toHaveText(
    'Привет, мир! Цена: $10.50',
  );
});

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
}

function close(server: Server | undefined): Promise<void> {
  if (!server) return Promise.resolve();
  return new Promise((resolve) => server.close(() => resolve()));
}
