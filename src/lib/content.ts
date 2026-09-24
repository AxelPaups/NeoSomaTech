// Contenu multilingue : récupère produits et articles dans une langue donnée.
//
// Règles (voir docs du projet) :
// - Le français est la langue de base : les champs de la fiche elle-même.
// - Les autres langues lisent UNIQUEMENT leurs traductions (tables *_translations de Directus).
//   Un texte non traduit n'est jamais remplacé par du français : il reste vide.
// - Une page n'existe dans une langue que si sa traduction existe (pas de page vide ni de doublon).
import { fetchDirectus, slugifyBrand } from './directus';
import { locales, type Locale } from '../i18n';

/** Champs texte d'un produit qui vivent dans sa traduction. */
export const PRODUCT_TEXT_FIELDS = [
	'Nom_du_produit', 'nom_court', 'slug', 'descripton_simple', 'description_principale', 'seo_description',
	'texte_attente_sortie', 'custom_alts', 'poids', 'autonomie', 'assistance_max', 'temps_charge',
	'materiaux', 'garantie', 'certification',
] as const;
export const ARTICLE_TEXT_FIELDS = ['titre', 'slug', 'description_seo', 'meta_description', 'contenu'] as const;

export type Slugs = Partial<Record<Locale, string>>;

const translationOf = (item: any, locale: Locale) =>
	(item?.translations ?? []).find((t: any) => t?.languages_code === locale) ?? null;

/** Adresse (slug) de l'élément dans chaque langue où il est traduit. */
function slugsOf(item: any): Slugs {
	const slugs: Slugs = { fr: item.slug };
	for (const l of locales) {
		if (l === 'fr') continue;
		const s = translationOf(item, l)?.slug;
		if (s) slugs[l] = s;
	}
	return slugs;
}

function localizeItem(item: any, locale: Locale, textFields: readonly string[], keepFromTranslation: string[] = []) {
	const slugs = slugsOf(item);
	if (locale === 'fr') return { ...item, slugs };
	const tr = translationOf(item, locale);
	const out: any = { ...item, slugs };
	for (const f of textFields) out[f] = tr?.[f] ?? null;
	for (const f of keepFromTranslation) if (tr?.[f]) out[f] = tr[f];
	return out;
}

export function localizeProduct(product: any, locale: Locale) {
	const p = localizeItem(product, locale, PRODUCT_TEXT_FIELDS, ['Bouton_acheter']);
	if (Array.isArray(p.faqs)) {
		p.faqs = p.faqs
			.map((f: any) => {
				if (locale === 'fr') return f;
				const tr = translationOf(f, locale);
				return { ...f, question: tr?.question ?? null, reponse: tr?.reponse ?? null };
			})
			.filter((f: any) => f.question);
	}
	return p;
}

export const localizeArticle = (article: any, locale: Locale) => localizeItem(article, locale, ARTICLE_TEXT_FIELDS);

const TR = ',translations.*';

/** Liste de produits dans une langue. `fields` = champs de la fiche (sans les traductions, ajoutées ici). */
export async function listProducts(locale: Locale, fields: string, opts: { limit?: number; sort?: string } = {}) {
	const q = [`fields=${fields}${TR}`, `limit=${opts.limit ?? -1}`];
	if (opts.sort) q.push(`sort=${opts.sort}`);
	if (locale !== 'fr') q.push(`filter[translations][languages_code][_eq]=${locale}`);
	const data = await fetchDirectus(`/items/Produits?${q.join('&')}`);
	return (data ?? []).map((p: any) => localizeProduct(p, locale));
}

export async function listArticles(locale: Locale, fields: string, opts: { limit?: number } = {}) {
	const q = [`fields=${fields}${TR}`, `limit=${opts.limit ?? -1}`, 'sort=-date_publication'];
	if (locale !== 'fr') q.push(`filter[translations][languages_code][_eq]=${locale}`);
	const data = await fetchDirectus(`/items/Articles?${q.join('&')}`);
	const items = (data ?? []).map((a: any) => localizeArticle(a, locale)).filter((a: any) => a && a.slug);
	// Tri manuel : Directus peut trier alphabétiquement si le champ n'est pas typé "date"
	return items.sort((a: any, b: any) => {
		const da = a.date_publication ? new Date(a.date_publication).getTime() : 0;
		const db = b.date_publication ? new Date(b.date_publication).getTime() : 0;
		return db - da;
	});
}

