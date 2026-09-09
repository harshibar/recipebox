// Notion REST calls. Lives server-side for two reasons: Notion sends no CORS
// headers, and the integration token is safer in an environment variable than
// in a phone's IndexedDB.

const NOTION_VERSION = '2022-06-28';
const API = 'https://api.notion.com/v1';

class NotionError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function notionFetch(token, path, { method = 'GET', body, headers = {} } = {}) {
  if (!token) throw new NotionError('No Notion token. Set NOTION_TOKEN on the server, or enter one in Settings.', 400);
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { message: text }; }
  if (!res.ok) throw new NotionError(json.message || `Notion returned ${res.status}`, res.status);
  return json;
}

export async function status(token, databaseId) {
  if (!databaseId) return { ok: true, message: 'Token accepted; no database configured yet.' };
  const db = await notionFetch(token, `/databases/${databaseId}`);
  const title = (db.title || []).map((t) => t.plain_text).join('') || 'Untitled database';
  return { ok: true, title, id: db.id };
}

/**
 * Notion has no "contains" filter that works across unknown title property
 * names, so we query the database and filter on the title client-side. For a
 * personal recipe box that is a page or two of results, not a scaling problem.
 */
export async function searchRecipes(token, databaseId, query) {
  const results = [];
  let cursor;
  do {
    const page = await notionFetch(token, `/databases/${databaseId}/query`, {
      method: 'POST',
      body: { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) },
    });
    results.push(...page.results);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor && results.length < 500);

  const q = (query || '').trim().toLowerCase();
  const titleOf = (page) => {
    for (const value of Object.values(page.properties || {})) {
      if (value?.type === 'title') return value.title.map((t) => t.plain_text).join('');
    }
    return '';
  };
  const matched = q ? results.filter((p) => titleOf(p).toLowerCase().includes(q)) : results;
  return matched.slice(0, 50);
}

/** Two-step file upload, then the id can be referenced by an image block. */
export async function uploadFile(token, { filename, contentType, base64 }) {
  const created = await notionFetch(token, '/file_uploads', {
    method: 'POST',
    body: { mode: 'single_part', filename, content_type: contentType },
  });

  const bytes = Buffer.from(base64, 'base64');
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: contentType }), filename);

  const res = await fetch(created.upload_url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION },
    body: form,
  });
  if (!res.ok) {
    throw new NotionError(`File upload failed: ${res.status} ${await res.text().catch(() => '')}`.trim(), res.status);
  }
  return { id: created.id };
}

/**
 * Notion caps children at 100 blocks per request, so long cooks are appended in
 * batches after the page is created.
 */
export async function createLog(token, { parent, title, blocks, startedAt }) {
  const properties = parent.database_id
    ? await titleProperty(token, parent.database_id, title, startedAt)
    : { title: { title: [{ type: 'text', text: { content: title } }] } };

  const page = await notionFetch(token, '/pages', {
    method: 'POST',
    body: { parent, properties, children: blocks.slice(0, 100) },
  });

  for (let i = 100; i < blocks.length; i += 100) {
    await notionFetch(token, `/blocks/${page.id}/children`, {
      method: 'PATCH',
      body: { children: blocks.slice(i, i + 100) },
    });
  }
  return { id: page.id, url: page.url };
}

/** Find what the target database calls its title (and date) property. */
async function titleProperty(token, databaseId, title, startedAt) {
  const db = await notionFetch(token, `/databases/${databaseId}`);
  const props = {};
  for (const [name, def] of Object.entries(db.properties || {})) {
    if (def.type === 'title') props[name] = { title: [{ type: 'text', text: { content: title } }] };
    else if (def.type === 'date' && startedAt && !props.__date) {
      props[name] = { date: { start: startedAt } };
      props.__date = true;
    }
  }
  delete props.__date;
  if (Object.keys(props).length === 0) {
    props.Name = { title: [{ type: 'text', text: { content: title } }] };
  }
  return props;
}

export { NotionError };
