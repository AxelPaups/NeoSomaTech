import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintQuestion, findDuplicates, internalLinks, type QuestionRecord } from '../src/lib/questionLint.ts';

const w = (n: number) => Array.from({ length: n }, (_, i) => `mot${i % 7}`).join(' ');
const section = (title: string, n = 130) => `<h2>${title}</h2><p>${w(n)}</p>`;
const links = '<p><a href="/articles/x">x</a> et <a href="/produits/y">y</a></p><ul><li>a</li></ul>';
const sources = '<h2>Sources</h2><ul><li><a href="https://www.inrs.fr/">INRS</a></li></ul>';

const validFr = (): QuestionRecord => ({
	question: 'Peut-on utiliser un exosquelette pour faire du snowboard ?',
	slug: 'exosquelette-snowboard-compatible',
	reponse_courte: w(50),
	reponse: section('Réponse en détail') + section('Fonctionnement') + section('Pour qui') + section('Limites') + links + sources,
	mots_cles: Array.from({ length: 10 }, (_, i) => `variante ${i} exosquelette snowboard`).join('\n'),
	categorie: 'ski',
	article_lie: 11,
});
const validEn = (): QuestionRecord => ({
	...validFr(),
	question: 'Can you use an exoskeleton for snowboarding?',
	slug: 'exoskeleton-snowboarding-compatible',
	reponse: section('Detailed answer') + section('How it works') + section('Who it is for') + section('Limits') + links.replaceAll('href="/', 'href="/en/') + sources,
	article_lie: undefined,
});

const codes = (issues: { level: string; code: string }[], level = 'error') => issues.filter((i) => i.level === level).map((i) => i.code);

test('une question conforme ne produit aucune erreur (FR et EN)', () => {
	assert.deepEqual(codes(lintQuestion(validFr(), 'fr')), []);
	assert.deepEqual(codes(lintQuestion(validEn(), 'en')), []);
});

test('titre : point d\'interrogation, longueur', () => {
	assert.ok(codes(lintQuestion({ ...validFr(), question: 'Exosquelette et snowboard compatibles' }, 'fr')).includes('TITLE_NO_QUESTION_MARK'));
	assert.ok(codes(lintQuestion({ ...validFr(), question: 'Court ?' }, 'fr')).includes('TITLE_LENGTH'));
	assert.ok(codes(lintQuestion({ ...validFr(), question: `${'mot '.repeat(30)}?` }, 'fr')).includes('TITLE_LENGTH'));
});

test('slug : majuscules/accents, trop court, trop long', () => {
	for (const slug of ['Exosquelette-Snowboard-Test', 'exosquelette-snowboard-é', 'deux-mots', `${'a-'.repeat(11)}b`]) {
		assert.ok(codes(lintQuestion({ ...validFr(), slug }, 'fr')).includes('SLUG_FORMAT'), slug);
	}
});

test('réponse courte : 39 mots, 61 mots, balises HTML', () => {
	assert.ok(codes(lintQuestion({ ...validFr(), reponse_courte: w(39) }, 'fr')).includes('SHORT_LENGTH'));
	assert.ok(codes(lintQuestion({ ...validFr(), reponse_courte: w(61) }, 'fr')).includes('SHORT_LENGTH'));
	assert.deepEqual(codes(lintQuestion({ ...validFr(), reponse_courte: w(40) }, 'fr')).filter((c) => c === 'SHORT_LENGTH'), []);
	assert.deepEqual(codes(lintQuestion({ ...validFr(), reponse_courte: w(60) }, 'fr')).filter((c) => c === 'SHORT_LENGTH'), []);
	assert.ok(codes(lintQuestion({ ...validFr(), reponse_courte: `<p>${w(50)}</p>` }, 'fr')).includes('SHORT_HTML'));
});

test('corps : trop court, trop long, seuil différent en anglais', () => {
	const tooShort = section('A', 100) + section('B', 100) + section('C', 100) + links + sources;
	assert.ok(codes(lintQuestion({ ...validFr(), reponse: tooShort }, 'fr')).includes('BODY_LENGTH'));
	const tooLong = section('A', 300) + section('B', 300) + section('C', 300) + section('D', 300) + links + sources;
	assert.ok(codes(lintQuestion({ ...validFr(), reponse: tooLong }, 'fr')).includes('BODY_LENGTH'));
	const mid = section('A', 110) + section('B', 110) + section('C', 110) + section('D', 90) + links + sources; // ~430 mots
	assert.ok(codes(lintQuestion({ ...validFr(), reponse: mid }, 'fr')).includes('BODY_LENGTH'));
	assert.ok(!codes(lintQuestion({ ...validEn(), reponse: mid.replaceAll('href="/', 'href="/en/') }, 'en')).includes('BODY_LENGTH'));
});

