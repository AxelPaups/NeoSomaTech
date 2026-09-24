// Recherche tolérante aux fautes, sans dépendance. Pure : tourne dans le navigateur et sous Node.
export type SearchLocale = 'fr' | 'en';

export interface SearchDoc {
	type: 'question' | 'article';
	slug: string;
	title: string;
	url: string;
	keywords?: string;
	snippet?: string;
	category?: string;
}

export interface SearchResult {
	doc: SearchDoc;
	score: number;
}

const STOPWORDS: Record<SearchLocale, Set<string>> = {
	fr: new Set(
		('le la les l un une des du de d et ou a au aux en dans sur pour par avec sans est sont ce cet cette ces c que qu qui quoi ' +
			'quel quelle quels quelles comment quand il elle on je tu nous vous ils elles se s sa son ses mon ma mes ne n pas y peut peuvent faut t m').split(' '),
	),
	en: new Set('the a an of for to in on and or is are be can do does did how what which when why with without at by from it its i my your you we they this that'.split(' ')),
};

const WEIGHTS = { keywords: 3, question: 2, article: 1.5, snippet: 1 };

export function normalize(text: string): string {
	return text
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/œ/g, 'oe')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

const stem = (w: string) => (w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w);

export function tokenize(text: string, locale: SearchLocale): string[] {
	const stop = STOPWORDS[locale];
	return normalize(text ?? '')
		.split(' ')
		.filter((w) => w && !stop.has(w))
		.map(stem);
}

/** Distance de Damerau-Levenshtein (transposition d'un cran), bornée : renvoie max + 1 dès que c'est dépassé. */
export function editDistance(a: string, b: string, max: number): number {
	if (Math.abs(a.length - b.length) > max) return max + 1;
	let prev2: number[] = [];
	let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const cur: number[] = [i];
		let rowMin = i;
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
			cur[j] = v;
			if (v < rowMin) rowMin = v;
		}
		if (rowMin > max) return max + 1;
		prev2 = prev;
		prev = cur;
	}
	return Math.min(prev[b.length], max + 1);
}

const tolerance = (len: number) => (len >= 8 ? 2 : len >= 4 ? 1 : 0);

/** 1 = identique, 0,8 = préfixe, 0,6 = faute de frappe, 0 = aucun rapport. */
function matchScore(q: string, d: string): number {
	if (q === d) return 1;
	const short = Math.min(q.length, d.length);
	const long = Math.max(q.length, d.length);
	// Frappe partielle : le mot cherché (3 lettres ou plus) est le début d'un mot du document.
	if (short >= 3 && d.startsWith(q)) return 0.8;
	// Le mot du document est le début d'un mot cherché plus long (ski / skier), sans grand écart de longueur.
	if (short >= 3 && short / long >= 0.5 && q.startsWith(d)) return 0.8;
	const tol = tolerance(q.length);
	if (tol > 0 && editDistance(q, d, tol) <= tol) return 0.6;
	return 0;
}

interface Fields {
	keywords: string[];
	title: string[];
	snippet: string[];
}
const cache = new WeakMap<SearchDoc, { locale: SearchLocale; fields: Fields }>();

function fieldsOf(doc: SearchDoc, locale: SearchLocale): Fields {
	const hit = cache.get(doc);
	if (hit && hit.locale === locale) return hit.fields;
	const fields = {
		keywords: tokenize(doc.keywords ?? '', locale),
		title: tokenize(doc.title, locale),
		snippet: tokenize(doc.snippet ?? '', locale),
	};
	cache.set(doc, { locale, fields });
	return fields;
}

export function search(query: string, docs: SearchDoc[], locale: SearchLocale, limit = 8): SearchResult[] {
	// Au-delà de 12 mots, la recherche ne gagne rien : on borne pour rester instantané.
	const q = tokenize(query, locale).slice(0, 12);
	if (q.length === 0) return [];
	const need = q.length === 1 ? 1 : Math.ceil(q.length * 0.6);
	const results: SearchResult[] = [];

	for (const doc of docs) {
		const f = fieldsOf(doc, locale);
		const groups: [string[], number][] = [
			[f.keywords, WEIGHTS.keywords],
			[f.title, doc.type === 'article' ? WEIGHTS.article : WEIGHTS.question],
			[f.snippet, WEIGHTS.snippet],
		];
		let score = 0;
		let matched = 0;
		for (const qt of q) {
			// Meilleur champ + un bonus pour chaque autre champ qui contient aussi le mot.
			const hits = groups.map(([tokens, weight]) => {
				let h = 0;
				for (const dt of tokens) h = Math.max(h, matchScore(qt, dt) * weight);
				return h;
			});
			const best = Math.max(...hits);
			if (best > 0) {
				matched++;
				score += best + 0.3 * (hits.reduce((sum, h) => sum + h, 0) - best);
			}
		}
		if (matched >= need) results.push({ doc, score });
	}

	results.sort(
		(a, b) =>
			b.score - a.score ||
			Number(b.doc.type === 'question') - Number(a.doc.type === 'question') ||
			a.doc.title.localeCompare(b.doc.title),
	);
	return results.slice(0, limit);
}
