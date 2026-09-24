#!/usr/bin/env node
// Usage : node scripts/publish-question.mjs <fichier.json> [--statut brouillon|publie]
// Le fichier contient { "fr": {...}, "en": {...} } (voir le skill redaction-question-reponse).
// Sans --statut : une nouvelle question est créée en brouillon, une question existante garde son statut.
// Une question publiée (ou qui le devient) est refusée tant que le contrôleur qualité signale des erreurs.
import { readFileSync } from 'node:fs';
import { directus } from './lib/directus.mjs';
import { lintQuestion } from '../src/lib/questionLint.ts';
import { planWrite } from '../src/lib/questionPublish.ts';

const args = process.argv.slice(2);
const statutIdx = args.indexOf('--statut');
const requested = statutIdx >= 0 ? args[statutIdx + 1] : undefined;
const file = args.find((a) => !a.startsWith('--') && a !== requested);
if (!file || (requested !== undefined && !['brouillon', 'publie'].includes(requested))) {
	console.error('Usage : node scripts/publish-question.mjs <fichier.json> [--statut brouillon|publie]');
	process.exitCode = 2;
} else {
	await main();
}

async function main() {
	const { fr, en } = JSON.parse(readFileSync(file, 'utf8'));
	if (!fr?.slug || !en?.slug) throw new Error('Le fichier doit contenir fr.slug et en.slug');

	const today = new Date().toISOString().slice(0, 10);
	const existing = (await directus('GET', `/items/Questions?filter[slug][_eq]=${encodeURIComponent(fr.slug)}&fields=id,statut,date_publication&limit=1`))[0] ?? null;
	const plan = planWrite(existing, requested, today);

	if (plan.statut === 'publie') {
		const issues = [
			...lintQuestion(fr, 'fr').map((i) => ({ ...i, lang: 'fr' })),
			...lintQuestion({ ...en, categorie: fr.categorie, article_lie: fr.article_lie }, 'en').map((i) => ({ ...i, lang: 'en' })),
		].filter((i) => i.level === 'error');
		if (issues.length) {
			for (const i of issues) console.error(`ERREUR [${i.lang}] ${i.code}: ${i.message}`);
			console.error('Publication refusée : corriger les erreurs (ou passer en brouillon avec --statut brouillon).');
			process.exitCode = 1;
			return;
		}
	}

	const row = {
		question: fr.question, slug: fr.slug, categorie: fr.categorie, article_lie: fr.article_lie ?? null, produit_lie: fr.produit_lie ?? null,
		reponse_courte: fr.reponse_courte, reponse: fr.reponse, mots_cles: fr.mots_cles,
		auteur: 'Axel Paupier', ...plan,
	};
	const saved = existing ? await directus('PATCH', `/items/Questions/${existing.id}`, row) : await directus('POST', '/items/Questions', row);

	const tr = { question: en.question, slug: en.slug, reponse_courte: en.reponse_courte, reponse: en.reponse, mots_cles: en.mots_cles };
	const enRow = (await directus('GET', `/items/Questions_translations?filter[Questions_id][_eq]=${saved.id}&filter[languages_code][_eq]=en&fields=id&limit=1`))[0];
	if (enRow) await directus('PATCH', `/items/Questions_translations/${enRow.id}`, tr);
	else await directus('POST', '/items/Questions_translations', { Questions_id: saved.id, languages_code: 'en', ...tr });

	console.log(`${existing ? 'Mise à jour' : 'Création'} : question ${saved.id} (${plan.statut}) — FR ${fr.slug} / EN ${en.slug}`);
}
