import { fetchDirectus, slugifyBrand } from './directus';
import { listProducts, listBrands } from './content';
import { path, type Locale } from '../i18n';

/** Articles qui mentionnent cette marque dans leur contenu, les plus récents d'abord (même principe que sur les fiches produit). */
async function loadArticlesLies(locale: Locale, brandName: string) {
	if (!brandName) return [];
	const term = encodeURIComponent(brandName);
	try {
		if (locale === 'fr') {
			const data = await fetchDirectus(
				`/items/Articles?filter[contenu][_contains]=${term}&fields=titre,slug,description_seo,image_principale,date_publication&sort=-date_publication&limit=3`,
			);
			return Array.isArray(data) ? data.filter((a: any) => a && a.slug) : [];
		}
		const data = await fetchDirectus(
			`/items/Articles_translations?filter[languages_code][_eq]=${locale}&filter[contenu][_contains]=${term}&fields=titre,slug,description_seo,Articles_id.image_principale,Articles_id.date_publication&sort=-Articles_id.date_publication&limit=3`,
		);
		return (Array.isArray(data) ? data : [])
			.filter((a: any) => a && a.slug)
			.map((a: any) => ({
				titre: a.titre,
				slug: a.slug,
				description_seo: a.description_seo,
				image_principale: a.Articles_id?.image_principale ?? null,
				date_publication: a.Articles_id?.date_publication ?? null,
			}));
	} catch {
		return [];
	}
}

/** Données d'une page marque. `redirect` est renseigné quand la marque n'existe pas dans cette langue. */
export async function loadBrandPage(locale: Locale, brandSlug: string | undefined) {
	let produits: any[] = [];
	let brandName = '';
	let articlesLies: any[] = [];
	let errorMessage: string | null = null;

	try {
		const all = await listProducts(
			locale,
			'id,Nom_du_produit,prix,devise,descripton_simple,slug,image,marque,promo,prix_promo',
			{ limit: 200 },
		);
		const matched = all.filter((p: any) => p.marque && slugifyBrand(p.marque) === brandSlug);
		if (matched.length > 0) {
			brandName = matched[0].marque;
			produits = matched;
			articlesLies = await loadArticlesLies(locale, brandName);
		}
	} catch (error: any) {
		console.error(`Erreur page marque ${brandSlug}:`, error);
		errorMessage = error.message;
	}

	// Marque inconnue (et pas d'erreur Directus) : retour à la boutique de la même langue.
	const redirect = !brandName && !errorMessage ? path(locale, 'shop') : null;

	// La page existe dans l'autre langue seulement si la marque y a au moins un produit traduit.
	const alternates: Partial<Record<Locale, string>> = { [locale]: path(locale, 'shop', brandSlug) };
	for (const other of ['fr', 'en'] as Locale[]) {
		if (other === locale) continue;
		try {
			const brands = await listBrands(other);
			if (brands.some((b) => slugifyBrand(b) === brandSlug)) alternates[other] = path(other, 'shop', brandSlug);
		} catch {
			/* sans alternative si Directus ne répond pas */
		}
	}

	return { produits, brandName, articlesLies, errorMessage, redirect, alternates };
}
