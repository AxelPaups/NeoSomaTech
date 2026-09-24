#!/usr/bin/env node
// Usage :
//   node scripts/check-question.mjs <slug> [--links] [--base https://neosomatech.com]
//   node scripts/check-question.mjs --duplicates "Ma question ?"
// Pas de process.exit() : sous Windows il déclenche une assertion libuv quand des connexions réseau sont encore ouvertes.
import { directus } from './lib/directus.mjs';
import { lintQuestion, findDuplicates, internalLinks } from '../src/lib/questionLint.ts';
import { search } from '../src/lib/questionSearch.ts';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const valueOf = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

async function existingTitles() {
	const [questions, articles] = await Promise.all([
		directus('GET', '/items/Questions?fields=question,slug&limit=-1'),
		directus('GET', '/items/Articles?fields=titre,slug&limit=-1'),
	]);
	return [
		...questions.map((q) => ({ title: q.question, slug: q.slug, kind: 'question' })),
		...articles.map((a) => ({ title: a.titre, slug: a.slug, kind: 'article' })),
	];
}

async function main() {
	if (flag('--duplicates')) {
		const query = valueOf('--duplicates') ?? '';
		const others = await existingTitles();
		const docs = others.map((o) => ({ type: o.kind, slug: o.slug, title: o.title, url: o.slug }));
		const found = search(query, docs, 'fr', 8);
		console.log(found.length ? found.map((r) => `${r.score.toFixed(1)}  [${r.doc.type}] ${r.doc.title}  (${r.doc.slug})`).join('\n') : 'Aucun contenu proche : sujet libre.');
		return;
	}

	const slug = args.find((a) => !a.startsWith('--') && a !== valueOf('--base'));
	if (!slug) {
		console.error('Usage : node scripts/check-question.mjs <slug> [--links] [--base URL]');
		process.exitCode = 2;
		return;
	}

	const items = await directus('GET', `/items/Questions?filter[slug][_eq]=${encodeURIComponent(slug)}&fields=*,translations.*&limit=1`);
	const item = items[0];
	if (!item) {
		console.error(`Question introuvable : ${slug}`);
		process.exitCode = 2;
		return;
	}
	const en = item.translations?.find((t) => t.languages_code === 'en');

	let errors = 0;
	const report = (label, issues) => {
		console.log(`\n== ${label} ==`);
		if (issues.length === 0) return console.log('OK');
		for (const i of issues) {
			if (i.level === 'error') errors++;
			console.log(`${i.level === 'error' ? 'ERREUR ' : 'ATTENTION'} ${i.code}: ${i.message}`);
		}
	};

	report('Français', [...lintQuestion(item, 'fr'), ...findDuplicates(item, await existingTitles(), 'fr')]);
	if (en) report('English', lintQuestion({ ...en, categorie: item.categorie, article_lie: item.article_lie }, 'en'));
	else report('English', [{ level: 'error', code: 'EN_MISSING', message: 'Traduction anglaise absente' }]);

	if (flag('--links')) {
		const base = valueOf('--base') ?? 'https://neosomatech.com';
		const hrefs = new Set([...internalLinks(item.reponse ?? ''), ...(en ? internalLinks(en.reponse ?? '') : [])]);
		const broken = [];
		for (const href of hrefs) {
			const res = await fetch(base + href, { method: 'HEAD', redirect: 'follow' }).catch(() => null);
			if (!res || !res.ok) broken.push(`${href} -> ${res ? res.status : 'injoignable'}`);
		}
		report(`Liens internes (${hrefs.size}) sur ${base}`, broken.map((b) => ({ level: 'error', code: 'LINK_BROKEN', message: b })));
	}

	console.log(errors ? `\n${errors} erreur(s) : à corriger avant publication.` : '\nAucune erreur.');
	process.exitCode = errors ? 1 : 0;
}

await main();
