export const QUESTION_CATEGORIES = ['ski', 'genou', 'randonnee', 'dos-travail', 'achat-prix', 'sante-securite', 'technique'] as const;
export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

export const stripHtml = (html: string): string =>
	html
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

export const wordCount = (text: string): number => text.split(/\s+/).filter(Boolean).length;

/** Coupe au dernier mot entier avant `max` caractères et ajoute … */
export function truncate(text: string, max: number): string {
	if (text.length <= max) return text;
	const cut = text.slice(0, max);
	const lastSpace = cut.lastIndexOf(' ');
	return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Catégories connues dans l'ordre de QUESTION_CATEGORIES, puis « autre » (catégorie vide ou inconnue). */
export function groupByCategory<T extends { categorie?: string | null }>(items: T[]): { categorie: string; items: T[] }[] {
	const known: string[] = [...QUESTION_CATEGORIES];
	const map = new Map<string, T[]>();
	for (const item of items) {
		const c = item.categorie && known.includes(item.categorie) ? item.categorie : 'autre';
		const list = map.get(c) ?? [];
		list.push(item);
		map.set(c, list);
	}
	return [...known, 'autre'].filter((c) => map.has(c)).map((c) => ({ categorie: c, items: map.get(c)! }));
}

type Linkable = {
	slug: string;
	categorie?: string | null;
	article_lie?: number | null;
	produit_lie?: number | null;
	date_publication?: string | null;
};
const pubTime = (q: { date_publication?: string | null }) => (q.date_publication ? new Date(q.date_publication).getTime() : 0);

/** Questions voisines : même article lié, puis même produit, puis même catégorie, puis les autres ; récentes d'abord dans chaque groupe. */
export function relatedQuestions<T extends Linkable>(
	all: T[],
	current: { slug: string; categorie?: string | null; article_lie?: number | null; produit_lie?: number | null },
	n = 3,
): T[] {
	const others = all.filter((q) => q.slug !== current.slug).sort((a, b) => pubTime(b) - pubTime(a));
	const groups: ((q: T) => boolean)[] = [
		(q) => current.article_lie != null && q.article_lie === current.article_lie,
		(q) => current.produit_lie != null && q.produit_lie === current.produit_lie,
		(q) => !!current.categorie && q.categorie === current.categorie,
	];
	const picked: T[] = [];
	for (const match of groups) for (const q of others) if (!picked.includes(q) && match(q)) picked.push(q);
	for (const q of others) if (!picked.includes(q)) picked.push(q);
	return picked.slice(0, n);
}

/** Questions rattachées à un article (article_lie) ou à un produit (produit_lie), récentes d'abord. */
export function questionsLinkedTo<T extends Linkable>(all: T[], field: 'article_lie' | 'produit_lie', id: number, n = 6): T[] {
	return all.filter((q) => q[field] === id).sort((a, b) => pubTime(b) - pubTime(a)).slice(0, n);
}

const decodeBasic = (s: string) =>
	s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** Ajoute une ancre `section-N` à chaque <h2> de la réponse et renvoie le sommaire correspondant. */
export function addHeadingIds(html: string): { html: string; toc: { id: string; title: string }[] } {
	const toc: { id: string; title: string }[] = [];
	const out = html.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/g, (_m, attrs: string, inner: string) => {
		const id = `section-${toc.length + 1}`;
		toc.push({ id, title: decodeBasic(stripHtml(inner)) });
		return `<h2${attrs} id="${id}">${inner}</h2>`;
	});
	return { html: out, toc };
}
