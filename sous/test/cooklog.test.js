import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatElapsed, formatDurationWords, elapsedAt, localDateStamp } from '../web/js/util/time.js';
import { slugify, sessionSlug, attachmentName, renderMarkdown, noteFilename } from '../web/js/render/cooklog.js';

test('formatElapsed rolls over to hours', () => {
  assert.equal(formatElapsed(0), '0:00');
  assert.equal(formatElapsed(9_000), '0:09');
  assert.equal(formatElapsed(74_000), '1:14');
  assert.equal(formatElapsed(3_599_000), '59:59');
  assert.equal(formatElapsed(3_725_000), '1:02:05');
  assert.equal(formatElapsed(-5), '0:00');
  assert.equal(formatElapsed(NaN), '0:00');
});

test('formatDurationWords reads naturally', () => {
  assert.equal(formatDurationWords(45_000), '45s');
  assert.equal(formatDurationWords(2_832_000), '47m');
  assert.equal(formatDurationWords(7_200_000), '2h');
  assert.equal(formatDurationWords(4_320_000), '1h 12m');
});

test('elapsedAt subtracts only pauses that precede the event', () => {
  const pauses = [{ startedAt: 2_000, endedAt: 5_000 }, { startedAt: 20_000, endedAt: 30_000 }];
  assert.equal(elapsedAt(10_000, 0, pauses), 7_000, 'one pause fully behind us');
  assert.equal(elapsedAt(1_000, 0, pauses), 1_000, 'no pause yet');
  assert.equal(elapsedAt(40_000, 0, pauses), 27_000, 'both pauses behind us');
  assert.equal(elapsedAt(25_000, 0, pauses), 17_000, 'event lands inside a pause');
});

test('elapsedAt handles an open-ended (still paused) window', () => {
  assert.equal(elapsedAt(10_000, 0, [{ startedAt: 4_000, endedAt: null }]), 4_000);
});

test('slugify produces readable, safe names', () => {
  assert.equal(slugify('Pad Thai'), 'pad-thai');
  assert.equal(slugify("Mom's Rajma  /  Kidney Beans!"), 'moms-rajma-kidney-beans');
  assert.equal(slugify('Crème Brûlée'), 'creme-brulee');
  assert.equal(slugify(''), 'cook');
  assert.equal(slugify('   '), 'cook');
});

test('attachment names sort by elapsed time as plain strings', () => {
  const a = attachmentName({ elapsedMs: 8_000, type: 'photo' }, 'jpg');
  const b = attachmentName({ elapsedMs: 520_000, type: 'photo' }, 'jpg');
  const c = attachmentName({ elapsedMs: 3_700_000, type: 'photo' }, 'jpg');
  assert.equal(a, '00008-photo.jpg');
  assert.deepEqual([c, a, b].sort(), [a, b, c]);
});

function fixture() {
  const startedAt = new Date('2026-09-09T14:32:00').getTime();
  const session = {
    startedAt,
    endedAt: startedAt + 2_832_000,
    recipeTitle: 'Pad Thai',
    rating: 4,
    notes: 'Soak the noodles longer next time.',
  };
  const events = [
    { type: 'photo', elapsedMs: 520_000, text: 'sauce right before it broke', attachment: '00840-photo.jpg' },
    { type: 'voice', elapsedMs: 134_000, text: "soaking the noodles now, water's just off the boil" },
    { type: 'marker', elapsedMs: 0, text: 'Started cooking' },
  ];
  return { session, events };
}

test('markdown renders events in elapsed order with Obsidian embeds', () => {
  const { session, events } = fixture();
  const md = renderMarkdown(session, events, {
    style: 'obsidian',
    attachmentDir: 'attachments/pad-thai-20260909-1432',
    recipeLink: { title: 'Pad Thai' },
  });

  assert.match(md, /^---\ntype: cook-log\n/);
  assert.match(md, /recipe: "\[\[Pad Thai\]\]"/);
  assert.match(md, /date: 2026-09-09/);
  assert.match(md, /duration: "47m"/);
  assert.match(md, /duration_minutes: 47/);
  assert.match(md, /rating: 4/);
  assert.match(md, /!\[\[attachments\/pad-thai-20260909-1432\/00840-photo\.jpg\]\]/);
  assert.match(md, /Soak the noodles longer next time\./);

  const order = ['**0:00**', '**2:14**', '**8:40**'].map((s) => md.indexOf(s));
  assert.ok(order.every((i) => i > -1), 'every timestamp present');
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'timeline is chronological');
});

test('plain style emits CommonMark links instead of wikilinks', () => {
  const { session, events } = fixture();
  const md = renderMarkdown(session, events, {
    style: 'plain',
    attachmentDir: 'attachments',
    recipeLink: { title: 'Pad Thai', url: 'https://notion.so/abc' },
  });
  assert.match(md, /\[Pad Thai\]\(https:\/\/notion\.so\/abc\)/);
  assert.match(md, /!\[sauce right before it broke\]\(attachments\/00840-photo\.jpg\)/);
  assert.doesNotMatch(md, /\[\[/);
});

test('a session with no captures still renders', () => {
  const md = renderMarkdown({ startedAt: Date.now(), endedAt: Date.now(), recipeTitle: null }, []);
  assert.match(md, /Freestyle cook/);
  assert.match(md, /No captures logged/);
});

test('voice audio is only embedded when the user chose to keep it', () => {
  const base = { startedAt: 0, endedAt: 60_000, recipeTitle: 'X' };
  const ev = { type: 'voice', elapsedMs: 1_000, text: 'hi', attachment: '00001-voice.webm' };
  assert.doesNotMatch(renderMarkdown(base, [ev]), /00001-voice\.webm/);
  assert.match(renderMarkdown(base, [{ ...ev, keepAudio: true }]), /!\[\[00001-voice\.webm\]\]/);
});

test('note filenames avoid path separators', () => {
  const name = noteFilename({ startedAt: new Date('2026-09-09T14:32:00').getTime(), recipeTitle: 'Rajma / Chawal' });
  assert.equal(name, '2026-09-09 Rajma - Chawal (cook log).md');
  assert.doesNotMatch(name, /\//);
});

test('session slug combines recipe and timestamp', () => {
  assert.equal(
    sessionSlug({ recipeTitle: 'Pad Thai', startedAt: new Date('2026-09-09T14:32:00').getTime() }),
    'pad-thai-20260909-1432',
  );
});

test('localDateStamp uses local time, not UTC', () => {
  assert.equal(localDateStamp(new Date('2026-09-09T23:30:00').getTime()), '2026-09-09');
});
