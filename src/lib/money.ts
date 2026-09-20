// Prix et devises : module partagé entre le serveur (SSR) et le navigateur.
// Le prix saisi dans Directus est toujours celui du vendeur, dans la monnaie indiquée par `devise`.

export type Currency = 'EUR' | 'USD';

export interface MoneyLabels {
	seller: string;
	converted: string;
}

export interface MoneyCtx {
	/** USD pour 1 EUR */
	rate: number;
	/** monnaie d'affichage choisie */
	target: Currency;
	locale?: string;
	labels?: MoneyLabels;
}

const DEFAULT_LABELS: MoneyLabels = { seller: 'Prix chez le vendeur : {price}', converted: 'converti au taux du jour' };

export const sellerLine = (labels: MoneyLabels, price: string) => labels.seller.replace('{price}', price);

export const normalizeCurrency = (value: unknown): Currency =>
	String(value ?? '').trim().toUpperCase() === 'USD' ? 'USD' : 'EUR';

/** "1 399,00", "689.00", "699,00 €" -> nombre ; null si illisible */
export function parseAmount(raw: unknown): number | null {
	if (raw == null) return null;
	let s = String(raw).replace(/[^\d.,-]/g, '');
	if (s === '' || s === '-') return null;
	const lastComma = s.lastIndexOf(',');
	const lastDot = s.lastIndexOf('.');
	if (lastComma > -1 && lastDot > -1) {
		s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
	} else if (lastComma > -1) {
		s = s.replace(',', '.');
	}
	const n = parseFloat(s);
	return Number.isFinite(n) ? n : null;
}

export function convert(amount: number, from: Currency, to: Currency, usdPerEur: number): number {
	if (from === to) return amount;
	return from === 'EUR' ? amount * usdPerEur : amount / usdPerEur;
}

export function formatAmount(amount: number, currency: Currency, locale = 'fr-FR'): string {
	const whole = Math.abs(amount - Math.round(amount)) < 0.005;
	return new Intl.NumberFormat(locale, {
		style: 'currency',
		currency,
		minimumFractionDigits: whole ? 0 : 2,
		maximumFractionDigits: whole ? 0 : 2,
	}).format(amount);
}

/** Texte affiché : prix exact si la monnaie est celle du vendeur, sinon "≈" + montant arrondi. */
export function displayMoney(amount: number, seller: Currency, target: Currency, rate: number, locale = 'fr-FR') {
	const converted = seller !== target;
	const value = converted ? Math.round(convert(amount, seller, target, rate)) : amount;
	return {
		converted,
		text: (converted ? '≈ ' : '') + formatAmount(value, target, locale),
		sellerText: formatAmount(amount, seller, locale),
	};
}

/**
 * HTML d'un prix. Les attributs data-* permettent au navigateur de le réafficher
 * dans l'autre monnaie sans rechargement (voir currency.client.ts).
 */
export function moneyHtml(raw: unknown, seller: Currency, ctx: MoneyCtx, opts: { note?: boolean } = {}): string {
	const amount = parseAmount(raw);
	if (amount === null) return '';
	const d = displayMoney(amount, seller, ctx.target, ctx.rate, ctx.locale);
	const labels = ctx.labels ?? DEFAULT_LABELS;
	const title = d.converted ? ` title="${sellerLine(labels, d.sellerText)} (${labels.converted})"` : '';
	const note = opts.note
		? `<small class="money-seller"${d.converted ? '' : ' hidden'}>${sellerLine(labels, d.sellerText)}</small>`
		: '';
	return `<span class="money" data-amt="${amount}" data-cur="${seller}"${title}><span class="money-main">${d.text}</span>${note}</span>`;
}