test('structure : H1 interdit, 3 à 6 sections, chaque section >= 60 mots', () => {
	const base = validFr();
	assert.ok(codes(lintQuestion({ ...base, reponse: `<h1>Titre</h1>${base.reponse}` }, 'fr')).includes('BODY_H1'));
	const two = section('A', 250) + section('B', 250) + links + sources;
	assert.ok(codes(lintQuestion({ ...base, reponse: two }, 'fr')).includes('H2_COUNT'));
	const seven = Array.from({ length: 7 }, (_, i) => section(`S${i}`, 70)).join('') + links + sources;
	assert.ok(codes(lintQuestion({ ...base, reponse: seven }, 'fr')).includes('H2_COUNT'));
	const thin = section('A') + section('B') + section('C') + section('Mince', 20) + links + sources;
	assert.ok(codes(lintQuestion({ ...base, reponse: thin }, 'fr')).includes('SECTION_THIN'));
});

test('la section Sources n\'est pas comptée dans les H2', () => {
	const r = lintQuestion(validFr(), 'fr');
	assert.ok(!codes(r).includes('H2_COUNT'));
});

test('mots-clés : moins de 8, plus de 20', () => {
	assert.ok(codes(lintQuestion({ ...validFr(), mots_cles: 'a\nb' }, 'fr')).includes('KEYWORDS_COUNT'));
	assert.ok(codes(lintQuestion({ ...validFr(), mots_cles: Array.from({ length: 21 }, (_, i) => `expression ${i} longue ici`).join('\n') }, 'fr')).includes('KEYWORDS_COUNT'));
});

test('mots-clés : peu de formulations longues = avertissement', () => {
	const short = Array.from({ length: 10 }, (_, i) => `mot${i}`).join('\n');
	assert.ok(codes(lintQuestion({ ...validFr(), mots_cles: short }, 'fr'), 'warning').includes('KEYWORDS_LONG'));
});

test('article lié obligatoire en français seulement', () => {
	assert.ok(codes(lintQuestion({ ...validFr(), article_lie: null }, 'fr')).includes('ARTICLE_MISSING'));
	assert.ok(!codes(lintQuestion({ ...validEn(), article_lie: null }, 'en')).includes('ARTICLE_MISSING'));
});

test('liens internes : minimum 2, pas de /en/ en FR, seulement /en/ en EN', () => {
	const none = section('A') + section('B') + section('C') + sources;
	assert.ok(codes(lintQuestion({ ...validFr(), reponse: none }, 'fr')).includes('LINKS_INTERNAL_MIN'));
	assert.ok(codes(lintQuestion({ ...validFr(), reponse: validFr().reponse + '<a href="/en/articles/z">z</a>' }, 'fr')).includes('LINK_LOCALE'));
	assert.ok(codes(lintQuestion({ ...validEn(), reponse: validEn().reponse + '<a href="/articles/z">z</a>' }, 'en')).includes('LINK_LOCALE'));
});

test('internalLinks ignore les liens externes et les URLs //', () => {
	assert.deepEqual(internalLinks('<a href="/a">a</a><a href="https://x.fr">x</a><a href="//evil.example">e</a><a href="#top">t</a>'), ['/a']);
});

test('phrases interdites : test non réalisé, promesses', () => {
	for (const bad of ['Nous avons testé ce modèle.', 'Notre test montre que…', 'Une solution miracle.', 'Efficace à 100 % garanti.']) {
		assert.ok(codes(lintQuestion({ ...validFr(), reponse: validFr().reponse + `<p>${bad}</p>` }, 'fr')).includes('FORBIDDEN_PHRASE'), bad);
	}
	assert.ok(codes(lintQuestion({ ...validEn(), reponse: validEn().reponse + '<p>We tested it in the Alps.</p>' }, 'en')).includes('FORBIDDEN_PHRASE'));
});

