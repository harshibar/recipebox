// A hundred lines of DOM helpers instead of a framework. This app has five
// screens and no shared reactive state worth a runtime.

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in node && key !== 'list') {
      node[key] = value;
    } else {
      node.setAttribute(key, value === true ? '' : value);
    }
  }
  append(node, children);
  return node;
}

function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

let toastTimer;
export function toast(message, kind = '') {
  const node = document.getElementById('toast');
  if (!node) return;
  node.textContent = message;
  node.className = `show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.className = kind; }, kind === 'bad' ? 5200 : 3000);
}

/** Promise-based confirm that does not block the main thread like window.confirm. */
export function confirmAction({ title, body, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const dialog = el('dialog', { class: 'card', style: 'border:0;border-radius:var(--r-lg);padding:22px;max-width:min(420px,92vw)' },
      el('h3', { style: 'margin:0 0 8px;font-size:19px' }, title),
      body ? el('p', { class: 'muted' }, body) : null,
      el('div', { class: 'btn-row', style: 'margin-top:18px;justify-content:flex-end' },
        el('button', { class: 'btn-ghost', onClick: () => finish(false) }, 'Cancel'),
        el('button', { class: danger ? 'btn-danger' : 'btn-primary', onClick: () => finish(true) }, confirmLabel),
      ),
    );
    const finish = (value) => { dialog.close(); dialog.remove(); resolve(value); };
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); finish(false); });
    document.body.append(dialog);
    dialog.showModal();
  });
}

/** Ask for one line of text. Used for photo captions and quick notes. */
export function promptText({ title, placeholder = '', value = '', multiline = false, confirmLabel = 'Save' }) {
  return new Promise((resolve) => {
    const input = multiline
      ? el('textarea', { placeholder, value })
      : el('input', { type: 'text', placeholder, value });

    const dialog = el('dialog', { class: 'card', style: 'border:0;border-radius:var(--r-lg);padding:22px;width:min(460px,92vw)' },
      el('h3', { style: 'margin:0 0 12px;font-size:19px' }, title),
      input,
      el('div', { class: 'btn-row', style: 'margin-top:16px;justify-content:flex-end' },
        el('button', { class: 'btn-ghost', onClick: () => finish(null) }, 'Cancel'),
        el('button', { class: 'btn-primary', onClick: () => finish(input.value.trim()) }, confirmLabel),
      ),
    );
    const finish = (v) => { dialog.close(); dialog.remove(); resolve(v); };
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); finish(null); });
    if (!multiline) {
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(input.value.trim()); });
    }
    document.body.append(dialog);
    dialog.showModal();
    setTimeout(() => input.focus(), 50);
  });
}

export function header(title, { back = null, actions = [] } = {}) {
  return el('header', { class: 'bar' },
    back ? el('button', { class: 'btn-ghost btn-icon', 'aria-label': 'Back', onClick: () => (location.hash = back) }, '‹') : null,
    el('h1', {}, title),
    ...actions,
  );
}

/** Save a Blob/Uint8Array to the device, preferring the Android share sheet. */
export async function deliverFile(data, filename, mime = 'application/zip') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const file = new File([blob], filename, { type: mime });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled';
      // Fall through to a download.
    }
  }

  const url = URL.createObjectURL(blob);
  const link = el('a', { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
