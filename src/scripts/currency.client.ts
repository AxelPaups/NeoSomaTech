// Bouton € / $ : réaffiche tous les prix (.money) dans la monnaie choisie, sans rechargement.
import { displayMoney, formatAmount, convert, moneyHtml, normalizeCurrency, sellerLine, type Currency } from '../lib/money';

const root = document.documentElement;
const rate = parseFloat(root.dataset.fxRate || '') || 1.15;
const locale = root.lang.startsWith('en') ? 'en-US' : 'fr-FR';
const labels = {
	seller: root.dataset.sellerLabel || 'Prix chez le vendeur : {price}',
	converted: root.dataset.convertedNote || 'converti au taux du jour',
};
const KEY = 'nst-currency';

function read(): Currency {
	try {
		const v = localStorage.getItem(KEY);
		if (v === 'USD' || v === 'EUR') return v;
	} catch {
		/* stockage indisponible : on retombe sur la monnaie par défaut */
	}
	return normalizeCurrency(root.dataset.defaultCurrency);
}

function updateEl(el: HTMLElement, target: Currency) {
	const amount = parseFloat(el.dataset.amt || '');
	if (!Number.isFinite(amount)) return;
	const d = displayMoney(amount, normalizeCurrency(el.dataset.cur), target, rate, locale);
	const main = el.querySelector('.money-main');
	if (main) main.textContent = d.text;
	const note = el.querySelector<HTMLElement>('.money-seller');
	if (note) {
		note.hidden = !d.converted;
		note.textContent = sellerLine(labels, d.sellerText);
	}
	if (d.converted) el.title = `${sellerLine(labels, d.sellerText)} (${labels.converted})`;
	else el.removeAttribute('title');
}

function paint(target: Currency) {
	root.dataset.currency = target;
	document.querySelectorAll<HTMLElement>('.money').forEach((el) => updateEl(el, target));
	document.querySelectorAll<HTMLElement>('[data-fx-set]').forEach((b) => {
		b.setAttribute('aria-pressed', String(b.dataset.fxSet === target));
	});
}

function announce(target: Currency) {
	document.dispatchEvent(new CustomEvent('nst:currency', { detail: { currency: target, rate } }));
}

function set(target: Currency) {
	try {
		localStorage.setItem(KEY, target);
	} catch {
		/* ignoré */
	}
	paint(target);
	announce(target);
}

const api = {
	get: read,
	set,
	rate,
	refresh: () => paint(read()),
	/** HTML d'un prix dans la monnaie courante (prix affichés par du JavaScript) */
	moneyHtml: (raw: unknown, seller: unknown, note = false) =>
		moneyHtml(raw, normalizeCurrency(seller), { rate, target: read(), locale, labels }, { note }),
	/** Montant exprimé en euros, affiché dans la monnaie courante (curseur de prix de la boutique) */
	formatEur: (amountEur: number) => {
		const target = read();
		return formatAmount(Math.round(convert(amountEur, 'EUR', target, rate)), target, locale);
	},
};
(window as any).nstCurrency = api;

document.addEventListener('click', (e) => {
	const btn = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-fx-set]');
	if (btn) set(normalizeCurrency(btn.dataset.fxSet));
});

paint(read());
announce(read());
