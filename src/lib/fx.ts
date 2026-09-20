// Taux de change EUR -> USD (source : Banque centrale européenne via Frankfurter, repli : open.er-api.com).
// Mis en cache en mémoire et, sur Cloudflare, dans le cache du réseau : un seul appel réel par jour environ.

export interface Fx {
	/** USD pour 1 EUR */
	usdPerEur: number;
	date: string;
	source: 'live' | 'fallback';
}

// Dernier taux connu, utilisé seulement si aucune source n'est joignable.
const FALLBACK: Fx = { usdPerEur: 1.146, date: '2026-09-18', source: 'fallback' };
const TTL_MS = 6 * 60 * 60 * 1000;

let cache: (Fx & { at: number }) | null = null;

async function getJson(url: string): Promise<any> {
	const res = await fetch(url, {
		signal: AbortSignal.timeout(2500),
		// Cloudflare : garde la réponse 6 h au niveau du réseau (ignoré en local)
		cf: { cacheTtl: 21600, cacheEverything: true },
	} as RequestInit);
	if (!res.ok) throw new Error(`FX ${res.status}`);
	return res.json();
}

const sane = (n: unknown): n is number => typeof n === 'number' && n > 0.5 && n < 2.5;

export async function getFx(): Promise<Fx> {
	if (cache && Date.now() - cache.at < TTL_MS) return cache;

	try {
		const j = await getJson('https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD');
		if (sane(j?.rates?.USD)) {
			cache = { usdPerEur: j.rates.USD, date: String(j.date ?? ''), source: 'live', at: Date.now() };
			return cache;
		}
	} catch {
		/* on tente la source de secours */
	}

	try {
		const j = await getJson('https://open.er-api.com/v6/latest/EUR');
		if (sane(j?.rates?.USD)) {
			const date = j.time_last_update_utc ? new Date(j.time_last_update_utc).toISOString().slice(0, 10) : '';
			cache = { usdPerEur: j.rates.USD, date, source: 'live', at: Date.now() };
			return cache;
		}
	} catch {
		/* repli ci-dessous */
	}

	return cache ?? FALLBACK;
}
