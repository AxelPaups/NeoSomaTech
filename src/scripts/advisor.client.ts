import { ZONES_BY_USAGE, rankProducts, type AdvisorAnswers, type Usage, type Zone, type AssistType, type Budget } from '../lib/advisor';

interface ClientProduct {
	id: number;
	nom: string;
	nomCourt: string;
	slug: string;
	marque: string;
	desc: string;
	image: string | null;
	prix: string | number | null;
	devise: 'EUR' | 'USD';
	priceEur: number | null;
	usages: Usage[];
	zones: Zone[];
	type: AssistType | null;
	href: string;
}

document.addEventListener('DOMContentLoaded', () => {
	const app = document.getElementById('advisor-app');
	if (!app) return;

	let products: ClientProduct[] = [];
	let i18n: any = {};
	try {
		products = JSON.parse(document.getElementById('advisor-data')?.textContent || '[]');
	} catch {
		products = [];
	}
	try {
		i18n = JSON.parse(document.getElementById('advisor-i18n')?.textContent || '{}');
	} catch {
		i18n = {};
	}

	const quizEl = document.getElementById('advisor-quiz') as HTMLElement;
	const resultsEl = document.getElementById('advisor-results') as HTMLElement;
	const stepLabelEl = document.getElementById('advisor-step-label') as HTMLElement;
	const dots = Array.from(document.querySelectorAll('.step-dot')) as HTMLElement[];
	const shopHref = app.dataset.shopHref || '/boutique';

	type PartialAnswers = { usage: Usage | null; zones: Zone[]; type: AssistType | 'peu-importe' | null; budget: Budget | 'peu-importe' | null };
	const answers: PartialAnswers = { usage: null, zones: [], type: null, budget: null };
	let step = 1;

	const USAGE_ORDER: Usage[] = ['ski', 'randonnee', 'sport', 'travail', 'mobilite'];
	const TYPE_ORDER: (AssistType | 'peu-importe')[] = ['passif', 'motorise', 'peu-importe'];
	const BUDGET_ORDER: (Budget | 'peu-importe')[] = ['bas', 'moyen', 'haut', 'peu-importe'];

	function updateStepUi() {
		stepLabelEl.textContent = (i18n.stepLabel || 'Question {n} / {total}').replace('{n}', String(step)).replace('{total}', '4');
		dots.forEach((d, i) => {
			const n = i + 1;
			d.classList.toggle('is-active', n === step);
			d.classList.toggle('is-done', n < step);
		});
	}

	function optionButton(label: string, help: string | undefined, selected: boolean, onClick: () => void): HTMLButtonElement {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'advisor-opt' + (selected ? ' is-selected' : '');
		btn.innerHTML = help ? `${escapeHtml(label)}<span class="opt-help">${escapeHtml(help)}</span>` : escapeHtml(label);
		btn.addEventListener('click', onClick);
		return btn;
	}

	function escapeHtml(s: string) {
		return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
	}

	function renderStep() {
		quizEl.innerHTML = '';
		resultsEl.hidden = true;
		quizEl.hidden = false;
		updateStepUi();

		const wrap = document.createElement('div');
		wrap.className = 'advisor-question';

		if (step === 1) {
			wrap.innerHTML = `<h2>${escapeHtml(i18n.q1?.title || '')}</h2>`;
			const grid = document.createElement('div');
			grid.className = 'advisor-options';
			for (const u of USAGE_ORDER) {
				grid.appendChild(
					optionButton(i18n.usages?.[u] || u, undefined, answers.usage === u, () => {
						answers.usage = u;
						answers.zones = []; // les zones dépendent de l'usage : on réinitialise
						step = 2;
						renderStep();
					}),
				);
			}
			wrap.appendChild(grid);
		} else if (step === 2) {
			wrap.innerHTML = `<h2>${escapeHtml(i18n.q2?.title || '')}</h2><p class="hint">${escapeHtml(i18n.q2?.hint || '')}</p>`;
			const zoneOptions = answers.usage ? ZONES_BY_USAGE[answers.usage] : [];
			const grid = document.createElement('div');
			grid.className = 'advisor-options';
			for (const z of zoneOptions) {
				grid.appendChild(
					optionButton(i18n.zones?.[z] || z, undefined, answers.zones.includes(z), (function (zone) {
						return () => {
							const idx = answers.zones.indexOf(zone);
							if (idx === -1) answers.zones.push(zone);
							else answers.zones.splice(idx, 1);
							renderStep();
						};
					})(z)),
				);
			}
			wrap.appendChild(grid);
			wrap.appendChild(navRow(() => { step = 1; renderStep(); }, answers.zones.length > 0 ? () => { step = 3; renderStep(); } : null, () => { step = 3; renderStep(); }));
		} else if (step === 3) {
			wrap.innerHTML = `<h2>${escapeHtml(i18n.q3?.title || '')}</h2>`;
			const grid = document.createElement('div');
			grid.className = 'advisor-options';
			for (const ty of TYPE_ORDER) {
				const help = ty !== 'peu-importe' ? i18n.typeHelp?.[ty] : undefined;
				grid.appendChild(
					optionButton(i18n.types?.[ty] || ty, help, answers.type === ty, () => {
						answers.type = ty;
						step = 4;
						renderStep();
					}),
				);
			}
			wrap.appendChild(grid);
			wrap.appendChild(navRow(() => { step = 2; renderStep(); }, null, null));
		} else if (step === 4) {
			wrap.innerHTML = `<h2>${escapeHtml(i18n.q4?.title || '')}</h2>`;
			const grid = document.createElement('div');
			grid.className = 'advisor-options';
			for (const b of BUDGET_ORDER) {
				grid.appendChild(
					optionButton(i18n.budgets?.[b] || b, undefined, answers.budget === b, () => {
						answers.budget = b;
						showResults();
					}),
				);
			}
			wrap.appendChild(grid);
			wrap.appendChild(navRow(() => { step = 3; renderStep(); }, null, null));
		}

		quizEl.appendChild(wrap);
	}

	function navRow(onBack: () => void, onSkipIfAny: (() => void) | null, onSkipAlways: (() => void) | null): HTMLElement {
		const row = document.createElement('div');
		row.className = 'advisor-nav';
		const back = document.createElement('button');
		back.type = 'button';
		back.className = 'advisor-skip';
		back.textContent = i18n.back || '← Back';
		back.addEventListener('click', onBack);
		row.appendChild(back);
		const skipFn = onSkipAlways || onSkipIfAny;
		if (skipFn) {
			const skip = document.createElement('button');
			skip.type = 'button';
			skip.className = 'advisor-skip';
			skip.textContent = i18n.skip || 'Skip →';
			skip.addEventListener('click', skipFn);
			row.appendChild(skip);
		}
		return row;
	}

	function priceHtml(p: ClientProduct): string {
		if (p.prix == null) return `<span>${escapeHtml(i18n.results?.priceOnRequest || 'On request')}</span>`;
		const symbol = p.devise === 'USD' ? '$' : '€';
		return `<span>${escapeHtml(String(p.prix))} ${symbol}</span>`;
	}

	function whyText(p: ClientProduct, matchedZones: Zone[], ans: AdvisorAnswers): string {
		const parts: string[] = [];
		const usageLabel = (i18n.usages?.[ans.usage] || ans.usage).toLowerCase();
		parts.push(`${i18n.usages?.[ans.usage] || ans.usage}`.trim());
		if (matchedZones.length) {
			const zoneLabels = matchedZones.map((z) => (i18n.zones?.[z] || z).toLowerCase()).join(', ');
			parts.push(zoneLabels);
		}
		if (p.type) parts.push((i18n.types?.[p.type] || p.type).toLowerCase());
		return parts.filter(Boolean).join(' · ');
	}

	function showResults() {
		if (!answers.usage) return;
		const finalAnswers: AdvisorAnswers = {
			usage: answers.usage,
			zones: answers.zones,
			type: (answers.type as AssistType | 'peu-importe') || 'peu-importe',
			budget: (answers.budget as Budget | 'peu-importe') || 'peu-importe',
		};

		try {
			const params = new URLSearchParams();
			params.set('usage', finalAnswers.usage);
			if (finalAnswers.zones.length) params.set('zones', finalAnswers.zones.join(','));
			if (finalAnswers.type !== 'peu-importe') params.set('type', finalAnswers.type);
			if (finalAnswers.budget !== 'peu-importe') params.set('budget', finalAnswers.budget);
			history.replaceState(null, '', `?${params.toString()}`);
		} catch {
			/* URL sync best-effort */
		}

		const ranked = rankProducts(products, finalAnswers, (p) => p.priceEur, 3);

		quizEl.hidden = true;
		resultsEl.hidden = false;
		stepLabelEl.textContent = '';
		dots.forEach((d) => d.classList.add('is-done'));

		if (ranked.length === 0) {
			resultsEl.innerHTML = `
				<h2>${escapeHtml(i18n.results?.title || '')}</h2>
				<div class="advisor-empty">
					${escapeHtml(i18n.results?.empty || '')} <a href="${shopHref}">${escapeHtml(i18n.results?.emptyLink || '')}</a>.
				</div>
				<div class="advisor-nav"><button type="button" class="advisor-skip" id="advisor-restart">${escapeHtml(i18n.restart || 'Restart')}</button></div>
			`;
		} else {
			const cards = ranked
				.map(({ product: p, matchedZones }) => `
					<article class="advisor-result-card">
						<div class="advisor-result-img">
							${p.image ? `<img src="${p.image}" alt="${escapeHtml(p.nom)}" loading="lazy" decoding="async" width="160" height="160">` : ''}
						</div>
						<div class="advisor-result-body">
							${p.marque ? `<div class="advisor-result-brand">${escapeHtml(p.marque)}</div>` : ''}
							<h3><a href="${p.href}">${escapeHtml(p.nomCourt)}</a></h3>
							<div class="advisor-result-price">${priceHtml(p)}</div>
							<p class="advisor-result-why"><strong>${escapeHtml(i18n.results?.why || 'Why')}</strong> — ${escapeHtml(whyText(p, matchedZones, finalAnswers))}</p>
							<a class="advisor-result-link" href="${p.href}">${escapeHtml(i18n.results?.viewProduct || 'View →')}</a>
						</div>
					</article>
				`)
				.join('');
			resultsEl.innerHTML = `
				<h2>${escapeHtml(i18n.results?.title || '')}</h2>
				<p class="subtitle">${escapeHtml(i18n.results?.subtitle || '')}</p>
				<div class="advisor-results-grid">${cards}</div>
				<div class="advisor-nav"><button type="button" class="advisor-skip" id="advisor-restart">${escapeHtml(i18n.restart || 'Restart')}</button></div>
			`;
		}

		document.getElementById('advisor-restart')?.addEventListener('click', () => {
			answers.usage = null;
			answers.zones = [];
			answers.type = null;
			answers.budget = null;
			step = 1;
			try { history.replaceState(null, '', location.pathname); } catch { /* noop */ }
			renderStep();
		});
	}

	// Pré-remplissage depuis l'URL (résultat partagé/mis en favori) : saute direct aux résultats si complet.
	function hydrateFromUrl(): boolean {
		const params = new URLSearchParams(location.search);
		const usage = params.get('usage') as Usage | null;
		if (!usage || !USAGE_ORDER.includes(usage)) return false;
		answers.usage = usage;
		const zonesParam = params.get('zones');
		answers.zones = zonesParam ? (zonesParam.split(',') as Zone[]) : [];
		const typeParam = params.get('type') as AssistType | null;
		answers.type = typeParam || 'peu-importe';
		const budgetParam = params.get('budget') as Budget | null;
		answers.budget = budgetParam || 'peu-importe';
		showResults();
		return true;
	}

	if (!hydrateFromUrl()) renderStep();
});
