/** Client-side fetch helpers shared by every page. */

export const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) return r.json().then((b) => Promise.reject(b)).catch(() => Promise.reject({ msg: `HTTP ${r.status}` }));
    return r.json();
  });

async function send(method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({ ok: false, msg: `HTTP ${res.status}` }));
  return json as { ok: boolean; msg?: string; code?: string; [k: string]: unknown };
}

export const postJSON = (url: string, body?: unknown) => send('POST', url, body);
export const patchJSON = (url: string, body?: unknown) => send('PATCH', url, body);
export const delJSON = (url: string) => send('DELETE', url);