test('santé : source externe et mention « pas un avis médical » obligatoires', () => {
	const noSource = { ...validFr(), categorie: 'sante-securite', reponse: validFr().reponse.replace(sources, '') };
	assert.ok(codes(lintQuestion(noSource, 'fr')).includes('SOURCES_REQUIRED'));
	const health = { ...validFr(), categorie: 'sante-securite', reponse: validFr().reponse + '<p>Cette douleur au genou demande un avis.</p>' };
	assert.ok(codes(lintQuestion(health, 'fr')).includes('DISCLAIMER_REQUIRED'));
	const withDisclaimer = { ...health, reponse: health.reponse + '<p>Ceci n\'est pas un avis médical.</p>' };
	assert.ok(!codes(lintQuestion(withDisclaimer, 'fr')).includes('DISCLAIMER_REQUIRED'));
});

test('doublons : titre très proche = avertissement, soi-même ignoré', () => {
	const rec = { question: 'À quel âge peut-on skier avec un exosquelette ?', slug: 'age-ski' };
	const others = [
		{ title: 'À quel âge peut-on skier avec un exosquelette ?', slug: 'exosquelette-ski-age-minimum-enfant-senior', kind: 'article' as const },
		{ title: 'Prix d\'un exosquelette', slug: 'prix', kind: 'article' as const },
		{ title: 'À quel âge peut-on skier avec un exosquelette ?', slug: 'age-ski', kind: 'question' as const },
	];
	const r = findDuplicates(rec, others, 'fr');
	assert.equal(r.length, 1);
	assert.equal(r[0].code, 'DUPLICATE_SUSPECT');
	assert.equal(r[0].level, 'warning');
});

test('sujet de santé : « dernier » ne déclenche pas de faux avertissement, « hernie » oui', () => {
	const clean = { ...validFr(), reponse: validFr().reponse + '<p>Au dernier moment, avant le départ.</p>' };
	assert.ok(!codes(lintQuestion(clean, 'fr'), 'warning').includes('DISCLAIMER_ADVISED'));
	const hernia = { ...validFr(), reponse: validFr().reponse + '<p>Une hernie discale demande un avis.</p>' };
	assert.ok(codes(lintQuestion(hernia, 'fr'), 'warning').includes('DISCLAIMER_ADVISED'));
});

test('mention médicale : « ne remplace pas » dans une phrase ordinaire ne suffit pas', () => {
	const rec = { ...validFr(), categorie: 'sante-securite', reponse: validFr().reponse + '<p>La prothèse ne remplace pas un genou sain et la douleur persiste.</p>' };
	assert.ok(codes(lintQuestion(rec, 'fr')).includes('DISCLAIMER_REQUIRED'));
});

test('mention médicale : les vraies formulations sont acceptées', () => {
	for (const t of ["Ceci n'est pas un avis médical.", 'Ce contenu ne constitue ni un avis juridique ni un avis médical.', 'Ce texte ne constitue pas un avis médical.']) {
		const rec = { ...validFr(), categorie: 'sante-securite', reponse: validFr().reponse + `<p>Une douleur au genou. ${t}</p>` };
		assert.ok(!codes(lintQuestion(rec, 'fr')).includes('DISCLAIMER_REQUIRED'), t);
	}
	const en = { ...validEn(), categorie: 'sante-securite', reponse: validEn().reponse + '<p>Some pain in the knee. This is not medical advice.</p>' };
	assert.ok(!codes(lintQuestion(en, 'en')).includes('DISCLAIMER_REQUIRED'));
});

test('un lien absolu vers son propre domaine est un lien interne, pas une source', () => {
	const noSource = validFr().reponse.replace(sources, '') + '<p><a href="https://neosomatech.com/articles/x">x</a></p>';
	const rec = { ...validFr(), categorie: 'sante-securite', reponse: noSource };
	assert.ok(codes(lintQuestion(rec, 'fr')).includes('SOURCES_REQUIRED'));
	const toEn = { ...validFr(), reponse: validFr().reponse + '<p><a href="https://www.neosomatech.com/en/articles/z">z</a></p>' };
	assert.ok(codes(lintQuestion(toEn, 'fr')).includes('LINK_LOCALE'));
});

test('internalLinks : guillemets simples et domaine du site', () => {
	assert.deepEqual(internalLinks("<a href='/a'>a</a><a href=\"https://neosomatech.com/b\">b</a><a href=\"https://exemple.org/c\">c</a>"), ['/a', '/b']);
});
