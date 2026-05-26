export type ProductSpec = {
	key: string;
	label: string;
	value: string;
	icon: 'weight' | 'battery' | 'assist' | 'charge' | 'material' | 'warranty' | 'cert';
};

const SPEC_MAP: { field: keyof Record<string, unknown>; key: string; label: string; icon: ProductSpec['icon'] }[] = [
	{ field: 'poids', key: 'poids', label: 'Poids', icon: 'weight' },
	{ field: 'autonomie', key: 'autonomie', label: 'Autonomie', icon: 'battery' },
	{ field: 'assistance_max', key: 'assist', label: 'Assistance max.', icon: 'assist' },
	{ field: 'temps_charge', key: 'charge', label: 'Temps de charge', icon: 'charge' },
	{ field: 'materiaux', key: 'material', label: 'Matériaux', icon: 'material' },
	{ field: 'garantie', key: 'warranty', label: 'Garantie', icon: 'warranty' },
	{ field: 'certification', key: 'cert', label: 'Certification', icon: 'cert' },
];

// Définition statique de toutes les specs possibles.
// Sert à rendre la section "Caractéristiques clés" modulable lors du changement de variante.
export const SPEC_DEFS = SPEC_MAP;

export function getCustomAlts(raw: string | null | undefined): string[] {
	if (!raw) return [];
	return raw
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

export function collectGallery(
	mainImageId: string | null | undefined,
	galerie: unknown,
	directusUrl: string,
): string[] {
	const urls: string[] = [];
	if (mainImageId) urls.push(`${directusUrl}/assets/${mainImageId}`);

	if (galerie && Array.isArray(galerie)) {
		galerie.forEach((item: unknown) => {
			const fileId =
				typeof item === 'object' && item !== null
					? (item as { directus_files_id?: string; image?: string }).directus_files_id ||
						(item as { image?: string }).image
					: typeof item === 'string'
						? item
						: null;
			if (fileId) urls.push(`${directusUrl}/assets/${fileId}`);
		});
	}
	return [...new Set(urls)];
}

export function collectVariantGallery(
	variant: Record<string, unknown>,
	fallback: string[],
	directusUrl: string,
): string[] {
	const urls: string[] = [];
	if (variant.Image) urls.push(`${directusUrl}/assets/${variant.Image}`);
	if (variant.galerie && Array.isArray(variant.galerie)) {
		variant.galerie.forEach((item: unknown) => {
			const fileId =
				typeof item === 'object' && item !== null
					? (item as { directus_files_id?: string; image?: string }).directus_files_id ||
						(item as { image?: string }).image
					: typeof item === 'string'
						? item
						: null;
			if (fileId) urls.push(`${directusUrl}/assets/${fileId}`);
		});
	}
	const merged = urls.length > 0 ? urls : fallback;
	return [...new Set(merged)];
}

export function parsePromo(promo: boolean | undefined, prix_promo: string | number | null | undefined) {
	if (!promo || !prix_promo) {
		return { isPromoValid: false, displayPromoPrice: '' };
	}
	const rawPromo = String(prix_promo).replace(',', '.').replace(/[^\d.-]/g, '');
	const promoNum = parseFloat(rawPromo);
	if (!isNaN(promoNum)) {
		return {
			isPromoValid: true,
			displayPromoPrice: `${promoNum.toFixed(2).replace('.00', '')} €`,
		};
	}
	return {
		isPromoValid: true,
		displayPromoPrice: String(prix_promo).includes('€') ? String(prix_promo) : `${prix_promo} €`,
	};
}

export function formatPriceDisplay(prix: string | number | null | undefined, withEuro = true): string {
	if (!prix) return '';
	const s = String(prix);
	return s.includes('€') ? s : withEuro ? `${s} €` : s;
}

export function parsePriceNumber(raw: string | number | null | undefined): number | null {
	if (raw == null || String(raw).trim() === '') return null;
	const n = parseFloat(String(raw).replace(',', '.').replace(/[^\d.-]/g, ''));
	return Number.isFinite(n) ? n : null;
}

export function formatPromoPriceLabel(prix_promo: string | number): string {
	const n = parsePriceNumber(prix_promo);
	if (n !== null) return `${n.toFixed(2).replace('.00', '')} €`;
	const s = String(prix_promo);
	return s.includes('€') ? s : `${s} €`;
}

export function getPromoPercent(original: string, promo: string): number | null {
	const o = parsePriceNumber(original);
	const p = parsePriceNumber(promo);
	if (o === null || p === null || o <= 0 || p >= o) return null;
	return Math.round((1 - p / o) * 100);
}

/** HTML prix — partagé entre Astro (SSR) et le script client (variantes) */
export function renderPriceHtml(prix: string, isPromo: boolean, prixPromo: string): string {
	const originalLabel = formatPriceDisplay(prix);

	if (!prix && !isPromo) {
		return `<div class="pp-price-display"><span class="price price-on-request">Sur demande</span></div>`;
	}

	if (isPromo && prixPromo) {
		const promoLabel = formatPromoPriceLabel(prixPromo);
		const pct = getPromoPercent(prix, prixPromo);
		const saveBadge = pct != null ? `<span class="pp-price-save" aria-label="Réduction">−${pct}%</span>` : '';
		const originalPart = originalLabel
			? `<span class="pp-original-line">Au lieu de <del class="pp-original-del">${originalLabel}</del></span>`
			: '';
		return `<div class="pp-price-display pp-price-display--promo">
			<span class="pp-promo-badge">Promo</span>
			<div class="pp-price-promo-row">
				<span class="price promo-price">${promoLabel}</span>
				${saveBadge}
			</div>
			${originalPart}
		</div>`;
	}

	return `<div class="pp-price-display">
		<span class="price price-main">${originalLabel || 'Sur demande'}</span>
	</div>`;
}

/** Titre animé — conserve les spans .pp-title-word au changement de variante */
export function renderTitleHtml(name: string): string {
	const words = name.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return '<span class="pp-title-line"></span>';
	const spans = words
		.map(
			(word, i) =>
				`<span class="pp-title-word" style="animation-delay:${(0.35 + i * 0.06).toFixed(2)}s">${word} </span>`,
		)
		.join('');
	return `<span class="pp-title-line">${spans}</span>`;
}

export function renderMarqueeText(name: string): string {
	return `${name.trim()} — `.repeat(4);
}

export function getProductSpecs(produit: Record<string, unknown> | null): ProductSpec[] {
	if (!produit) return [];
	return SPEC_MAP.filter((s) => {
		const v = produit[s.field as string];
		return v != null && String(v).trim() !== '';
	}).map((s) => ({
		key: s.key,
		label: s.label,
		value: String(produit[s.field as string]),
		icon: s.icon,
	}));
}

export const PRODUCT_FIELDS = [
	'id',
	'Nom_du_produit',
	'nom_court',
	'prix',
	'descripton_simple',
	'description_principale',
	'Bouton_acheter',
	'texte_attente_sortie',
	'image',
	'slug',
	'galerie.*',
	'marque',
	'variantes.*',
	'variantes.galerie.*',
	'promo',
	'prix_promo',
	'faqs.*',
	'seo_description',
	'custom_alts',
	'poids',
	'autonomie',
	'assistance_max',
	'temps_charge',
	'materiaux',
	'garantie',
	'certification',
].join(',');
