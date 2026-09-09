# Sous — a cook-along logger

Capture voice notes and photos **while you cook**, each stamped with how many
minutes into the recipe you were, then file the whole timeline back to the
recipe's source of truth in **Obsidian** or **Notion**.

The kitchen half is deliberately dumb: a running clock and two enormous
buttons. Everything lands in local storage first, so a dead Wi-Fi router or a
backgrounded tab never costs you a note. Syncing happens afterwards, when your
hands are clean.

```
Pick a recipe  →  cook, tapping 🎙 / 📷  →  review & rate  →  push to Obsidian / Notion
```

## What it produces

A cook log like this, dropped next to the recipe it belongs to:

```markdown
---
type: cook-log
recipe: "[[Pad Thai]]"
date: 2026-09-09
duration: "47m"
duration_minutes: 47
rating: 4
tags: [cook-log, sous]
---

# Pad Thai — cook log

*9 Sep 2026, 2:32 pm · 47m total · ★★★★☆*

Recipe: [[Pad Thai]]

## Notes for next time

Soak the noodles longer; the sauce needed more tamarind.

## Timeline

**2:14** 🎙 soaking the noodles now, water's just off the boil

**8:40** 📷 the sauce right before it broke
![[attachments/pad-thai-20260909-1432/00520-photo.jpg]]
```

Because the timestamps are relative to when you started, the log answers the
question a recipe never does: *how long did this actually take me, and when did
each thing happen?*

## Running it

```bash
npm start          # serves the app, bridges your vault, proxies Notion
```

It prints a URL with a one-time setup token:

```
Open on your phone:  http://192.168.1.20:8787/#setup=8f3a…
```

Open that on your Android phone, then **Chrome menu → Add to Home screen**. It
installs as a standalone app with its own icon and no browser chrome.

There are no dependencies to install — the server is plain Node, and the app is
plain ES modules. `npm test` runs the unit suite.

### Environment

| Variable       | What it does                                                          |
| -------------- | --------------------------------------------------------------------- |
| `SOUS_VAULT`   | Absolute path to your Obsidian vault. Enables direct vault writes.     |
| `NOTION_TOKEN` | Notion integration token. Safer here than typed into the phone.        |
| `SOUS_TOKEN`   | Shared secret for `/api/*`. Generated per run if unset.                |
| `PORT`         | Defaults to `8787`.                                                    |

```bash
SOUS_VAULT=~/Documents/SousChef NOTION_TOKEN=ntn_… npm start
```

`/api/*` requires `SOUS_TOKEN` because this server can write to your filesystem
and holds your Notion token — an unauthenticated endpoint on your LAN would let
any page you happened to visit reach it.

## Connecting a recipe manager

Settings lists every source; the recipe picker searches all of them at once, so
you don't have to remember where a recipe lives.

### Obsidian

Three routes in, tried in that order — **any one is enough**:

1. **Vault bridge.** Run `npm start` with `SOUS_VAULT` set on the machine
   holding the vault, and put that machine's address in Settings → Obsidian →
   *Vault bridge URL*. Reads your recipes, writes logs and attachments straight
   into the vault. Best experience; needs the machine awake.
2. **Folder access.** On desktop Chrome, *Pick vault folder* grants a
   persistent handle and writes the vault directly, no server involved. (Chrome
   on Android does not support this yet.)
3. **Bundle export.** Always available, works entirely offline. You get a
   `.zip` (note + attachments) through the Android share sheet, plus an
   `obsidian://` link that drops just the note into the vault.

Point *Recipes folder* at where your recipe notes live and *Cook logs folder*
at where new logs should land.

### Notion

1. Create an integration at <https://notion.so/my-integrations>, then share
   your recipe database with it.
2. Put the token in `NOTION_TOKEN` (preferred) or Settings → Notion.
3. Copy the 32-character database ID out of the database URL.

Each cook becomes a child page of the recipe, or a row in a dedicated cook-log
database if you set one. Photos upload as real Notion files.

Notion sends no CORS headers, so these calls go through this project's server —
that is the one piece Notion cannot do from a phone alone.

## How voice notes work

Chrome on Android transcribes speech on-device, free and instantly, so a voice
note is stored as **searchable text** by default. That is the point: a cook log
full of audio files is a cook log you will never read again.

Settings → *Keep the audio clip too* additionally saves the original recording
when you want to hear the tone rather than the words. Where speech recognition
isn't available, voice notes fall back to plain audio and you can type the
transcript in during review.

Transcription in a loud kitchen is imperfect. Every entry is editable on the
review screen before you publish.

## Notes on the design

- **Wall-clock stamps, not a counter.** Elapsed times are recomputed from
  absolute timestamps, so the app being killed or backgrounded mid-cook — which
  Android will do — changes nothing. Pauses are a ledger of intervals that get
  subtracted.
- **Local first.** Captures go to IndexedDB immediately and are only pushed
  when you choose. Nothing is lost if the network isn't there.
- **A screen wake lock** is held while cooking, and reacquired when you come
  back to the tab.
- **Photos are downscaled** to 1600px JPEG on the way in; twenty raw phone
  photos would otherwise blow the origin storage quota.
- **One adapter interface.** `searchRecipes` + `publish` over a shared bundle
  (`markdown` + named attachments). Adding a third recipe manager is a new file
  in `web/js/adapters/`, not a rewrite.
- **No build step and no dependencies.** This repo's previous life was a
  Flutter app that can no longer be built because its 2020 dependencies rotted.
  Plain ES modules and plain Node will still run in five years.

## Layout

```
server/
  index.js        static serving, auth, routing
  vault.js        Obsidian filesystem access (path-traversal safe)
  notion.js       Notion REST: search, file upload, page creation
web/
  js/
    session.js    the cook state machine
    db.js         IndexedDB
    capture/      microphone + camera
    adapters/     obsidian · notion · local, behind one interface
    render/       session → Markdown
    ui/           the five screens
test/
  *.test.js       unit tests — `npm test`
  e2e/            Playwright drivers for the whole flow
```

## Testing

```bash
npm test                              # unit: markdown, zip, vault, server HTTP
node test/e2e/vault-flow.mjs          # picks a recipe from a real vault, cooks, publishes
node test/e2e/capture-and-export.mjs  # dark mode, voice capture, zip export
```

The e2e scripts need Playwright and a Chromium binary; they are not part of
`npm test` and are not dependencies of the project.

## Known limits

- Speech recognition and its accuracy come from the browser. Chrome on Android
  is good; other browsers vary, and some route audio to a server.
- Recording stops if you switch apps mid-note — a web app cannot hold the
  microphone in the background. The timer is unaffected.
- The vault bridge and Notion both need the server reachable. Capture never
  does.
