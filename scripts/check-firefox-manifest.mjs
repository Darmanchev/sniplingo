import { readFile } from 'node:fs/promises';

const manifestPath = new URL(
  '../.output/firefox-mv2/manifest.json',
  import.meta.url,
);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const failures = [];

if (manifest.version !== '0.1.0') {
  failures.push(`version must be 0.1.0, received ${manifest.version}`);
}

const gecko = manifest.browser_specific_settings?.gecko;
if (gecko?.id !== 'sniplingo@darmanchev') {
  failures.push('browser_specific_settings.gecko.id is missing or unstable');
}
if (gecko?.strict_min_version !== '140.0') {
  failures.push('Firefox strict_min_version must be 140.0 or newer');
}
if (!gecko?.data_collection_permissions?.required?.includes('websiteContent')) {
  failures.push('required websiteContent data collection disclosure is missing');
}

const endpoint = process.env.WXT_TRANSLATION_API_URL;
if (!endpoint) failures.push('WXT_TRANSLATION_API_URL is required for validation');

if (endpoint) {
  const endpointUrl = new URL(endpoint);
  const expectedPermission = `${endpointUrl.origin}/*`;
  if (!manifest.permissions?.includes(expectedPermission)) {
    failures.push(`Firefox host permission must include ${expectedPermission}`);
  }
}

const serialized = JSON.stringify(manifest);
for (const forbidden of [
  'api.sniplingo.example',
  'localhost',
  '127.0.0.1',
  '0.0.0',
]) {
  if (serialized.includes(forbidden)) {
    failures.push(`production manifest contains forbidden host: ${forbidden}`);
  }
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log('Firefox manifest is release-ready.');
}
