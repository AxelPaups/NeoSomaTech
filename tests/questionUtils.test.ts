import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripHtml, wordCount, truncate, groupByCategory, relatedQuestions, addHeadingIds } from '../src/lib/questionUtils.ts';

test('stripHtml retire les balises et les espaces insécables', () => {
	assert.equal(stripHtml('<h2>Titre</h2><p>Un&nbsp;texte <strong>fort</strong></p>'), 'Titre Un texte fort');
});

test('wordCount compte les mots, pas les espaces', () => {
	assert.equal(wordCount('  un  deux\ntrois '), 3);
	assert.equal(wordCount(''), 0);
});

test('truncate coupe au dernier mot entier et ajoute …', () => {
	assert.equal(truncate('court', 20), 'court');
	assert.equal(truncate('un deux trois quatre', 12), 'un deux…');
});

test('groupByCategory : ordre des catégories connues, inconnues dans « autre »', () => {
	const g = groupByCategory([
		{ id: 1, categorie: 'technique' },
		{ id: 2, categorie: 'ski' },
		{ id: 3, categorie: 'inconnue' },
		{ id: 4, categorie: null },
		{ id: 5, categorie: 'ski' },
	]);
	assert.deepEqual(g.map((x) => x.categorie), ['ski', 'technique', 'autre']);
	assert.deepEqual(g[0].items.map((x) => x.id), [2, 5]);
	assert.deepEqual(g[2].items.map((x) => x.id), [3, 4]);
});

test('groupByCategory : liste vide', () => {
	assert.deepEqual(groupByCategory([]), []);
});

test('relatedQuestions : même catégorie d\'abord, récentes d\'abord, complète avec les autres', () => {
	const all = [
		{ slug: 'a', categorie: 'ski', date_publication: '2026-01-01' },
		{ slug: 'b', categorie: 'ski', date_publication: '2026-03-01' },
		{ slug: 'c', categorie: 'genou', date_publication: '2026-05-01' },
		{ slug: 'cur', categorie: 'ski', date_publication: '2026-06-01' },
	];
	assert.deepEqual(relatedQuestions(all, { slug: 'cur', categorie: 'ski' }, 3).map((x) => x.slug), ['b', 'a', 'c']);
	assert.deepEqual(relatedQuestions(all, { slug: 'cur', categorie: 'ski' }, 1).map((x) => x.slug), ['b']);
	assert.deepEqual(relatedQuestions([], { slug: 'x' }), []);
});

test('addHeadingIds : ancres section-N sur les H2 et sommaire décodé', () => {
	const r = addHeadingIds('<h2>Un</h2><p>a</p><h2 class="x">Deux &amp; trois</h2><h3>Sous-titre</h3>');
	assert.equal(r.html, '<h2 id="section-1">Un</h2><p>a</p><h2 class="x" id="section-2">Deux &amp; trois</h2><h3>Sous-titre</h3>');
	assert.deepEqual(r.toc, [
		{ id: 'section-1', title: 'Un' },
		{ id: 'section-2', title: 'Deux & trois' },
	]);
});

test('addHeadingIds : sans titre H2, rien à faire', () => {
	assert.deepEqual(addHeadingIds('<p>texte</p>'), { html: '<p>texte</p>', toc: [] });
	assert.deepEqual(addHeadingIds(''), { html: '', toc: [] });
});
