import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../../.env', import.meta.url), 'utf8');
const read = (key) => env.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1].trim().replace(/^["']|["']$/g, '');

export const token = read('PUBLIC_JETON_STATIQUE_DIRECT');
export const baseUrl = read('PUBLIC_URL_DIRECT') || 'https://spirited-squid.pikapod.net';

if (!token) throw new Error('PUBLIC_JETON_STATIQUE_DIRECT introuvable dans .env');

/** Appel REST Directus. Renvoie `data`, ou `null` sur 404 quand `allow404` est vrai. */
export async function directus(method, path, body, { allow404 = false } = {}) {
	const res = await fetch(`${baseUrl}${path}`, {
		method,
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	if (res.status === 204) return null;
	if (res.status === 404 && allow404) return null;
	const json = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json.errors ?? json)}`);
	return json.data;
}
