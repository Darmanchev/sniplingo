# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: extension.test.ts >> selects an area, performs local OCR, and translates the result
- Location: tests/e2e/extension.test.ts:104:1

# Error details

```
Error: expect(locator).toHaveValue(expected) failed

Locator: locator('[data-sniplingo="result-panel"]').locator('#ocr-text')
Expected pattern: /Hello.*world/s
Received string:  ""

Call log:
  - Expect "toHaveValue" with timeout 90000ms
  - waiting for locator('[data-sniplingo="result-panel"]').locator('#ocr-text')
    15 × locator resolved to <textarea id="ocr-text" spellcheck="true" aria-label="Recognized text"></textarea>
       - unexpected value ""

```

```yaml
- textbox "Recognized text"
```

# Test source

```ts
  56  |       return;
  57  |     }
  58  | 
  59  |     const chunks: Buffer[] = [];
  60  |     for await (const chunk of request) chunks.push(Buffer.from(chunk));
  61  |     const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  62  |     if (!body.text.includes('Hello') || body.targetLanguage !== 'ru') {
  63  |       response.writeHead(400, { 'Content-Type': 'application/json' });
  64  |       response.end(JSON.stringify({ error: 'Unexpected E2E request.' }));
  65  |       return;
  66  |     }
  67  | 
  68  |     response.writeHead(200, { 'Content-Type': 'application/json' });
  69  |     response.end(
  70  |       JSON.stringify({
  71  |         translatedText: 'Привет, мир! Цена: $10.50',
  72  |         detectedSourceLanguage: 'EN',
  73  |       }),
  74  |     );
  75  |   });
  76  | 
  77  |   await Promise.all([
  78  |     listen(pageServer, 4173),
  79  |     listen(translationServer, 18787),
  80  |   ]);
  81  | 
  82  |   context = await chromium.launchPersistentContext('', {
  83  |     // captureVisibleTab returns blank pixels in Chromium's headless mode.
  84  |     // CI runs this headed browser inside Xvfb.
  85  |     headless: false,
  86  |     ...(existsSync(playwrightChromiumPath)
  87  |       ? { executablePath: playwrightChromiumPath }
  88  |       : existsSync(localChromePath)
  89  |         ? { executablePath: localChromePath }
  90  |         : {}),
  91  |     args: [
  92  |       `--disable-extensions-except=${extensionPath}`,
  93  |       `--load-extension=${extensionPath}`,
  94  |     ],
  95  |     viewport: { width: 1000, height: 700 },
  96  |   });
  97  | });
  98  | 
  99  | test.afterAll(async () => {
  100 |   await context?.close();
  101 |   await Promise.all([close(pageServer), close(translationServer)]);
  102 | });
  103 | 
  104 | test('selects an area, performs local OCR, and translates the result', async ({}, testInfo) => {
  105 |   const page = await context.newPage();
  106 |   await page.goto('http://127.0.0.1:4173');
  107 | 
  108 |   const serviceWorker =
  109 |     context.serviceWorkers()[0] ??
  110 |     (await context.waitForEvent('serviceworker', { timeout: 15_000 }));
  111 | 
  112 |   // Playwright cannot click browser chrome. This executes the same tab message
  113 |   // and runtime injection used by the toolbar action and its keyboard command.
  114 |   await serviceWorker.evaluate(async () => {
  115 |     const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  116 |     if (tab?.id === undefined) throw new Error('Active E2E tab was not found.');
  117 |     try {
  118 |       await chrome.tabs.sendMessage(tab.id, { type: 'START_SELECTION' });
  119 |     } catch {
  120 |       await chrome.scripting.executeScript({
  121 |         target: { tabId: tab.id },
  122 |         files: ['/content-scripts/content.js'],
  123 |       });
  124 |     }
  125 |   });
  126 | 
  127 |   await expect(page.locator('[data-sniplingo="selection-overlay"]')).toHaveCount(1);
  128 |   const captureBox = await page.locator('#capture').boundingBox();
  129 |   expect(captureBox).not.toBeNull();
  130 |   if (captureBox === null) return;
  131 | 
  132 |   await page.mouse.move(captureBox.x, captureBox.y);
  133 |   await page.mouse.down();
  134 |   await page.mouse.move(
  135 |     captureBox.x + captureBox.width,
  136 |     captureBox.y + captureBox.height,
  137 |     { steps: 8 },
  138 |   );
  139 |   await page.mouse.up();
  140 | 
  141 |   const panel = page.locator('[data-sniplingo="result-panel"]');
  142 |   await expect(panel).toHaveCount(1);
  143 |   const croppedImage = await serviceWorker.evaluate(async () => {
  144 |     const stored = await chrome.storage.local.get('e2eCroppedImage');
  145 |     return stored.e2eCroppedImage;
  146 |   });
  147 |   if (typeof croppedImage === 'string') {
  148 |     const croppedImageBuffer = Buffer.from(croppedImage.split(',')[1], 'base64');
  149 |     await writeFile(testInfo.outputPath('cropped-selection.png'), croppedImageBuffer);
  150 |     await testInfo.attach('cropped-selection.png', {
  151 |       body: croppedImageBuffer,
  152 |       contentType: 'image/png',
  153 |     });
  154 |   }
  155 |   const originalText = panel.locator('#ocr-text');
> 156 |   await expect(originalText).toHaveValue(/Hello.*world/s);
      |                              ^ Error: expect(locator).toHaveValue(expected) failed
  157 |   await expect(panel.locator('#privacy-disclosure')).toContainText(
  158 |     'Screenshots and OCR stay on this device',
  159 |   );
  160 | 
  161 |   await panel.locator('#target-language').selectOption('ru');
  162 |   await panel.locator('#translate').click();
  163 |   await expect(panel.locator('#translated-text')).toHaveText(
  164 |     'Привет, мир! Цена: $10.50',
  165 |   );
  166 | });
  167 | 
  168 | function listen(server: Server, port: number): Promise<void> {
  169 |   return new Promise((resolve, reject) => {
  170 |     server.once('error', reject);
  171 |     server.listen(port, '127.0.0.1', () => resolve());
  172 |   });
  173 | }
  174 | 
  175 | function close(server: Server | undefined): Promise<void> {
  176 |   if (!server) return Promise.resolve();
  177 |   return new Promise((resolve) => server.close(() => resolve()));
  178 | }
  179 | 
```