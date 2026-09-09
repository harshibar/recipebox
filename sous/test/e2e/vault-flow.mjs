// End-to-end: drives the real app in Chromium against a real server and a
// throwaway Obsidian vault. Not part of `npm test` — Playwright is not a
// dependency of this project. Run it when you have one available:
//
//   node test/e2e/vault-flow.mjs
//
// Set CHROMIUM to override the browser binary, PLAYWRIGHT to override where the
// playwright package lives.

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PLAYWRIGHT = process.env.PLAYWRIGHT
  || (() => { try { return createRequire(import.meta.url).resolve('playwright'); }
              catch { return '/opt/node22/lib/node_modules/playwright/index.js'; } })();
const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const pw = (await import(PLAYWRIGHT)).default;
const { chromium, devices } = pw;


const TOKEN = 'c'.repeat(32);
const PORT = 8800 + Math.floor(Math.random() * 150);
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = process.argv[2] || 'test/e2e/screenshots';
mkdirSync(SHOTS, { recursive: true });

// A stand-in Obsidian vault so the bridge path is exercised for real.
const vault = mkdtempSync(join(tmpdir(), 'vault-'));
mkdirSync(join(vault, 'Recipes'), { recursive: true });
for (const n of ['Pad Thai', 'Rajma Chawal', 'Thai Green Curry']) {
  writeFileSync(join(vault, `Recipes/${n}.md`), `# ${n}\n\nIngredients...\n`);
}

const server = spawn(process.execPath, ['server/index.js'], {
  env: { ...process.env, PORT: String(PORT), SOUS_VAULT: vault, SOUS_TOKEN: TOKEN },
  stdio: 'inherit',
});
const waitUp = async () => {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/index.html`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server never came up');
};
await waitUp();

const browser = await chromium.launch({ executablePath: CHROMIUM });
const context = await browser.newContext({
  ...devices['Pixel 7'],
  permissions: ['microphone'],
});
const page = await context.newPage();

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const step = async (name) => {
  await page.waitForTimeout(280);
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
  console.log(`  ✓ ${name}`);
};

// 1. Boot, capturing the server token straight out of the URL.
await page.goto(`${BASE}/#setup=${TOKEN}`);
await page.waitForSelector('header.bar');
await step('01-home-empty');

// 2. Configure the Obsidian vault bridge in Settings.
await page.click('button[aria-label="Settings"]');
await page.waitForSelector('text=Vault bridge URL');
const obsidianCard = page.locator('section:has(> h2:text-is("Obsidian"))');
await obsidianCard.locator('input[placeholder="Sous Chef"]').fill('Sous Chef');
await obsidianCard.locator('input[placeholder="http://192.168.1.20:8787"]').fill(BASE);
await obsidianCard.locator('button:text-is("Test connection")').click();
await page.waitForSelector('text=Vault bridge connected', { timeout: 5000 });
await step('02-settings-connected');

await obsidianCard.locator('button:text-is("Save")').click();
await page.click('header.bar button[aria-label="Back"]');

// 3. Pick a recipe out of the vault.
await page.click('text=Start a cook');
await page.waitForSelector('input[type="search"]');
await page.fill('input[type="search"]', 'thai');
await page.waitForSelector('.row .title:text-is("Pad Thai")', { timeout: 5000 });
await step('03-picker-vault-results');

await page.click('.row:has(.title:text-is("Pad Thai"))');
await page.waitForSelector('.timer');
await step('04-cook-started');

// 4. Log captures. Photo capture is driven by setting files on the input the
//    app creates; voice is simulated by stubbing the recorder's two halves.
async function typeNote(text, waitMs) {
  await page.waitForTimeout(waitMs);
  await page.click('text=Type a note instead');
  await page.waitForSelector('dialog textarea');
  await page.fill('dialog textarea', text);
  await page.click('dialog button:text-is("Save")');
  await page.waitForTimeout(150);
}

await typeNote('water is on, salting it heavily', 1200);
await typeNote('noodles in — they look softer than last time', 1400);
await step('05-cook-with-notes');

// A photo, injected through the real capture path.
const jpeg = readFileSync('web/icons/icon-192.png');
page.once('filechooser', async (chooser) => {
  await chooser.setFiles({ name: 'shot.png', mimeType: 'image/png', buffer: jpeg });
});
await page.click('button[aria-label="Take a photo"]');
await page.waitForSelector('.entry img', { timeout: 8000 });
await step('06-cook-with-photo');

// 5. Finish and review.
await page.click('button:text("Finish cook")');
await page.click('dialog button:text-is("Finish")');
await page.waitForSelector('text=How did it go?');
await page.click('.rating button >> nth=3');
await page.fill('textarea', 'Soak the noodles longer; the sauce needed more tamarind.');
await page.locator('textarea').blur();
await step('07-review');

// 6. Publish to the vault through the bridge.
await page.click('.row:has(.title:text-is("Obsidian"))');
await page.waitForSelector('.notice.good', { timeout: 15000 });
await step('08-published');

await page.click('header.bar button[aria-label="Back"]');
await page.waitForSelector('.tag');
await step('09-home-with-history');

/* ---- verify what actually landed in the vault ---- */
const logsDir = join(vault, 'Recipes/Cook Logs');
const notes = readdirSync(logsDir);
console.log('\n  Vault notes:', notes);
const md = readFileSync(join(logsDir, notes[0]), 'utf8');
console.log('\n──────── written note ────────\n' + md + '──────────────────────────────\n');

const attachRoot = join(vault, 'attachments');
const attachDirs = readdirSync(attachRoot);
console.log('  Attachment folders:', attachDirs);
console.log('  Attachments:', readdirSync(join(attachRoot, attachDirs[0])));

const checks = [
  [notes.length === 1, 'exactly one note written'],
  [/type: cook-log/.test(md), 'frontmatter present'],
  [/recipe: "\[\[Pad Thai\]\]"/.test(md), 'wikilink back to the recipe'],
  [/rating: 4/.test(md), 'rating recorded'],
  [/salting it heavily/.test(md), 'first note in the timeline'],
  [/tamarind/.test(md), 'review notes included'],
  [/!\[\[attachments\/pad-thai-.*photo\.jpg\]\]/.test(md), 'photo embedded as an attachment'],
  [readdirSync(join(attachRoot, attachDirs[0])).length === 1, 'photo file written to the vault'],
];
let failed = 0;
console.log('');
for (const [ok, label] of checks) {
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failed++;
}
if (errors.length) { console.log('\n  Page errors:'); errors.forEach((e) => console.log('   ', e)); }

await browser.close();
server.kill();
rmSync(vault, { recursive: true, force: true });
process.exit(failed || errors.length ? 1 : 0);
