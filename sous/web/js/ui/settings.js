// Settings: connect the recipe managers, and say where the server lives.

import { el, clear, header, toast } from './dom.js';
import { adapterList, loadConfig, saveConfig } from '../adapters/index.js';
import * as obsidian from '../adapters/obsidian.js';
import { settings, estimateUsage } from '../db.js';
import { serverToken, setServerToken } from '../util/api.js';
import { canTranscribe, canRecordAudio } from '../capture/audio.js';

export async function render(root) {
  const main = el('main', {});

  /* ---- server token -------------------------------------------------- */

  const tokenInput = el('input', { type: 'password', value: await serverToken(), placeholder: 'Paste from the server terminal' });
  main.append(el('section', {},
    el('h2', {}, 'Server'),
    el('div', { class: 'card' },
      el('p', { class: 'small muted' },
        'Obsidian vault writes and Notion both go through the little server in this project. Run ',
        el('code', {}, 'npm start'),
        ' on the machine with your vault, then open the link it prints — that fills this in automatically.'),
      el('label', { class: 'field' },
        el('span', { class: 'label' }, 'Server token'),
        tokenInput),
      el('button', {
        class: 'btn-sm',
        onClick: async () => { await setServerToken(tokenInput.value.trim()); toast('Token saved'); },
      }, 'Save token'),
    ),
  ));

  /* ---- adapters ------------------------------------------------------ */

  for (const adapter of adapterList) {
    if (!adapter.configFields.length && adapter.id === 'local') continue;
    main.append(await adapterCard(adapter));
  }

  /* ---- capture preferences ------------------------------------------- */

  const keepAudio = await settings.get('keepAudio', false);
  const keepAudioInput = el('input', { type: 'checkbox', checked: keepAudio, style: 'width:auto;min-height:auto' });
  keepAudioInput.addEventListener('change', async () => {
    await settings.set('keepAudio', keepAudioInput.checked);
    toast(keepAudioInput.checked ? 'Audio clips will be kept' : 'Only transcripts will be kept');
  });

  main.append(el('section', {},
    el('h2', {}, 'Capture'),
    el('div', { class: 'card' },
      el('label', { class: 'field', style: 'display:flex;gap:12px;align-items:flex-start;margin:0' },
        keepAudioInput,
        el('span', {},
          el('span', { class: 'label' }, 'Keep the audio clip too'),
          el('span', { class: 'hint' }, 'Off by default: the transcript is what you search, and clips add up fast. Turn this on when you want the original.'))),
      el('div', { class: 'small muted', style: 'margin-top:14px' },
        el('div', {}, `Live transcription: ${canTranscribe() ? '✅ available' : '❌ not in this browser — voice notes will save as audio'}`),
        el('div', {}, `Audio recording: ${canRecordAudio() ? '✅ available' : '❌ unavailable'}`),
        el('div', { id: 'storage-line' }, 'Storage: checking…')),
    ),
  ));

  clear(root).append(header('Settings', { back: '#/' }), main);

  const usage = await estimateUsage();
  const line = document.getElementById('storage-line');
  if (line && usage) {
    line.textContent = `Storage: ${mb(usage.usage)} used of about ${mb(usage.quota)} available on this device`;
  } else if (line) {
    line.textContent = '';
  }
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

async function adapterCard(adapter) {
  const config = await loadConfig(adapter.id);
  const inputs = new Map();
  const statusLine = el('div', { class: 'small muted', style: 'margin-top:10px' });

  const card = el('div', { class: 'card' });

  for (const field of adapter.configFields) {
    const input = el('input', {
      type: field.type === 'password' ? 'password' : 'text',
      value: config[field.key] ?? '',
      placeholder: field.placeholder || '',
      autocapitalize: 'none',
      autocorrect: 'off',
      spellcheck: false,
    });
    inputs.set(field.key, input);
    card.append(el('label', { class: 'field' },
      el('span', { class: 'label' }, field.label, field.optional ? el('span', { class: 'muted' }, ' (optional)') : null),
      input,
      field.hint ? el('span', { class: 'hint' }, field.hint) : null,
    ));
  }

  const collect = () => {
    const next = { ...config };
    for (const [key, input] of inputs) next[key] = input.value.trim();
    return next;
  };

  const actions = el('div', { class: 'btn-row' },
    el('button', {
      class: 'btn-sm btn-primary',
      onClick: async () => {
        const next = collect();
        await saveConfig(adapter.id, next);
        Object.assign(config, next);
        toast(`${adapter.label} saved`);
      },
    }, 'Save'),
    el('button', {
      class: 'btn-sm',
      onClick: async () => {
        const next = collect();
        await saveConfig(adapter.id, next);
        Object.assign(config, next);
        statusLine.textContent = 'Testing…';
        try {
          if (adapter.id === 'obsidian') {
            const modes = await obsidian.probe(next);
            statusLine.innerHTML = '';
            statusLine.append(...modes.map((m) => el('div', {}, describeMode(m))));
          } else {
            const info = await adapter.probe(next);
            statusLine.textContent = info.title ? `✅ Connected to “${info.title}”` : '✅ Connected';
          }
        } catch (err) {
          statusLine.textContent = `❌ ${err.message}`;
        }
      },
    }, 'Test connection'),
  );

  // Desktop Chrome can hold a folder handle and write the vault with no server.
  if (adapter.id === 'obsidian' && obsidian.canUseFsAccess()) {
    actions.append(el('button', {
      class: 'btn-sm',
      onClick: async () => {
        try {
          const handle = await obsidian.pickVaultFolder();
          toast(`Vault folder “${handle.name}” connected`);
        } catch (err) {
          if (err.name !== 'AbortError') toast(err.message, 'bad');
        }
      },
    }, 'Pick vault folder'));
  }

  card.append(actions, statusLine);

  return el('section', {},
    el('h2', {}, adapter.label),
    adapter.id === 'obsidian'
      ? el('p', { class: 'small muted' }, 'Any one of these is enough: the vault bridge (server), a picked folder on desktop Chrome, or plain zip export you unzip into the vault.')
      : null,
    card,
  );
}

function describeMode(mode) {
  if (mode.error) return `❌ Vault bridge: ${mode.error}`;
  if (mode.mode === 'bridge') return `✅ Vault bridge connected → ${mode.detail}`;
  if (mode.mode === 'fsaccess') return `✅ Folder “${mode.detail}” connected`;
  return '✅ Zip export always available';
}