/** Un produit par son adresse dans la langue demandée (null s'il n'existe pas ou n'est pas traduit). */
export async function getProduct(locale: Locale, slug: string, fields: string) {
	let filter = `filter[slug][_eq]=${encodeURIComponent(slug)}`;
	if (locale !== 'fr') {
		const hit = await fetchDirectus(
			`/items/Produits_translations?filter[slug][_eq]=${encodeURIComponent(slug)}&filter[languages_code][_eq]=${locale}&fields=Produits_id&limit=1`,
		);
		const id = hit?.[0]?.Produits_id;
		if (!id) return null;
		filter = `filter[id][_eq]=${id}`;
	}
	const data = await fetchDirectus(`/items/Produits?${filter}&fields=${fields},translations.*,faqs.translations.*&limit=1`);
	const item = Array.isArray(data) ? data[0] : data;
	return item ? localizeProduct(item, locale) : null;
}

export async function getArticle(locale: Locale, slug: string, fields: string) {
	let filter = `filter[slug][_eq]=${encodeURIComponent(slug)}`;
	if (locale !== 'fr') {
		const hit = await fetchDirectus(
			`/items/Articles_translations?filter[slug][_eq]=${encodeURIComponent(slug)}&filter[languages_code][_eq]=${locale}&fields=Articles_id&limit=1`,
		);
		const id = hit?.[0]?.Articles_id;
		if (!id) return null;
		filter = `filter[id][_eq]=${id}`;
	}
	const data = await fetchDirectus(`/items/Articles?${filter}&fields=${fields}${TR}&limit=1`);
	const item = Array.isArray(data) ? data[0] : data;
	return item ? localizeArticle(item, locale) : null;
}

/** Marques présentes dans la langue (en anglais : seulement celles qui ont au moins un produit traduit). */
export async function listBrands(locale: Locale): Promise<string[]> {
	const products = await listProducts(locale, 'marque');
	return [...new Set(products.map((p: any) => p.marque).filter(Boolean))].sort() as string[];
}

// --- Questions / réponses : uniquement les questions publiées (le jeton est Admin, Directus ne filtre pas) ---
export const QUESTION_TEXT_FIELDS = ['question', 'slug', 'reponse_courte', 'reponse', 'mots_cles'] as const;
export const localizeQuestion = (q: any, locale: Locale) => localizeItem(q, locale, QUESTION_TEXT_FIELDS);

const QUESTION_LIST_FIELDS = 'id,question,slug,reponse_courte,mots_cles,categorie,article_lie,produit_lie,date_publication,date_updated,auteur';
const QUESTION_FULL_FIELDS = `${QUESTION_LIST_FIELDS},reponse`;

export async function listQuestions(locale: Locale, fields: string = QUESTION_LIST_FIELDS) {
	// « question » est toujours demandé : sans titre, une question n'est affichable nulle part (index, hub, sitemap).
	const wanted = fields.split(',').includes('question') ? fields : `${fields},question`;
	const q = [`fields=${wanted}${TR}`, 'limit=-1', 'filter[statut][_eq]=publie', 'sort=-date_publication'];
	if (locale !== 'fr') q.push(`filter[translations][languages_code][_eq]=${locale}`);
	const data = await fetchDirectus(`/items/Questions?${q.join('&')}`);
	return (data ?? []).map((x: any) => localizeQuestion(x, locale)).filter((x: any) => x && x.slug && x.question);
}

/** Une question publiée par son adresse dans la langue demandée (null si absente, brouillon ou non traduite). */
export async function getQuestion(locale: Locale, slug: string) {
	let filter = `filter[slug][_eq]=${encodeURIComponent(slug)}`;
	if (locale !== 'fr') {
		const hit = await fetchDirectus(
			`/items/Questions_translations?filter[slug][_eq]=${encodeURIComponent(slug)}&filter[languages_code][_eq]=${locale}&fields=Questions_id&limit=1`,
		);
		const id = hit?.[0]?.Questions_id;
		if (!id) return null;
		filter = `filter[id][_eq]=${id}`;
	}
	const data = await fetchDirectus(`/items/Questions?${filter}&filter[statut][_eq]=publie&fields=${QUESTION_FULL_FIELDS}${TR}&limit=1`);
	const item = Array.isArray(data) ? data[0] : data;
	const q = item ? localizeQuestion(item, locale) : null;
	return q && q.slug && q.question ? q : null;
}

export { slugifyBrand };
