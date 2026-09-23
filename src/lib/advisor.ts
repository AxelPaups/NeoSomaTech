// Conseiller exosquelette : classement des produits par pertinence selon les réponses au quiz.
//
// Chaque produit porte ses propres tags (advisor_usages, advisor_zones, advisor_type), remplis
// dans Directus. Si un produit n'a pas encore été tagué (nouveau produit, champ laissé vide),
// on retombe sur un profil par défaut déduit de sa marque — l'outil reste donc utilisable
// immédiatement pour tout nouveau produit, même avant que quelqu'un pense à le taguer à la main.

export type Usage = 'ski' | 'randonnee' | 'sport' | 'travail' | 'mobilite';
export type Zone = 'genou' | 'hanche' | 'dos' | 'epaules-bras' | 'cou' | 'jambes-endurance';
export type AssistType = 'passif' | 'motorise';

/** Zones pertinentes à proposer selon l'usage choisi (question 2 du quiz, dépend de la question 1). */
export const ZONES_BY_USAGE: Record<Usage, Zone[]> = {
	ski: ['genou', 'hanche', 'dos'],
	randonnee: ['genou', 'hanche', 'jambes-endurance', 'dos'],
	sport: ['genou', 'hanche', 'dos', 'epaules-bras'],
	travail: ['dos', 'epaules-bras', 'cou'],
	mobilite: ['genou', 'hanche', 'jambes-endurance', 'dos'],
};

/**
 * Profil par défaut par marque — utilisé uniquement quand un produit n'a pas ses propres tags.
 * À ajuster si une marque couvre plusieurs usages/zones très différents d'un modèle à l'autre
 * (c'est déjà le cas de Hapo et Dnsys : préférer alors le tag par produit plutôt que ce repli).
 */
const BRAND_DEFAULTS: Record<string, { usages: Usage[]; zones: Zone[]; type: AssistType }> = {
	'ski-mojo': { usages: ['ski'], zones: ['genou'], type: 'passif' },
	hypershell: { usages: ['randonnee', 'sport', 'mobilite'], zones: ['jambes-endurance'], type: 'motorise' },
	stoko: { usages: ['ski', 'sport'], zones: ['genou'], type: 'passif' },
	hapo: { usages: ['travail'], zones: ['dos'], type: 'passif' },
	dnsys: { usages: ['randonnee', 'sport'], zones: ['hanche', 'jambes-endurance'], type: 'motorise' },
	vigx: { usages: ['randonnee', 'sport', 'mobilite'], zones: ['hanche', 'jambes-endurance'], type: 'motorise' },
	imbrace: { usages: ['ski'], zones: ['genou', 'hanche', 'dos'], type: 'passif' },
};

const brandKey = (marque: unknown) =>
	String(marque ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export interface AdvisorTags {
	usages: Usage[];
	zones: Zone[];
	type: AssistType | null;
}

/** Tags effectifs d'un produit : les siens s'ils existent, sinon le repli par marque. */
export function getProductTags(product: { marque?: unknown; advisor_usages?: unknown; advisor_zones?: unknown; advisor_type?: unknown }): AdvisorTags {
	const ownUsages = Array.isArray(product.advisor_usages) ? (product.advisor_usages as Usage[]) : [];
	const ownZones = Array.isArray(product.advisor_zones) ? (product.advisor_zones as Zone[]) : [];
	const ownType = typeof product.advisor_type === 'string' && product.advisor_type ? (product.advisor_type as AssistType) : null;

	if (ownUsages.length && ownZones.length && ownType) return { usages: ownUsages, zones: ownZones, type: ownType };

	const fallback = BRAND_DEFAULTS[brandKey(product.marque)];
	return {
		usages: ownUsages.length ? ownUsages : (fallback?.usages ?? []),
		zones: ownZones.length ? ownZones : (fallback?.zones ?? []),
		type: ownType ?? fallback?.type ?? null,
	};
}

export type Budget = 'bas' | 'moyen' | 'haut';

/** Tranche de budget déduite du prix (toujours automatique, jamais taguée à la main). */
export function budgetTierOf(prixEur: number | null): Budget | null {
	if (prixEur == null || !Number.isFinite(prixEur)) return null;
	if (prixEur < 600) return 'bas';
	if (prixEur < 1500) return 'moyen';
	return 'haut';
}

export interface AdvisorAnswers {
	usage: Usage;
	zones: Zone[];
	type: AssistType | 'peu-importe';
	budget: Budget | 'peu-importe';
}

export interface ScoredProduct {
	product: any;
	score: number;
	matchedZones: Zone[];
}

/** Score un produit par rapport aux réponses ; un produit qui ne matche pas l'usage est éliminé. */
export function scoreProduct(product: any, answers: AdvisorAnswers, priceEur: number | null): ScoredProduct | null {
	const tags = getProductTags(product);
	if (!tags.usages.includes(answers.usage)) return null;

	let score = 3; // usage déjà validé au-dessus
	const matchedZones = answers.zones.filter((z) => tags.zones.includes(z));
	score += matchedZones.length * 3;
	// Si des zones précises ont été demandées, un produit qui n'en couvre aucune est écarté
	// (le score net retombe à 0, éliminé par le filtre `score > 0` de rankProducts) plutôt que
	// de remonter quand même avec un score faible mais positif.
	if (answers.zones.length > 0 && matchedZones.length === 0) score -= 3;

	if (answers.type !== 'peu-importe' && tags.type) {
		score += tags.type === answers.type ? 2 : -3;
	}

	if (answers.budget !== 'peu-importe') {
		const tier = budgetTierOf(priceEur);
		if (tier) score += tier === answers.budget ? 1 : -1;
	}

	return { product, score, matchedZones };
}

/** Classe et retourne les meilleurs produits (score strictement positif), triés, limités à `limit`. */
export function rankProducts(products: any[], answers: AdvisorAnswers, priceOf: (p: any) => number | null, limit = 3): ScoredProduct[] {
	return products
		.map((p) => scoreProduct(p, answers, priceOf(p)))
		.filter((s): s is ScoredProduct => s !== null && s.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit);
}
