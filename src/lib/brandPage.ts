import { slugifyBrand } from './directus';
import { listProducts, listBrands } from './content';
import { path, type Locale } from '../i18n';

/** Données d'une page marque. `redirect` est renseigné quand la marque n'existe pas dans cette langue. */
export async function loadBrandPage(locale: Locale, brandSlug: string | undefined) {
	let produits: any[] = [];
	let brandName = '';
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

	return { produits, brandName, errorMessage, redirect, alternates };
}
