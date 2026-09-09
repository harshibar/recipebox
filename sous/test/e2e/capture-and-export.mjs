// End-to-end: drives the real app in Chromium against a real server and a
// throwaway Obsidian vault. Not part of `npm test` — Playwright is not a
// dependency of this project. Run it when you have one available:
//
//   node test/e2e/capture-and-export.mjs
//
// Set CHROMIUM to override the browser binary, PLAYWRIGHT to override where the
// playwright package lives.

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const PLAYWRIGHT = process.env.PLAYWRIGHT
  || (() => { try { return createRequire(import.meta.url).resolve('playwright'); }
              catch { return '/opt/node22/lib/node_modules/playwright/index.js'; } })();
const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const pw = (await import(PLAYWRIGHT)).default;
const { chromium, devices } = pw;


const TOKEN = 'd'.repeat(32);
const PORT = 8960 + Math.floor(Math.random() * 120);
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = process.argv[2] || 'test/e2e/screenshots';
const DL = join(SHOTS, 'downloads');
mkdirSync(SHOTS, { recursive: true });
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

const server = spawn(process.execPath, ['server/index.js'], {
  env: { ...process.env, PORT: String(PORT), SOUS_TOKEN: TOKEN }, stdio: 'ignore',
});
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`${BASE}/index.html`)).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 100));
}

const browser = await chromium.launch({
  executablePath: CHROMIUM,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});

const errors = [];
const results = [];
const check = (ok, label) => { results.push([ok, label]); console.log(`  ${ok ? '✓' : '✗'} ${label}`); };

/* ---------- dark mode ---------- */
{
  const ctx = await browser.newContext({ ...devices['Pixel 7'], colorScheme: 'dark' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`dark: ${e.message}`));
  await page.goto(`${BASE}/#setup=${TOKEN}`);
  await page.waitForSelector('header.bar');
  await page.click('text=Start a cook');
  await page.waitForSelector('input[type="search"]');
  await page.fill('input[type="search"]', 'Chana Masala');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Add")');
  await page.waitForSelector('.timer');
  await page.click('text=Type a note instead');
  await page.fill('dialog textarea', 'blooming the spices, kitchen smells great');
  await page.click('dialog button:text-is("Save")');
  await page.waitForSelector('.entry');
  await page.screenshot({ path: join(SHOTS, '10-dark-cook.png') });
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check(bg === 'rgb(22, 19, 15)', `dark theme applied to body (${bg})`);
  await ctx.close();
}

/* ---------- voice capture with a fake mic + stubbed recogniser ---------- */
{
  const ctx = await browser.newContext({ ...devices['Pixel 7'], permissions: ['microphone'] });
  await ctx.addInitScript(() => {
    // Headless Chromium ships no SpeechRecognition; stand in for it so the
    // transcript half of the recorder is exercised for real.
    class FakeRecognition extends EventTarget {
      start() {
        this._t = setTimeout(() => {
          const results = [[{ transcript: 'sauce is starting to split, killing the heat' }]];
          results[0].isFinal = true;
          results.isFinal = true;
          this.onresult?.({ resultIndex: 0, results: Object.assign(results, { length: 1 }) });
        }, 300);
      }
      stop() { clearTimeout(this._t); this.onend?.(); }
      abort() { clearTimeout(this._t); }
    }
    window.SpeechRecognition = FakeRecognition;
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`voice: ${e.message}`));
  await page.goto(`${BASE}/#setup=${TOKEN}`);
  await page.waitForSelector('header.bar');

  // Turn on "keep the audio clip too" so MediaRecorder runs alongside.
  await page.click('button[aria-label="Settings"]');
  await page.click('input[type="checkbox"]');
  await page.click('header.bar button[aria-label="Back"]');

  await page.click('text=Start a cook');
  await page.fill('input[type="search"]', 'Tadka Dal');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Add")');
  await page.waitForSelector('.timer');

  await page.click('button[aria-label="Record a voice note"]');
  await page.waitForSelector('.capture-btn.recording', { timeout: 5000 });
  // Wait for the stubbed recogniser to deliver, rather than sampling blind.
  await page.waitForFunction(
    () => (document.querySelector('.live-transcript')?.textContent || '').length > 0,
    null, { timeout: 5000 },
  );
  await page.screenshot({ path: join(SHOTS, '11-recording.png') });
  const live = await page.textContent('.live-transcript');
  check(/sauce is starting to split/.test(live), `live transcript renders while recording ("${live?.slice(0, 40)}…")`);

  await page.click('button.capture-btn.recording');
  await page.waitForSelector('.entry audio', { timeout: 10000 });
  const entryText = await page.textContent('.entry .text');
  check(/sauce is starting to split/.test(entryText), 'transcript saved to the timeline');
  check(await page.locator('.entry audio').count() === 1, 'audio clip kept when the setting is on');
  await page.screenshot({ path: join(SHOTS, '12-voice-saved.png') });

  /* ---------- finish + zip export via the local adapter ---------- */
  await page.click('button:text("Finish cook")');
  await page.click('dialog button:text-is("Finish")');
  await page.waitForSelector('text=How did it go?');

  const dl = page.waitForEvent('download', { timeout: 20000 });
  await page.click('.row:has(.title:text-is("On this device"))');
  const download = await dl;
  const zipPath = join(DL, download.suggestedFilename());
  await download.saveAs(zipPath);
  check(existsSync(zipPath), `zip exported as ${download.suggestedFilename()}`);

  execFileSync('unzip', ['-qq', '-o', zipPath, '-d', join(DL, 'x')]);
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
  const files = walk(join(DL, 'x')).map((f) => f.replace(join(DL, 'x') + '/', ''));
  console.log('  zip contents:', files);
  const mdPath = files.find((f) => f.endsWith('.md'));
  const md = readFileSync(join(DL, 'x', mdPath), 'utf8');
  check(files.some((f) => f.endsWith('.webm') || f.endsWith('.ogg')), 'audio attachment inside the zip');
  check(/sauce is starting to split/.test(md), 'transcript present in the exported markdown');
  check(!/\[\[/.test(md), 'local export uses plain markdown, not wikilinks');
  console.log('\n──────── exported note ────────\n' + md + '───────────────────────────────');
  await page.screenshot({ path: join(SHOTS, '13-exported.png') });
  await ctx.close();
}

if (errors.length) { console.log('\n  Page errors:'); errors.forEach((e) => console.log('   ', e)); }
await browser.close();
server.kill();
process.exit(results.some(([ok]) => !ok) || errors.length ? 1 : 0);
