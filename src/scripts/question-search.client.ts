import { search, tokenize, type SearchDoc, type SearchLocale } from '../lib/questionSearch';

const root = document.getElementById('qsearch');
if (root) init(root);

function init(root: HTMLElement) {
	const strings = JSON.parse(root.dataset.strings ?? '{}') as Record<string, string>;
	const locale: SearchLocale = root.dataset.locale === 'en' ? 'en' : 'fr';
	const indexUrl = root.dataset.indexUrl ?? '';

	const form = root.querySelector<HTMLFormElement>('#qsearch-form')!;
	const input = root.querySelector<HTMLInputElement>('#qsearch-input')!;
	const status = root.querySelector<HTMLElement>('#qsearch-status')!;
	const list = root.querySelector<HTMLUListElement>('#qsearch-results')!;
	const suggestBox = root.querySelector<HTMLElement>('#qsuggest-box')!;
	const suggestForm = root.querySelector<HTMLFormElement>('#qsuggest-form')!;
	const suggestText = root.querySelector<HTMLTextAreaElement>('#qsuggest-text')!;
	const suggestEmail = root.querySelector<HTMLInputElement>('#qsuggest-email')!;
	const suggestTrap = root.querySelector<HTMLInputElement>('#qsuggest-website')!;
	const suggestMsg = root.querySelector<HTMLElement>('#qsuggest-msg')!;
	const catalog = document.getElementById('qcatalog');

	let docsPromise: Promise<SearchDoc[]> | null = null;
	let timer: number | undefined;
	let runId = 0;
	let suggestDirty = false;
	suggestText.addEventListener('input', () => {
		suggestDirty = true;
	});

	// Une seule requête d'index, même si plusieurs recherches partent avant sa réponse.
	const loadDocs = () => {
		docsPromise ??= fetch(indexUrl)
			.then((res) => {
				if (!res.ok) throw new Error(`index ${res.status}`);
				return res.json() as Promise<SearchDoc[]>;
			})
			.catch((err) => {
				docsPromise = null;
				throw err;
			});
		return docsPromise;
	};

	const reset = () => {
		list.replaceChildren();
		status.textContent = '';
		suggestBox.hidden = true;
		if (catalog) catalog.hidden = false;
	};

	const render = (found: ReturnType<typeof search>, query: string) => {
		list.replaceChildren();
		if (catalog) catalog.hidden = true;
		if (found.length === 0) {
			status.textContent = '';
			suggestBox.hidden = false;
			// La question proposée suit la recherche tant que le visiteur n'a pas écrit dans le champ lui-même.
			if (!suggestDirty) suggestText.value = query;
			return;
		}
		suggestBox.hidden = true;
		status.textContent = strings.resultsCount.replace('{n}', String(found.length));
		for (const { doc } of found) {
			const li = document.createElement('li');
			li.className = 'q-card';
			const badge = document.createElement('span');
			badge.className = doc.type === 'question' ? 'q-badge' : 'q-badge q-badge--article';
			badge.textContent = doc.type === 'question' ? strings.badgeAnswer : strings.badgeArticle;
			const h3 = document.createElement('h3');
			h3.className = 'q-card-title';
			const a = document.createElement('a');
			a.href = doc.url;
			a.textContent = doc.title;
			h3.append(a);
			li.append(badge, h3);
			if (doc.snippet) {
				const p = document.createElement('p');
				p.className = 'q-card-excerpt';
				p.textContent = doc.snippet;
				li.append(p);
			}
			const more = document.createElement('span');
			more.className = 'q-card-more';
			more.textContent = `${strings.readAnswer} →`;
			li.append(more);
			list.append(li);
		}
	};

	const run = async () => {
		const query = input.value.trim();
		const id = ++runId;
		// Requête trop courte ou composée uniquement de mots vides, de ponctuation ou d'émojis : pas d'appel réseau.
		if (query.length < 2 || tokenize(query, locale).length === 0) return reset();
		try {
			const docs = await loadDocs();
			if (id !== runId) return; // une recherche plus récente a été lancée entre-temps
			render(search(query, docs, locale), query);
		} catch {
			if (id === runId) status.textContent = strings.searchError;
		}
	};

	input.addEventListener('input', () => {
		window.clearTimeout(timer);
		timer = window.setTimeout(run, 150);
	});
	form.addEventListener('submit', (e) => {
		e.preventDefault();
		void run();
	});
	// Les exemples cliquables lancent la recherche correspondante.
	root.querySelectorAll<HTMLButtonElement>('[data-example]').forEach((chip) =>
		chip.addEventListener('click', () => {
			input.value = chip.dataset.example ?? '';
			input.focus();
			void run();
		}),
	);

	suggestForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		suggestMsg.textContent = '';
		try {
			const res = await fetch('/api/questions-suggestions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ texte: suggestText.value, email: suggestEmail.value, langue: locale, website: suggestTrap.value }),
			});
			if (!res.ok) throw new Error(String(res.status));
			suggestMsg.textContent = strings.suggestThanks;
			suggestForm.reset();
			suggestDirty = false;
		} catch {
			suggestMsg.textContent = strings.suggestError;
		}
	});
}
