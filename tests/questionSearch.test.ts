import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, tokenize, editDistance, search, type SearchDoc } from '../src/lib/questionSearch.ts';

const doc = (o: Partial<SearchDoc> & { slug: string; title: string }): SearchDoc => ({ type: 'question', url: `/questions/${o.slug}`, ...o });

const ageQ = doc({ slug: 'ski-age', title: 'À quel âge peut-on skier avec un exosquelette ?', keywords: 'age minimum ski exosquelette\nenfant adolescent senior', snippet: "Il n'existe pas d'âge minimum officiel : le poids et la morphologie comptent." });
const arthroseQ = doc({ slug: 'genou-arthrose', title: 'Exosquelette et arthrose du genou : que peut-on en attendre ?', keywords: 'arthrose genou douleur cartilage', snippet: 'Un exosquelette peut soulager la douleur mais ne guérit pas.' });
const guideA = doc({ type: 'article', slug: 'guide-ski', title: 'Exosquelette Ski Genou : Guide Complet pour Skier Sans Douleur en 2026', snippet: 'Découvrez comment skier sans douleur.' });
const priceA = doc({ type: 'article', slug: 'prix', title: "Prix d'un exosquelette : combien ça coûte vraiment en 2026 ?", snippet: 'Prix par famille de produit.' });
const docs = [ageQ, arthroseQ, guideA, priceA];

test('normalize : minuscules, accents et ponctuation ignorés', () => {
	assert.equal(normalize("À quel ÂGE ?  L'œuvre !"), 'a quel age l oeuvre');
});

test('tokenize : retire les mots vides FR et les pluriels', () => {
	assert.deepEqual(tokenize('à quel âge peut-on skier avec un exosquelette', 'fr'), ['age', 'skier', 'exosquelette']);
	assert.deepEqual(tokenize('les genoux', 'fr'), ['genou']);
});

test('tokenize : mots vides et pluriels EN', () => {
	assert.deepEqual(tokenize('how do exoskeletons work', 'en'), ['exoskeleton', 'work']);
});

test('editDistance : suppression, transposition et borne', () => {
	assert.equal(editDistance('exosquelette', 'exosqelette', 2), 1);
	assert.equal(editDistance('exosqeulette', 'exosquelette', 2), 1);
	assert.equal(editDistance('abcdef', 'uvwxyz', 2), 3);
	assert.equal(editDistance('a', 'abcdef', 2), 3);
	assert.equal(editDistance('ski', 'ski', 1), 0);
});

test('une faute de frappe trouve la bonne page, et les pages hors sujet sont écartées', () => {
	const r = search('exosqelette ski age', docs, 'fr');
	assert.equal(r[0].doc.slug, 'ski-age');
	assert.ok(!r.some((x) => x.doc.slug === 'genou-arthrose'));
	assert.ok(!r.some((x) => x.doc.slug === 'prix'));
});

test('majuscules et accents sont sans effet', () => {
	assert.equal(search('ÂGE SKI', docs, 'fr')[0].doc.slug, 'ski-age');
});

test("l'ordre des mots n'a pas d'importance", () => {
	assert.equal(search('skier exosquelette age', docs, 'fr')[0].doc.slug, 'ski-age');
});

test('pluriel et singulier : genoux trouve genou', () => {
	const r = search('genoux', [doc({ slug: 'a', title: 'zzz', keywords: 'genou' })], 'fr');
	assert.equal(r.length, 1);
});

test('frappe partielle : un préfixe de 3 lettres ou plus trouve le mot complet', () => {
	assert.equal(search('exosque', [doc({ slug: 'a', title: 'Exosquelette de ski' })], 'fr').length, 1);
});

test('requête vide, mots vides seuls, ponctuation, émojis : aucun résultat sans erreur', () => {
	for (const q of ['', '   ', 'comment est ce que', '?!?', '🎿🎿', '\n\t']) assert.deepEqual(search(q, docs, 'fr'), []);
});

test('requête de 5 000 caractères : pas de plantage', () => {
	const long = 'exosquelette '.repeat(400);
	assert.doesNotThrow(() => search(long, docs, 'fr'));
});

test('un mot sans rapport ne renvoie rien', () => {
	assert.deepEqual(search('pizza', docs, 'fr'), []);
});

test('les mots-clés pèsent plus que la réponse courte', () => {
	const inKeywords = doc({ slug: 'kw', title: 'zzz', keywords: 'arthrose' });
	const inSnippet = doc({ slug: 'sn', title: 'yyy', snippet: 'arthrose' });
	assert.equal(search('arthrose', [inSnippet, inKeywords], 'fr')[0].doc.slug, 'kw');
});

test('au moins 60 % des mots de la recherche doivent correspondre', () => {
	const onlySki = doc({ slug: 'a', title: 'ski' });
	const skiPrix = doc({ slug: 'b', title: 'ski prix' });
	const r = search('ski arthrose prix', [onlySki, skiPrix], 'fr');
	assert.deepEqual(r.map((x) => x.doc.slug), ['b']);
});

test('à score égal, une réponse passe avant un article', () => {
	const q = doc({ slug: 'q', title: 'aaa', snippet: 'arthrose' });
	const a = doc({ type: 'article', slug: 'a', title: 'bbb', snippet: 'arthrose' });
	assert.deepEqual(search('arthrose', [a, q], 'fr').map((x) => x.doc.slug), ['q', 'a']);
});

test('le paramètre limit est respecté', () => {
	const many = Array.from({ length: 10 }, (_, i) => doc({ slug: `s${i}`, title: `Exosquelette ${i}` }));
	assert.equal(search('exosquelette', many, 'fr', 3).length, 3);
});

test('anglais', () => {
	const q = doc({ slug: 'cost', title: 'How much does an exoskeleton cost?', keywords: 'exoskeleton price' });
	assert.equal(search('how much does an exoskeleton cost', [q], 'en')[0].doc.slug, 'cost');
});

test('documents sans champs facultatifs, liste vide', () => {
	assert.deepEqual(search('ski', [], 'fr'), []);
	assert.equal(search('ski', [doc({ slug: 'a', title: 'Ski' })], 'fr').length, 1);
});

test('un mot présent dans plusieurs champs (mots-clés et titre) classe mieux qu\'un mot présent dans un seul', () => {
	const multi = doc({ slug: 'm', title: 'arthrose du genou', keywords: 'arthrose genou' });
	const single = doc({ slug: 's', title: 'aaa', keywords: 'arthrose genou' });
	assert.equal(search('arthrose genoux', [single, multi], 'fr')[0].doc.slug, 'm');
});

test('titre, mots-clés ou extrait absents (null) : pas de plantage', () => {
	const broken = { type: 'question', slug: 'x', url: '/x', title: null, keywords: null, snippet: null } as unknown as SearchDoc;
	assert.doesNotThrow(() => search('ski', [broken, doc({ slug: 'a', title: 'Ski' })], 'fr'));
	assert.deepEqual(tokenize(null as unknown as string, 'fr'), []);
});

test('frappe partielle : « exo » et « exosq » trouvent exosquelette', () => {
	const d = doc({ slug: 'a', title: 'Exosquelette de ski' });
	assert.equal(search('exo', [d], 'fr').length, 1);
	assert.equal(search('exosq', [d], 'fr').length, 1);
});
