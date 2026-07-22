import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chrome =
  process.env.CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const fixtures = [
  ['punctuation', 800, 120],
  ['small-text', 800, 120],
  ['dark-background', 800, 120],
  ['multiline-mixed', 800, 220],
];

for (const [name, width, height] of fixtures) {
  const profile = mkdtempSync(path.join(tmpdir(), `sniplingo-${name}-`));
  try {
    const source = path.join(projectRoot, 'tests', 'fixtures', 'source', `${name}.html`);
    const output = path.join(projectRoot, 'tests', 'fixtures', `${name}.png`);
    const result = spawnSync(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--disable-background-networking',
        '--disable-component-update',
        '--hide-scrollbars',
        '--no-first-run',
        `--user-data-dir=${profile}`,
        `--window-size=${width},${height}`,
        `--screenshot=${output}`,
        pathToFileURL(source).href,
      ],
      { stdio: 'inherit', timeout: 15_000 },
    );
    if (!existsSync(output)) {
      throw result.error ?? new Error(`Chrome did not create ${output}.`);
    }
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
}
