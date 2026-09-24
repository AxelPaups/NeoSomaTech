# Centre de réponses : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter à neosomatech.com un centre de questions/réponses : une page indexable par question, une recherche tolérante aux fautes, un formulaire de suggestion, et un skill de rédaction qui impose un plan strict (avec un contrôleur automatique de qualité).

**Architecture:** Trois collections Directus (`Questions`, `Questions_translations`, `Questions_suggestions`). Des modules TypeScript purs et testés (`questionSearch`, `questionUtils`, `suggestionValidation`, `questionLint`) portent toute la logique ; les pages Astro et les endpoints ne font que les brancher. La recherche s'exécute dans le navigateur sur un index JSON par langue. Le skill s'appuie sur deux scripts Node (`check-question`, `publish-question`) qui réutilisent les mêmes modules.

**Tech Stack:** Astro 6 (SSR, Cloudflare), Directus 10+ (API REST), TypeScript, tests avec `node --test` (aucune dépendance nouvelle).

**Spec:** `docs/superpowers/specs/2026-09-24-centre-de-reponses-design.md`

## Global Constraints

- **Aucun commit** sans demande explicite de l'utilisateur (règle utilisateur, prime sur le rythme habituel des plans). Chaque tâche se termine par un point de contrôle, pas par un commit.
- Aucune nouvelle dépendance npm. Le seul ajout à `package.json` est le script `test`.
- Le jeton Directus vient de la variable `PUBLIC_JETON_STATIQUE_DIRECT` (`.env`), jamais codé en dur.
- Ce jeton est un compte **Admin** : Directus ne protège pas les brouillons. Toute lecture publique filtre `statut = publie`.
- Le français est la langue de base ; l'anglais lit uniquement ses traductions ; aucune page dans une langue sans traduction ; aucune page mince ni dupliquée.
- Imports relatifs entre modules `src/lib/question*.ts` avec l'extension `.ts` (nécessaire pour `node --test` ; autorisé par `astro/tsconfigs/strict`).
- Limites de contenu (source unique : `LIMITS` dans `questionLint.ts`) : titre 25 à 90 caractères se terminant par « ? » ; slug 3 à 10 mots, 80 caractères maximum ; réponse courte 40 à 60 mots ; réponse détaillée 450 à 1 000 mots en FR (400 à 1 000 en EN) ; 3 à 6 sections H2 hors « Sources », chacune d'au moins 60 mots ; `mots_cles` de 8 à 20 lignes ; au moins 2 liens internes.
- Texte visible en français par défaut, avec équivalent anglais dans `en.ts` (le compilateur vérifie que les clés sont identiques).
- Ne pas déployer en production (`npm run deploy`) sans accord explicite de l'utilisateur.

## Review Focus

- **Recherche vide ou hostile** : requête composée uniquement de mots vides, de ponctuation, d'émojis, ou de 5 000 caractères : aucun résultat, aucune erreur, aucun appel réseau superflu. (Task 2)
- **Brouillon ou non traduit demandé par URL directe** : `/questions/<slug-brouillon>` ou `/en/questions/<slug-fr>` renvoie un vrai 404 noindex et n'apparaît ni dans l'index de recherche ni dans le sitemap. (Tasks 4, 6, 8)
- **Saisie hostile dans le formulaire de suggestion** : 10 000 caractères, balises HTML, URLs, email invalide, champ leurre rempli : refus ou silence, jamais d'écriture invalide dans Directus. (Task 3)
- **Collection vide au premier déploiement** : hub avec message « bientôt », `index.json` = `[]`, sitemap sans entrée de question, aucune erreur 500. (Tasks 6, 7, 8)
- **Titres venant du CMS affichés dans les résultats** : un titre contenant `<img onerror=...>` doit s'afficher comme texte (rendu par `textContent`, jamais `innerHTML`). (Task 7)

---

## File Structure

| Fichier | Responsabilité |
|---|---|
| `scripts/lib/directus.mjs` | Petit client REST Directus pour les scripts Node (jeton lu dans `.env`) |
| `scripts/directus-questions-schema.mjs` | Crée les 3 collections, champs et relations (idempotent) |
| `src/lib/questionSearch.ts` | Recherche tolérante (normalisation, mots vides, distance d'édition, classement) |
| `src/lib/questionUtils.ts` | Catégories, groupement, questions liées, `stripHtml`, `wordCount`, `truncate` |
| `src/lib/suggestionValidation.ts` | Validation pure du formulaire de suggestion |
| `src/lib/questionLint.ts` | Contrôleur qualité d'une page question/réponse + détection de doublons |
| `src/lib/content.ts` (modifié) | `listQuestions`, `getQuestion`, `localizeQuestion` |
| `src/lib/questionIndex.ts` | Construit l'index de recherche d'une langue |
| `src/lib/questionPage.ts` | Charge une page de réponse (question, liées, article, produit, alternates) |
| `src/i18n/*` (modifiés) | Segment de route `questions`, textes FR/EN, entrées de menu |
| `src/views/QuestionView.astro` | Page de réponse |
| `src/views/QuestionsHubView.astro` | Hub : recherche + catalogue par catégorie |
| `src/pages/questions/*`, `src/pages/en/questions/*` | Routes FR/EN : hub, `[slug]`, `index.json` |
| `src/scripts/question-search.client.ts` | Recherche et formulaire de suggestion dans le navigateur |
| `src/pages/api/questions-suggestions.ts` | Enregistre une suggestion dans Directus |
| `src/pages/sitemap.xml.ts` (modifié) | Hub et questions publiées |
| `scripts/check-question.mjs`, `scripts/publish-question.mjs` | CLI de contrôle et de publication pour le skill |
| `.claude/skills/redaction-question-reponse/` | Skill de rédaction (SKILL.md + gabarits) |
| `tests/*.test.ts` | Tests unitaires des modules purs |

---

### Task 1: Structure Directus

**Files:**
- Create: `scripts/lib/directus.mjs`
- Create: `scripts/directus-questions-schema.mjs`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces: collections `Questions` (`id, statut, categorie, question, slug, reponse_courte, reponse, mots_cles, auteur, date_publication, date_updated, article_lie, produit_lie, translations`), `Questions_translations` (`id, Questions_id, languages_code, question, slug, reponse_courte, reponse, mots_cles`), `Questions_suggestions` (`id, texte, email, langue, statut, date_created`). `scripts/lib/directus.mjs` exporte `directus(method, path, body?)` qui renvoie `data` ou lève une erreur.

- [ ] **Step 1: Écrire le client Directus pour scripts**

```js file=scripts/lib/directus.mjs
import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../../.env', import.meta.url), 'utf8');
const read = (key) => env.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1].trim().replace(/^["']|["']$/g, '');

export const token = read('PUBLIC_JETON_STATIQUE_DIRECT');
export const baseUrl = read('PUBLIC_URL_DIRECT') || 'https://spirited-squid.pikapod.net';

if (!token) throw new Error('PUBLIC_JETON_STATIQUE_DIRECT introuvable dans .env');

/** Appel REST Directus. Renvoie `data`, ou `null` sur 404 quand `allow404` est vrai. */
export async function directus(method, path, body, { allow404 = false } = {}) {
	const res = await fetch(`${baseUrl}${path}`, {
		method,
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	if (res.status === 204) return null;
	if (res.status === 404 && allow404) return null;
	const json = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json.errors ?? json)}`);
	return json.data;
}
```

- [ ] **Step 2: Écrire le script de schéma (idempotent)**

```js file=scripts/directus-questions-schema.mjs
// Crée les collections du centre de réponses. Idempotent : ne recrée pas ce qui existe.
// Usage : node scripts/directus-questions-schema.mjs [--verify]
import { directus } from './lib/directus.mjs';

const CATEGORIES = [
	['ski', 'Ski'], ['genou', 'Genou'], ['randonnee', 'Randonnée'], ['dos-travail', 'Dos et travail'],
	['achat-prix', 'Achat et prix'], ['sante-securite', 'Santé et sécurité'], ['technique', 'Technique'],
];
const choices = (list) => list.map(([value, text]) => ({ value, text }));

const pk = { field: 'id', type: 'integer', meta: { hidden: true, readonly: true, interface: 'input' }, schema: { is_primary_key: true, has_auto_increment: true } };
const text = (field, iface = 'input-multiline', extra = {}) => ({ field, type: 'text', meta: { interface: iface, ...extra } });
const str = (field, meta = {}, schema = {}) => ({ field, type: 'string', meta: { interface: 'input', ...meta }, schema });

// Directus répond 403 (pas 404) pour une collection absente : on liste les collections plutôt que de sonder chacune.
const exists = async (collection) => (await directus('GET', '/collections')).some((c) => c.collection === collection);

async function ensureCollection(collection, meta, fields) {
	if (await exists(collection)) return console.log(`= ${collection} existe déjà`);
	await directus('POST', '/collections', { collection, meta, schema: {}, fields });
	console.log(`+ ${collection} créée`);
}

async function main() {
	await ensureCollection('Questions', { icon: 'help', note: 'Centre de réponses : une page par question', sort: 2 }, [
		pk,
		str('statut', { required: true, width: 'half', display: 'labels', interface: 'select-dropdown', options: { choices: choices([['brouillon', 'Brouillon'], ['publie', 'Publié']]) } }, { default_value: 'brouillon', is_nullable: false }),
		str('categorie', { width: 'half', interface: 'select-dropdown', options: { choices: choices(CATEGORIES) } }),
		str('question', { required: true }),
		str('slug', { required: true, note: 'minuscules, sans accents, tirets' }, { is_unique: true }),
		text('reponse_courte', 'input-multiline', { note: '40 à 60 mots, texte brut' }),
		text('reponse', 'input-rich-text-html'),
		text('mots_cles', 'input-multiline', { note: 'Une expression par ligne : synonymes, reformulations, fautes courantes' }),
		str('auteur', { width: 'half' }, { default_value: 'Axel Paupier' }),
		{ field: 'date_publication', type: 'date', meta: { interface: 'datetime', width: 'half' } },
		{ field: 'date_updated', type: 'date', meta: { interface: 'datetime', width: 'half' } },
		{ field: 'article_lie', type: 'integer', meta: { interface: 'select-dropdown-m2o', special: ['m2o'], options: { template: '{{titre}}' }, width: 'half' } },
		{ field: 'produit_lie', type: 'integer', meta: { interface: 'select-dropdown-m2o', special: ['m2o'], options: { template: '{{Nom_du_produit}}' }, width: 'half' } },
	]);

	await ensureCollection('Questions_translations', { icon: 'import_export', hidden: true, note: 'Traductions des questions (une ligne par langue)' }, [
		pk,
		{ field: 'Questions_id', type: 'integer', meta: { hidden: true, interface: 'input' } },
		{ field: 'languages_code', type: 'string', meta: { hidden: true, interface: 'input' } },
		str('question'), str('slug'),
		text('reponse_courte'), text('reponse', 'input-rich-text-html'), text('mots_cles'),
	]);

	await ensureCollection('Questions_suggestions', { icon: 'chat', note: 'Questions proposées par les visiteurs' }, [
		pk,
		text('texte'),
		str('email'),
		str('langue', { width: 'half' }),
		str('statut', { width: 'half', interface: 'select-dropdown', display: 'labels', options: { choices: choices([['nouvelle', 'Nouvelle'], ['traitee', 'Traitée'], ['rejetee', 'Rejetée']]) } }, { default_value: 'nouvelle' }),
		{ field: 'date_created', type: 'timestamp', meta: { special: ['date-created'], interface: 'datetime', readonly: true, width: 'half' } },
	]);

	// Relations (créées seulement si absentes)
	const rels = await directus('GET', '/relations');
	const hasRel = (collection, field) => rels.some((r) => r.collection === collection && r.field === field);

	if (!hasRel('Questions', 'article_lie'))
		await directus('POST', '/relations', { collection: 'Questions', field: 'article_lie', related_collection: 'Articles', schema: { on_delete: 'SET NULL' }, meta: { one_field: null } });
	if (!hasRel('Questions', 'produit_lie'))
		await directus('POST', '/relations', { collection: 'Questions', field: 'produit_lie', related_collection: 'Produits', schema: { on_delete: 'SET NULL' }, meta: { one_field: null } });

	const fields = await directus('GET', '/fields/Questions');
	if (!fields.some((f) => f.field === 'translations'))
		await directus('POST', '/fields/Questions', { field: 'translations', type: 'alias', meta: { special: ['translations'], interface: 'translations', options: { languageField: 'name', defaultLanguage: 'fr', userLanguage: false }, note: 'Traductions (anglais)', width: 'full' } });

	if (!hasRel('Questions_translations', 'languages_code'))
		await directus('POST', '/relations', { collection: 'Questions_translations', field: 'languages_code', related_collection: 'languages', schema: { on_delete: 'SET NULL' }, meta: { one_field: null, sort_field: null, one_deselect_action: 'nullify', junction_field: 'Questions_id' } });
	if (!hasRel('Questions_translations', 'Questions_id'))
		await directus('POST', '/relations', { collection: 'Questions_translations', field: 'Questions_id', related_collection: 'Questions', schema: { on_delete: 'CASCADE' }, meta: { one_field: 'translations', sort_field: null, one_deselect_action: 'delete', junction_field: 'languages_code' } });

	console.log('Schéma OK');
}

async function verify() {
	// Aller-retour : crée une question + traduction EN, la relit par l'alias `translations`, puis supprime.
	const q = await directus('POST', '/items/Questions', { question: 'Test schéma ?', slug: 'test-schema-a-supprimer', statut: 'brouillon' });
	try {
		await directus('POST', '/items/Questions_translations', { Questions_id: q.id, languages_code: 'en', question: 'Schema test?', slug: 'schema-test-delete-me' });
		const back = await directus('GET', `/items/Questions/${q.id}?fields=id,statut,translations.*`);
		if (back.statut !== 'brouillon') throw new Error('statut par défaut incorrect');
		if (!back.translations?.some((t) => t.languages_code === 'en' && t.slug === 'schema-test-delete-me')) throw new Error('traduction EN introuvable via translations');
		console.log('Aller-retour OK (statut par défaut, traduction EN relue)');
	} finally {
		await directus('DELETE', `/items/Questions/${q.id}`);
		console.log('Question de test supprimée');
	}
}

await main();
if (process.argv.includes('--verify')) await verify();
```

- [ ] **Step 3: Ajouter le script `test` à `package.json`**

Dans `"scripts"`, ajouter après `"deploy"` (sans oublier la virgule de la ligne précédente) :

```json
    "deploy": "npm run build && wrangler deploy",
    "test": "node --test \"tests/*.test.ts\""
```

- [ ] **Step 4: Exécuter le script avec vérification**

Run: `node scripts/directus-questions-schema.mjs --verify`
Expected: lignes `+ Questions créée`, `+ Questions_translations créée`, `+ Questions_suggestions créée`, `Schéma OK`, `Aller-retour OK (statut par défaut, traduction EN relue)`, `Question de test supprimée`.
Si l'aller-retour échoue sur la traduction : ouvrir Directus > Réglages > Modèle de données > `Questions` et vérifier que le champ `translations` (interface « Traductions ») pointe vers `Questions_translations` (comparer avec `Articles`), corriger à la main, relancer `--verify`.

- [ ] **Step 5: Vérifier l'idempotence**

Run: `node scripts/directus-questions-schema.mjs`
Expected: trois lignes `= ... existe déjà` puis `Schéma OK`, sans erreur.

- [ ] **Point de contrôle** : les 3 collections existent dans Directus, aucune donnée de test ne reste (`GET /items/Questions` renvoie `[]`).

---

### Task 2: Module de recherche tolérante (TDD)

**Files:**
- Create: `src/lib/questionSearch.ts`
- Test: `tests/questionSearch.test.ts`

**Interfaces:**
- Produces: `SearchLocale = 'fr' | 'en'` ; `SearchDoc { type: 'question' | 'article'; slug: string; title: string; url: string; keywords?: string; snippet?: string; category?: string }` ; `SearchResult { doc: SearchDoc; score: number }` ; `normalize(text: string): string` ; `tokenize(text: string, locale: SearchLocale): string[]` ; `editDistance(a: string, b: string, max: number): number` (renvoie `max + 1` au-delà) ; `search(query: string, docs: SearchDoc[], locale: SearchLocale, limit?: number): SearchResult[]`.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts file=tests/questionSearch.test.ts
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
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npm test`
Expected: FAIL (`Cannot find module '../src/lib/questionSearch.ts'`).

- [ ] **Step 3: Écrire l'implémentation**

```ts file=src/lib/questionSearch.ts
// Recherche tolérante aux fautes, sans dépendance. Pure : tourne dans le navigateur et sous Node.
export type SearchLocale = 'fr' | 'en';

export interface SearchDoc {
	type: 'question' | 'article';
	slug: string;
	title: string;
	url: string;
	keywords?: string;
	snippet?: string;
	category?: string;
}

export interface SearchResult {
	doc: SearchDoc;
	score: number;
}

const STOPWORDS: Record<SearchLocale, Set<string>> = {
	fr: new Set(
		('le la les l un une des du de d et ou a au aux en dans sur pour par avec sans est sont ce cet cette ces c que qu qui quoi ' +
			'quel quelle quels quelles comment quand il elle on je tu nous vous ils elles se s sa son ses mon ma mes ne n pas y peut peuvent faut t m').split(' '),
	),
	en: new Set('the a an of for to in on and or is are be can do does did how what which when why with without at by from it its i my your you we they this that'.split(' ')),
};

const WEIGHTS = { keywords: 3, question: 2, article: 1.5, snippet: 1 };

export function normalize(text: string): string {
	return text
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/œ/g, 'oe')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

const stem = (w: string) => (w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w);

export function tokenize(text: string, locale: SearchLocale): string[] {
	const stop = STOPWORDS[locale];
	return normalize(text)
		.split(' ')
		.filter((w) => w && !stop.has(w))
		.map(stem);
}

/** Distance de Damerau-Levenshtein (transposition d'un cran), bornée : renvoie max + 1 dès que c'est dépassé. */
export function editDistance(a: string, b: string, max: number): number {
	if (Math.abs(a.length - b.length) > max) return max + 1;
	let prev2: number[] = [];
	let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const cur: number[] = [i];
		let rowMin = i;
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
			cur[j] = v;
			if (v < rowMin) rowMin = v;
		}
		if (rowMin > max) return max + 1;
		prev2 = prev;
		prev = cur;
	}
	return Math.min(prev[b.length], max + 1);
}

const tolerance = (len: number) => (len >= 8 ? 2 : len >= 4 ? 1 : 0);

/** 1 = identique, 0,8 = préfixe, 0,6 = faute de frappe, 0 = aucun rapport. */
function matchScore(q: string, d: string): number {
	if (q === d) return 1;
	const short = Math.min(q.length, d.length);
	const long = Math.max(q.length, d.length);
	if (short >= 3 && short / long >= 0.5 && (d.startsWith(q) || q.startsWith(d))) return 0.8;
	const tol = tolerance(q.length);
	if (tol > 0 && editDistance(q, d, tol) <= tol) return 0.6;
	return 0;
}

interface Fields {
	keywords: string[];
	title: string[];
	snippet: string[];
}
const cache = new WeakMap<SearchDoc, { locale: SearchLocale; fields: Fields }>();

function fieldsOf(doc: SearchDoc, locale: SearchLocale): Fields {
	const hit = cache.get(doc);
	if (hit && hit.locale === locale) return hit.fields;
	const fields = {
		keywords: tokenize(doc.keywords ?? '', locale),
		title: tokenize(doc.title, locale),
		snippet: tokenize(doc.snippet ?? '', locale),
	};
	cache.set(doc, { locale, fields });
	return fields;
}

export function search(query: string, docs: SearchDoc[], locale: SearchLocale, limit = 8): SearchResult[] {
	// Au-delà de 12 mots, la recherche ne gagne rien : on borne pour rester instantané.
	const q = tokenize(query, locale).slice(0, 12);
	if (q.length === 0) return [];
	const need = q.length === 1 ? 1 : Math.ceil(q.length * 0.6);
	const results: SearchResult[] = [];

	for (const doc of docs) {
		const f = fieldsOf(doc, locale);
		const groups: [string[], number][] = [
			[f.keywords, WEIGHTS.keywords],
			[f.title, doc.type === 'article' ? WEIGHTS.article : WEIGHTS.question],
			[f.snippet, WEIGHTS.snippet],
		];
		let score = 0;
		let matched = 0;
		for (const qt of q) {
			let best = 0;
			for (const [tokens, weight] of groups) for (const dt of tokens) best = Math.max(best, matchScore(qt, dt) * weight);
			if (best > 0) {
				matched++;
				score += best;
			}
		}
		if (matched >= need) results.push({ doc, score });
	}

	results.sort(
		(a, b) =>
			b.score - a.score ||
			Number(b.doc.type === 'question') - Number(a.doc.type === 'question') ||
			a.doc.title.localeCompare(b.doc.title),
	);
	return results.slice(0, limit);
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npm test`
Expected: PASS, tous les tests de `questionSearch.test.ts`. Si `2 espaces` dans le test `normalize` échoue, vérifier que `œ` est remplacé avant le filtre `[^a-z0-9]`.

- [ ] **Point de contrôle** : `npm test` vert. Aucun fichier Astro modifié.

---

### Task 3: Utilitaires et validation de suggestion (TDD)

**Files:**
- Create: `src/lib/questionUtils.ts`, `src/lib/suggestionValidation.ts`
- Test: `tests/questionUtils.test.ts`, `tests/suggestionValidation.test.ts`

**Interfaces:**
- Produces (`questionUtils.ts`): `QUESTION_CATEGORIES` (tuple) ; `stripHtml(html: string): string` ; `wordCount(text: string): number` ; `truncate(text: string, max: number): string` ; `groupByCategory<T extends { categorie?: string | null }>(items: T[]): { categorie: string; items: T[] }[]` (catégories connues dans l'ordre, puis `'autre'`) ; `relatedQuestions<T extends { slug: string; categorie?: string | null; date_publication?: string | null }>(all: T[], current: { slug: string; categorie?: string | null }, n?: number): T[]`.
- Produces (`suggestionValidation.ts`): `validateSuggestion(payload: unknown): { status: 'ok'; value: { texte: string; email: string | null; langue: 'fr' | 'en' } } | { status: 'invalid'; message: string } | { status: 'bot' }`.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts file=tests/questionUtils.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripHtml, wordCount, truncate, groupByCategory, relatedQuestions } from '../src/lib/questionUtils.ts';

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
```

```ts file=tests/suggestionValidation.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSuggestion } from '../src/lib/suggestionValidation.ts';

const ok = { texte: 'Un exosquelette convient-il aux genoux fragiles ?', email: '', langue: 'fr', website: '' };

test('suggestion valide, email absent', () => {
	const r = validateSuggestion(ok);
	assert.equal(r.status, 'ok');
	if (r.status === 'ok') assert.deepEqual(r.value, { texte: ok.texte, email: null, langue: 'fr' });
});

test('email valide conservé, langue en', () => {
	const r = validateSuggestion({ ...ok, email: 'a@b.co', langue: 'en' });
	assert.equal(r.status === 'ok' && r.value.email, 'a@b.co');
	assert.equal(r.status === 'ok' && r.value.langue, 'en');
});

test('langue inconnue : repli sur fr', () => {
	const r = validateSuggestion({ ...ok, langue: 'de' });
	assert.equal(r.status === 'ok' && r.value.langue, 'fr');
});

test('champ leurre rempli : robot, silence', () => {
	assert.equal(validateSuggestion({ ...ok, website: 'http://spam.example' }).status, 'bot');
});

test('texte trop court, trop long, absent, non textuel', () => {
	for (const texte of ['court', 'x'.repeat(301), '', 42, null, undefined]) assert.equal(validateSuggestion({ ...ok, texte }).status, 'invalid');
});

test('URLs refusées', () => {
	for (const texte of ['Regardez http://spam.example pour un exosquelette', 'Voir www.spam.example maintenant svp']) assert.equal(validateSuggestion({ ...ok, texte }).status, 'invalid');
});

test('email invalide ou trop long refusé', () => {
	assert.equal(validateSuggestion({ ...ok, email: 'pas-un-email' }).status, 'invalid');
	assert.equal(validateSuggestion({ ...ok, email: `${'a'.repeat(250)}@b.co` }).status, 'invalid');
});

test('balises HTML conservées comme texte (échappées à l\'affichage), espaces normalisés', () => {
	const r = validateSuggestion({ ...ok, texte: '  Un   <b>exosquelette</b>   pour le ski ?  ' });
	assert.equal(r.status === 'ok' && r.value.texte, 'Un <b>exosquelette</b> pour le ski ?');
});

test('payload non objet', () => {
	for (const p of [null, undefined, 'texte', 12, []]) assert.equal(validateSuggestion(p).status, 'invalid');
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npm test`
Expected: FAIL (modules introuvables).

- [ ] **Step 3: Écrire `questionUtils.ts`**

```ts file=src/lib/questionUtils.ts
export const QUESTION_CATEGORIES = ['ski', 'genou', 'randonnee', 'dos-travail', 'achat-prix', 'sante-securite', 'technique'] as const;
export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

export const stripHtml = (html: string): string =>
	html
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

export const wordCount = (text: string): number => text.split(/\s+/).filter(Boolean).length;

/** Coupe au dernier mot entier avant `max` caractères et ajoute … */
export function truncate(text: string, max: number): string {
	if (text.length <= max) return text;
	const cut = text.slice(0, max);
	const lastSpace = cut.lastIndexOf(' ');
	return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Catégories connues dans l'ordre de QUESTION_CATEGORIES, puis « autre » (catégorie vide ou inconnue). */
export function groupByCategory<T extends { categorie?: string | null }>(items: T[]): { categorie: string; items: T[] }[] {
	const known: string[] = [...QUESTION_CATEGORIES];
	const map = new Map<string, T[]>();
	for (const item of items) {
		const c = item.categorie && known.includes(item.categorie) ? item.categorie : 'autre';
		const list = map.get(c) ?? [];
		list.push(item);
		map.set(c, list);
	}
	return [...known, 'autre'].filter((c) => map.has(c)).map((c) => ({ categorie: c, items: map.get(c)! }));
}

/** Questions voisines : même catégorie d'abord, puis les autres ; les plus récentes en premier. */
export function relatedQuestions<T extends { slug: string; categorie?: string | null; date_publication?: string | null }>(
	all: T[],
	current: { slug: string; categorie?: string | null },
	n = 3,
): T[] {
	const time = (q: T) => (q.date_publication ? new Date(q.date_publication).getTime() : 0);
	const others = all.filter((q) => q.slug !== current.slug).sort((a, b) => time(b) - time(a));
	const same = others.filter((q) => current.categorie && q.categorie === current.categorie);
	const rest = others.filter((q) => !same.includes(q));
	return [...same, ...rest].slice(0, n);
}
```

- [ ] **Step 4: Écrire `suggestionValidation.ts`**

```ts file=src/lib/suggestionValidation.ts
export type SuggestionResult =
	| { status: 'ok'; value: { texte: string; email: string | null; langue: 'fr' | 'en' } }
	| { status: 'invalid'; message: string }
	| { status: 'bot' };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSuggestion(payload: unknown): SuggestionResult {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { status: 'invalid', message: 'Requête invalide' };
	const p = payload as Record<string, unknown>;

	// Champ leurre : invisible pour un humain, rempli par les robots.
	if (typeof p.website === 'string' && p.website.trim() !== '') return { status: 'bot' };

	const texte = typeof p.texte === 'string' ? p.texte.replace(/\s+/g, ' ').trim() : '';
	if (texte.length < 10 || texte.length > 300) return { status: 'invalid', message: 'La question doit faire entre 10 et 300 caractères' };
	if (/https?:\/\/|www\./i.test(texte)) return { status: 'invalid', message: 'Les liens ne sont pas acceptés' };

	const emailRaw = typeof p.email === 'string' ? p.email.trim() : '';
	if (emailRaw && (emailRaw.length > 254 || !EMAIL.test(emailRaw))) return { status: 'invalid', message: 'Email invalide' };

	return { status: 'ok', value: { texte, email: emailRaw || null, langue: p.langue === 'en' ? 'en' : 'fr' } };
}
```

- [ ] **Step 5: Vérifier que tout passe**

Run: `npm test`
Expected: PASS (recherche, utilitaires, validation).

- [ ] **Point de contrôle** : `npm test` vert.

---

### Task 4: Accès aux données (`content.ts`, index, chargeur de page)

**Files:**
- Modify: `src/lib/content.ts` (ajout en fin de fichier, avant `export { slugifyBrand };`)
- Create: `src/lib/questionIndex.ts`, `src/lib/questionPage.ts`

**Interfaces:**
- Consumes: `fetchDirectus`, `localizeArticle`, `localizeProduct`, `listArticles`, `path`, `locales`, `relatedQuestions`, `SearchDoc`.
- Produces: `listQuestions(locale: Locale, fields?: string): Promise<any[]>` (uniquement `statut = publie` ; en EN, uniquement celles qui ont une traduction) ; `getQuestion(locale: Locale, slug: string): Promise<any | null>` ; `buildSearchIndex(locale: Locale): Promise<SearchDoc[]>` ; `loadQuestionPage(locale: Locale, slug: string | undefined)` → `{ question, related, article, product, alternates, errorMessage, notFound }`.

- [ ] **Step 1: Ajouter à `content.ts`**

Insérer avant la ligne `export { slugifyBrand };` :

```ts
// --- Questions / réponses : uniquement les questions publiées (le jeton est Admin, Directus ne filtre pas) ---
export const QUESTION_TEXT_FIELDS = ['question', 'slug', 'reponse_courte', 'reponse', 'mots_cles'] as const;
export const localizeQuestion = (q: any, locale: Locale) => localizeItem(q, locale, QUESTION_TEXT_FIELDS);

const QUESTION_LIST_FIELDS = 'id,question,slug,reponse_courte,mots_cles,categorie,article_lie,produit_lie,date_publication,date_updated,auteur';
const QUESTION_FULL_FIELDS = `${QUESTION_LIST_FIELDS},reponse`;

export async function listQuestions(locale: Locale, fields: string = QUESTION_LIST_FIELDS) {
	const q = [`fields=${fields}${TR}`, 'limit=-1', 'filter[statut][_eq]=publie', 'sort=-date_publication'];
	if (locale !== 'fr') q.push(`filter[translations][languages_code][_eq]=${locale}`);
	const data = await fetchDirectus(`/items/Questions?${q.join('&')}`);
	return (data ?? []).map((x: any) => localizeQuestion(x, locale)).filter((x: any) => x && x.slug);
}

/** Une question publiée par son adresse dans la langue demandée (null si absente, brouillon ou non traduite). */
export async function getQuestion(locale: Locale, slug: string) {
	let filter = `filter[slug][_eq]=${encodeURIComponent(slug)}`;
	if (locale !== 'fr') {
		const hit = await fetchDirectus(
			`/items/Questions_translations?filter[slug][_eq]=${encodeURIComponent(slug)}&filter[languages_code][_eq]=${locale}&fields=Questions_id&limit=1`,
		);
		const id = hit?.[0]?.Questions_id;
		if (!id) return null;
		filter = `filter[id][_eq]=${id}`;
	}
	const data = await fetchDirectus(`/items/Questions?${filter}&filter[statut][_eq]=publie&fields=${QUESTION_FULL_FIELDS}${TR}&limit=1`);
	const item = Array.isArray(data) ? data[0] : data;
	const q = item ? localizeQuestion(item, locale) : null;
	return q && q.slug && q.question ? q : null;
}
```

- [ ] **Step 2: Créer l'index de recherche**

```ts file=src/lib/questionIndex.ts
import { listQuestions, listArticles } from './content';
import { path, type Locale } from '../i18n';
import type { SearchDoc } from './questionSearch';

/** Questions publiées + articles d'une langue, sous la forme attendue par la recherche du navigateur. */
export async function buildSearchIndex(locale: Locale): Promise<SearchDoc[]> {
	const [questions, articles] = await Promise.all([
		listQuestions(locale),
		listArticles(locale, 'id,titre,slug,description_seo'),
	]);
	return [
		...questions.map((q: any): SearchDoc => ({
			type: 'question',
			slug: q.slug,
			title: q.question,
			url: path(locale, 'questions', q.slug),
			keywords: q.mots_cles ?? '',
			snippet: q.reponse_courte ?? '',
			category: q.categorie ?? undefined,
		})),
		...articles.filter((a: any) => a.slug && a.titre).map((a: any): SearchDoc => ({
			type: 'article',
			slug: a.slug,
			title: a.titre,
			url: path(locale, 'articles', a.slug),
			snippet: a.description_seo ?? '',
		})),
	];
}
```

- [ ] **Step 3: Créer le chargeur de page**

```ts file=src/lib/questionPage.ts
import { fetchDirectus } from './directus';
import { getQuestion, listQuestions, localizeArticle, localizeProduct } from './content';
import { relatedQuestions } from './questionUtils';
import { locales, path, type Locale } from '../i18n';

export async function loadQuestionPage(locale: Locale, slug: string | undefined) {
	let question: any = null;
	let errorMessage: string | null = null;
	let related: { question: string; slug: string }[] = [];
	let article: { titre: string; slug: string } | null = null;
	let product: { name: string; slug: string } | null = null;

	try {
		question = await getQuestion(locale, slug ?? '');
		if (question) {
			const [all, rawArticle, rawProduct] = await Promise.all([
				listQuestions(locale, 'id,question,slug,categorie,date_publication'),
				question.article_lie ? fetchDirectus(`/items/Articles/${question.article_lie}?fields=id,titre,slug,translations.*`) : null,
				question.produit_lie ? fetchDirectus(`/items/Produits/${question.produit_lie}?fields=id,Nom_du_produit,nom_court,slug,translations.*`) : null,
			]);
			related = relatedQuestions(all, question, 3).map((r: any) => ({ question: r.question, slug: r.slug }));

			// Pas de lien vers une page qui n'existe pas dans cette langue.
			const a = rawArticle ? localizeArticle(rawArticle, locale) : null;
			if (a?.slug && a?.titre) article = { titre: a.titre, slug: a.slug };
			const p = rawProduct ? localizeProduct(rawProduct, locale) : null;
			if (p?.slug && (p.nom_court || p.Nom_du_produit)) product = { name: p.nom_court || p.Nom_du_produit, slug: p.slug };
		}
	} catch (error: any) {
		console.error('Erreur Question:', error);
		errorMessage = error.message;
	}

	const alternates: Partial<Record<Locale, string>> = question
		? Object.fromEntries(locales.filter((l) => question.slugs?.[l]).map((l) => [l, path(l, 'questions', question.slugs[l])]))
		: {};

	return { question, related, article, product, alternates, errorMessage, notFound: !question && !errorMessage };
}
```

- [ ] **Step 4: Vérifier que le projet compile**

Run: `npm run build`
Expected: build sans erreur (les nouveaux modules ne sont pas encore utilisés par des pages ; l'import `path(locale, 'questions', …)` n'est valide qu'après la Task 5 : si le build échoue sur `'questions'`, faire la Task 5 avant de relancer).

- [ ] **Point de contrôle** : `content.ts` exporte `listQuestions`/`getQuestion` ; rien n'est encore visible sur le site.

---

### Task 5: Routes, textes FR/EN et navigation

**Files:**
- Modify: `src/i18n/routes.ts`, `src/i18n/fr.ts`, `src/i18n/en.ts`, `src/components/Header.astro`, `src/components/Footer.astro`

**Interfaces:**
- Produces: `RouteName` inclut `'questions'` ; `t.nav.questions` ; `t.questions.*` (clés listées ci-dessous, identiques en FR et EN).

- [ ] **Step 1: Route**

Dans `src/i18n/routes.ts`, après la ligne `methodology: ...` :

```ts
	questions: { fr: 'questions', en: 'questions' },
```

- [ ] **Step 2: Textes français**

Dans `src/i18n/fr.ts`, dans `nav`, après `articles: 'Articles',` ajouter `questions: 'Questions',`. Puis, juste après la ligne `breadcrumb: { home: 'Accueil', shop: 'Boutique', blog: 'Blog' },` :

```ts
	questions: {
		seoTitle: 'Questions et réponses sur les exosquelettes | NeoSomaTech',
		seoDescription: 'Réponses détaillées et sourcées aux questions sur les exosquelettes : ski, genou, randonnée, dos au travail, prix, sécurité.',
		title: 'Questions & <em>réponses</em>',
		lede: 'Une question sur les exosquelettes ? Cherchez ci-dessous : chaque réponse est détaillée et sourcée.',
		searchLabel: 'Rechercher une question ou un sujet',
		searchPlaceholder: 'Ex. : à quel âge skier avec un exosquelette ?',
		searchButton: 'Rechercher',
		resultsCount: '{n} résultat(s)',
		badgeAnswer: 'Réponse',
		badgeArticle: 'Article',
		noResultsTitle: 'Aucune réponse trouvée pour cette recherche',
		noResultsText: 'Proposez-nous votre question : nous y répondrons dans un prochain contenu.',
		suggestLabel: 'Votre question',
		suggestPlaceholder: 'Formulez votre question en une phrase',
		suggestEmailLabel: 'Email (facultatif, pour être prévenu de la réponse)',
		suggestSubmit: 'Envoyer ma question',
		suggestThanks: 'Merci ! Votre question a bien été reçue.',
		suggestError: "Impossible d'envoyer la question, réessayez plus tard.",
		searchError: 'La recherche est momentanément indisponible. Parcourez les questions ci-dessous.',
		emptyHub: 'Les premières réponses arrivent bientôt.',
		shortAnswer: 'Réponse courte',
		relatedQuestions: 'Questions liées',
		relatedArticle: 'Pour aller plus loin',
		relatedProduct: 'Produit concerné',
		backToAll: 'Toutes les questions',
		notFoundTitle: 'Question introuvable',
		other: 'Autres questions',
		categories: {
			ski: 'Ski',
			genou: 'Genou',
			randonnee: 'Randonnée',
			'dos-travail': 'Dos et travail',
			'achat-prix': 'Achat et prix',
			'sante-securite': 'Santé et sécurité',
			technique: 'Technique',
		},
	},
```

- [ ] **Step 3: Textes anglais**

Dans `src/i18n/en.ts`, dans `nav`, après `articles: 'Articles',` ajouter `questions: 'Questions',`. Puis, juste après la ligne `breadcrumb: { home: 'Home', shop: 'Shop', blog: 'Blog' },` :

```ts
	questions: {
		seoTitle: 'Exoskeleton questions and answers | NeoSomaTech',
		seoDescription: 'Detailed, sourced answers to your exoskeleton questions: skiing, knee, hiking, back support at work, price, safety.',
		title: 'Questions & <em>answers</em>',
		lede: 'A question about exoskeletons? Search below: every answer is detailed and sourced.',
		searchLabel: 'Search a question or a topic',
		searchPlaceholder: 'E.g. what age can you ski with an exoskeleton?',
		searchButton: 'Search',
		resultsCount: '{n} result(s)',
		badgeAnswer: 'Answer',
		badgeArticle: 'Article',
		noResultsTitle: 'No answer found for this search',
		noResultsText: 'Send us your question: we will answer it in an upcoming piece.',
		suggestLabel: 'Your question',
		suggestPlaceholder: 'Write your question in one sentence',
		suggestEmailLabel: 'Email (optional, to be told when it is answered)',
		suggestSubmit: 'Send my question',
		suggestThanks: 'Thank you! Your question has been received.',
		suggestError: 'Could not send the question, please try again later.',
		searchError: 'Search is temporarily unavailable. Browse the questions below.',
		emptyHub: 'The first answers are coming soon.',
		shortAnswer: 'Short answer',
		relatedQuestions: 'Related questions',
		relatedArticle: 'Keep exploring',
		relatedProduct: 'Related product',
		backToAll: 'All questions',
		notFoundTitle: 'Question not found',
		other: 'Other questions',
		categories: {
			ski: 'Skiing',
			genou: 'Knee',
			randonnee: 'Hiking',
			'dos-travail': 'Back and work',
			'achat-prix': 'Buying and price',
			'sante-securite': 'Health and safety',
			technique: 'Technical',
		},
	},
```

- [ ] **Step 4: Menu et footer**

Dans `src/components/Header.astro`, dans `navLinks`, après la ligne `{ href: path(locale, 'articles'), label: t.nav.articles },` :

```astro
    { href: path(locale, 'questions'), label: t.nav.questions },
```

Dans `src/components/Footer.astro`, après la ligne `<li><a href={path(locale, 'methodology')}>{t.footer.methodology}</a></li>` :

```astro
          <li><a href={path(locale, 'questions')}>{t.nav.questions}</a></li>
```

- [ ] **Step 5: Vérifier la compilation**

Run: `npm run build`
Expected: build sans erreur (le compilateur confirme que `en.ts` a exactement les clés de `fr.ts`). Le lien « Questions » du menu pointe vers une page qui n'existe pas encore : ne pas déployer avant la Task 6.

- [ ] **Point de contrôle** : build vert ; `npm test` vert.

---

### Task 6: Page de réponse et hub

**Files:**
- Create: `src/views/QuestionView.astro`, `src/views/QuestionsHubView.astro`
- Create: `src/pages/questions/index.astro`, `src/pages/questions/[slug].astro`, `src/pages/en/questions/index.astro`, `src/pages/en/questions/[slug].astro`

**Interfaces:**
- Consumes: `loadQuestionPage`, `listQuestions`, `groupByCategory`, `truncate`, `t.questions.*`.
- Produces: routes `/questions`, `/questions/[slug]`, `/en/questions`, `/en/questions/[slug]` ; le hub expose `#qsearch` (attributs `data-index-url`, `data-locale`, `data-strings`) utilisé par la Task 7.

- [ ] **Step 1: Vue de la page de réponse**

```astro file=src/views/QuestionView.astro
---
import Layout from '../layouts/Layout.astro';
import { useTranslations, localeMeta, path, type Locale } from '../i18n';
import { truncate } from '../lib/questionUtils';

interface Props {
	locale: Locale;
	question: any;
	related: { question: string; slug: string }[];
	article: { titre: string; slug: string } | null;
	product: { name: string; slug: string } | null;
	errorMessage: string | null;
	alternates: Partial<Record<Locale, string>>;
}

const { locale, question, related, article, product, errorMessage, alternates } = Astro.props;
const t = useTranslations(locale);
const q = t.questions;
const intl = localeMeta[locale].intl;

const formatDate = (date: string) => {
	const d = new Date(date);
	return isNaN(d.getTime()) ? date : new Intl.DateTimeFormat(intl, { year: 'numeric', month: 'long', day: 'numeric' }).format(d);
};

const description = question ? truncate(question.reponse_courte ?? '', 155) : q.seoDescription;
const schemaItem = question
	? {
			titre: question.question,
			description_seo: question.reponse_courte,
			meta_description: description,
			date_publication: question.date_publication,
			date_updated: question.date_updated,
			auteur: question.auteur,
			image_principale: null,
		}
	: undefined;
const categoryLabel = question?.categorie ? (q.categories as Record<string, string>)[question.categorie] : null;
---

<Layout
	locale={locale}
	alternates={alternates}
	title={question ? `${question.question} | NeoSomaTech` : q.notFoundTitle}
	description={description}
	type="article"
	schemaItem={schemaItem}
	faqs={question ? [{ question: question.question, reponse: question.reponse_courte ?? '' }] : []}
	noindex={!question || !!errorMessage}
>
	{errorMessage ? (
		<div class="container p-notice p-notice--error">{errorMessage}</div>
	) : question && (
		<div class="p-page q-page">
			<nav class="p-crumb">
				<a href={path(locale, 'home')}>{t.nav.home}</a><span>/</span>
				<a href={path(locale, 'questions')}>{t.nav.questions}</a><span>/</span>
				<span>{question.question}</span>
			</nav>

			<div class="p-label q-meta">
				{categoryLabel && <span>{categoryLabel}</span>}
				{question.date_updated && question.date_updated !== question.date_publication
					? <span>{t.articles.updatedOn} <time datetime={question.date_updated}>{formatDate(question.date_updated)}</time></span>
					: question.date_publication && <time datetime={question.date_publication}>{formatDate(question.date_publication)}</time>}
				{question.auteur && (
					<span>{t.articles.byPrefix} {question.auteur === 'Axel Paupier'
						? <a href={path(locale, 'author', 'axel-paupier')} rel="author">{question.auteur}</a>
						: question.auteur}</span>
				)}
			</div>

			<h1 class="p-display p-title">{question.question}</h1>

			{question.reponse_courte && (
				<aside class="q-short" aria-label={q.shortAnswer}>
					<p class="p-label">{q.shortAnswer}</p>
					<p>{question.reponse_courte}</p>
				</aside>
			)}

			{question.reponse && <div class="p-prose q-body" set:html={question.reponse} />}

			<footer class="q-foot">
				{article && (
					<section>
						<h2 class="p-label">{q.relatedArticle}</h2>
						<p><a href={path(locale, 'articles', article.slug)}>{article.titre}</a></p>
					</section>
				)}
				{product && (
					<section>
						<h2 class="p-label">{q.relatedProduct}</h2>
						<p><a href={path(locale, 'product', product.slug)}>{product.name}</a></p>
					</section>
				)}
				{related.length > 0 && (
					<section>
						<h2 class="p-label">{q.relatedQuestions}</h2>
						<ul>
							{related.map((r) => <li><a href={path(locale, 'questions', r.slug)}>{r.question}</a></li>)}
						</ul>
					</section>
				)}
				<p><a class="btn btn-outline" href={path(locale, 'questions')}>&larr; {q.backToAll}</a></p>
			</footer>
		</div>
	)}
</Layout>

<style>
	.q-page { max-width: 820px; }
	.q-meta { display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; margin-bottom: 1rem; }
	.q-short { border-left: 4px solid var(--ink); background: var(--paper-2); padding: 1.25rem 1.5rem; margin: 0 0 2.5rem; }
	.q-short p:last-child { margin: 0; font-size: 1.2rem; line-height: 1.6; }
	.q-body { font-size: 1.1rem; }
	.q-foot { margin-top: 3.5rem; padding-top: 2rem; border-top: 1px solid var(--ink); display: grid; gap: 1.5rem; }
	.q-foot ul { padding-left: 1.2rem; margin: 0; }
</style>
```

- [ ] **Step 2: Routes de la page de réponse (FR puis EN)**

```astro file=src/pages/questions/[slug].astro
---
import QuestionView from '../../views/QuestionView.astro';
import { loadQuestionPage } from '../../lib/questionPage';

const page = await loadQuestionPage('fr', Astro.params.slug);
if (page.notFound) return Astro.redirect('/404');
if (!page.question || page.errorMessage) Astro.response.status = 404;
---

<QuestionView locale="fr" question={page.question} related={page.related} article={page.article} product={page.product} errorMessage={page.errorMessage} alternates={page.alternates} />
```

```astro file=src/pages/en/questions/[slug].astro
---
import QuestionView from '../../../views/QuestionView.astro';
import { loadQuestionPage } from '../../../lib/questionPage';

const page = await loadQuestionPage('en', Astro.params.slug);
if (page.notFound) return Astro.redirect('/en/404');
if (!page.question || page.errorMessage) Astro.response.status = 404;
---

<QuestionView locale="en" question={page.question} related={page.related} article={page.article} product={page.product} errorMessage={page.errorMessage} alternates={page.alternates} />
```

- [ ] **Step 3: Vue du hub (recherche + catalogue)**

```astro file=src/views/QuestionsHubView.astro
---
import Layout from '../layouts/Layout.astro';
import { listQuestions } from '../lib/content';
import { groupByCategory } from '../lib/questionUtils';
import { useTranslations, locales, path, type Locale } from '../i18n';

interface Props {
	locale: Locale;
}

const { locale } = Astro.props;
const t = useTranslations(locale);
const q = t.questions;

let questions: any[] = [];
let errorMessage: string | null = null;
try {
	questions = await listQuestions(locale);
} catch (error: any) {
	console.error('Erreur Questions:', error);
	errorMessage = error.message;
}
const groups = groupByCategory(questions);
const label = (c: string) => (c === 'autre' ? q.other : (q.categories as Record<string, string>)[c]);

// Le hub d'une autre langue n'est déclaré que s'il contient au moins une question traduite.
const others = locales.filter((l) => l !== locale);
const presence = await Promise.all(others.map(async (l) => (await listQuestions(l, 'id,slug').catch(() => [])).length > 0));
const alternates: Partial<Record<Locale, string>> = {
	[locale]: path(locale, 'questions'),
	...Object.fromEntries(others.filter((_, i) => presence[i]).map((l) => [l, path(l, 'questions')])),
};

const strings = {
	resultsCount: q.resultsCount, badgeAnswer: q.badgeAnswer, badgeArticle: q.badgeArticle,
	noResultsTitle: q.noResultsTitle, noResultsText: q.noResultsText,
	suggestThanks: q.suggestThanks, suggestError: q.suggestError, searchError: q.searchError,
};
---

<Layout locale={locale} alternates={alternates} title={q.seoTitle} description={q.seoDescription} noindex={questions.length === 0}>
	<div class="p-page q-hub">
		<nav class="p-crumb"><a href={path(locale, 'home')}>{t.nav.home}</a><span>/</span><span>{t.nav.questions}</span></nav>
		<h1 class="p-display p-title" set:html={q.title} />
		<p class="q-lede">{q.lede}</p>

		<section id="qsearch" class="q-search" data-index-url={`${path(locale, 'questions')}/index.json`} data-locale={locale} data-strings={JSON.stringify(strings)}>
			<form id="qsearch-form" class="q-search-form" role="search" novalidate>
				<label class="p-label" for="qsearch-input">{q.searchLabel}</label>
				<div class="q-search-row">
					<input id="qsearch-input" type="search" autocomplete="off" maxlength="200" placeholder={q.searchPlaceholder} />
					<button type="submit" class="btn">{q.searchButton}</button>
				</div>
			</form>
			<p id="qsearch-status" class="p-label" aria-live="polite"></p>
			<ul id="qsearch-results" class="q-results"></ul>

			<div id="qsuggest-box" class="q-suggest" hidden>
				<h2>{q.noResultsTitle}</h2>
				<p>{q.noResultsText}</p>
				<form id="qsuggest-form" novalidate>
					<label class="p-label" for="qsuggest-text">{q.suggestLabel}</label>
					<textarea id="qsuggest-text" rows="3" maxlength="300" placeholder={q.suggestPlaceholder} required></textarea>
					<label class="p-label" for="qsuggest-email">{q.suggestEmailLabel}</label>
					<input id="qsuggest-email" type="email" maxlength="254" autocomplete="email" />
					<input id="qsuggest-website" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" class="q-trap" />
					<button type="submit" class="btn">{q.suggestSubmit}</button>
					<p id="qsuggest-msg" aria-live="polite"></p>
				</form>
			</div>
		</section>

		{errorMessage && <div class="p-notice p-notice--error">{errorMessage}</div>}

		<div id="qcatalog">
			{groups.length === 0 ? (
				<p>{q.emptyHub}</p>
			) : groups.map((g) => (
				<section class="q-group" id={`cat-${g.categorie}`}>
					<h2>{label(g.categorie)}</h2>
					<ul>
						{g.items.map((item: any) => (
							<li><a href={path(locale, 'questions', item.slug)}>{item.question}</a></li>
						))}
					</ul>
				</section>
			))}
		</div>
	</div>
</Layout>

<script src="../scripts/question-search.client.ts"></script>

<style>
	.q-hub { max-width: 900px; }
	.q-lede { font-size: 1.2rem; color: var(--ink-soft); margin-bottom: 2rem; }
	.q-search { margin-bottom: 3rem; }
	.q-search-row { display: flex; gap: 0.75rem; margin-top: 0.5rem; }
	.q-search-row input { flex: 1; padding: 0.8rem 1rem; border: 1px solid var(--ink); background: var(--paper); font: inherit; }
	.q-results { list-style: none; padding: 0; margin: 1rem 0 0; display: grid; gap: 0.75rem; }
	.q-results li { border: 1px solid var(--ink); padding: 1rem 1.25rem; }
	.q-results a { font-weight: 600; }
	.q-results p { margin: 0.35rem 0 0; color: var(--ink-soft); }
	.q-badge { display: inline-block; margin-right: 0.6rem; padding: 0 0.5rem; border: 1px solid var(--ink); font-size: 0.75rem; text-transform: uppercase; }
	.q-suggest { margin-top: 1.5rem; padding: 1.5rem; border: 1px dashed var(--ink); }
	.q-suggest textarea, .q-suggest input[type='email'] { width: 100%; padding: 0.7rem; border: 1px solid var(--ink); background: var(--paper); font: inherit; margin: 0.4rem 0 1rem; }
	.q-trap { position: absolute; left: -9999px; height: 0; width: 0; opacity: 0; }
	.q-group { margin-bottom: 2rem; }
	.q-group ul { padding-left: 1.2rem; }
</style>
```

- [ ] **Step 4: Routes du hub**

```astro file=src/pages/questions/index.astro
---
import QuestionsHubView from '../../views/QuestionsHubView.astro';
---

<QuestionsHubView locale="fr" />
```

```astro file=src/pages/en/questions/index.astro
---
import QuestionsHubView from '../../../views/QuestionsHubView.astro';
---

<QuestionsHubView locale="en" />
```

- [ ] **Step 5: Compiler puis vérifier les cas limites en local**

Run: `npm run build`
Expected: build sans erreur. (Le script client n'existe pas encore ; s'il est demandé par le build, créer un fichier vide `src/scripts/question-search.client.ts` puis continuer, la Task 7 le remplit.)

Puis démarrer le serveur de dev (`npx astro dev --port 4399` en arrière-plan) et vérifier, sans aucune question publiée :
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:4399/questions` → `200` ; la page contient `Les premières réponses arrivent bientôt.` et `noindex`.
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:4399/questions/n-existe-pas` → `404` (redirection puis 404 de la page d'erreur ; accepter `302` suivi de `404`).
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:4399/en/questions` → `200`.

- [ ] **Point de contrôle** : hub et page de réponse compilent ; collection vide sans erreur 500. Arrêter le serveur de dev.

---

### Task 7: Recherche dans le navigateur, index JSON et suggestions

**Files:**
- Create: `src/scripts/question-search.client.ts`, `src/pages/questions/index.json.ts`, `src/pages/en/questions/index.json.ts`, `src/pages/api/questions-suggestions.ts`

**Interfaces:**
- Consumes: `search`, `SearchDoc` (`questionSearch.ts`), `buildSearchIndex`, `validateSuggestion`, `directusUrl`/`directusToken`, éléments `#qsearch*`/`#qsuggest*` du hub.
- Produces: `GET /questions/index.json` et `GET /en/questions/index.json` → tableau JSON de `SearchDoc` ; `POST /api/questions-suggestions` → `200 { message }` ou `400 { message }`.

- [ ] **Step 1: Endpoints d'index**

```ts file=src/pages/questions/index.json.ts
import type { APIRoute } from 'astro';
import { buildSearchIndex } from '../../lib/questionIndex';

export const GET: APIRoute = async () => {
	try {
		const docs = await buildSearchIndex('fr');
		return new Response(JSON.stringify(docs), {
			headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=300' },
		});
	} catch (error) {
		console.error('Index questions FR:', error);
		return new Response('[]', { status: 502, headers: { 'Content-Type': 'application/json' } });
	}
};
```

```ts file=src/pages/en/questions/index.json.ts
import type { APIRoute } from 'astro';
import { buildSearchIndex } from '../../../lib/questionIndex';

export const GET: APIRoute = async () => {
	try {
		const docs = await buildSearchIndex('en');
		return new Response(JSON.stringify(docs), {
			headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=300' },
		});
	} catch (error) {
		console.error('Index questions EN:', error);
		return new Response('[]', { status: 502, headers: { 'Content-Type': 'application/json' } });
	}
};
```

- [ ] **Step 2: Endpoint de suggestion**

```ts file=src/pages/api/questions-suggestions.ts
import type { APIRoute } from 'astro';
import { directusUrl, directusToken } from '../../lib/directus';
import { validateSuggestion } from '../../lib/suggestionValidation';

const json = (body: Record<string, unknown>, status: number) =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return json({ message: 'Requête invalide' }, 400);
	}

	const result = validateSuggestion(payload);
	if (result.status === 'bot') return json({ message: 'ok' }, 200);
	if (result.status === 'invalid') return json({ message: result.message }, 400);

	// Champs listés un par un, statut forcé côté serveur.
	const row = { texte: result.value.texte, email: result.value.email, langue: result.value.langue, statut: 'nouvelle' };
	try {
		const res = await fetch(`${directusUrl}/items/Questions_suggestions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${directusToken}` },
			body: JSON.stringify(row),
		});
		if (!res.ok) {
			console.error('Directus suggestion error:', res.status, await res.text());
			return json({ message: `Erreur ${res.status}` }, 502);
		}
		return json({ message: 'Question enregistrée' }, 200);
	} catch (error) {
		console.error('API suggestion error:', error);
		return json({ message: 'Erreur serveur' }, 500);
	}
};
```

- [ ] **Step 3: Script du navigateur (rendu par `textContent` uniquement)**

```ts file=src/scripts/question-search.client.ts
import { search, type SearchDoc, type SearchLocale } from '../lib/questionSearch';

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

	let docs: SearchDoc[] | null = null;
	let timer: number | undefined;

	const loadDocs = async () => {
		if (docs) return docs;
		const res = await fetch(indexUrl);
		if (!res.ok) throw new Error(`index ${res.status}`);
		docs = (await res.json()) as SearchDoc[];
		return docs;
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
			if (!suggestText.value) suggestText.value = query;
			return;
		}
		suggestBox.hidden = true;
		status.textContent = strings.resultsCount.replace('{n}', String(found.length));
		for (const { doc } of found) {
			const li = document.createElement('li');
			const badge = document.createElement('span');
			badge.className = 'q-badge';
			badge.textContent = doc.type === 'question' ? strings.badgeAnswer : strings.badgeArticle;
			const a = document.createElement('a');
			a.href = doc.url;
			a.textContent = doc.title;
			li.append(badge, a);
			if (doc.snippet) {
				const p = document.createElement('p');
				p.textContent = doc.snippet.length > 160 ? `${doc.snippet.slice(0, 157)}…` : doc.snippet;
				li.append(p);
			}
			list.append(li);
		}
	};

	const run = async () => {
		const query = input.value.trim();
		if (query.length < 2) return reset();
		try {
			render(search(query, await loadDocs(), locale), query);
		} catch {
			status.textContent = strings.searchError;
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
		} catch {
			suggestMsg.textContent = strings.suggestError;
		}
	});
}
```

- [ ] **Step 4: Compiler**

Run: `npm run build`
Expected: build sans erreur.

- [ ] **Step 5: Vérifier les cas limites en local**

Démarrer `npx astro dev --port 4399` en arrière-plan puis :
- `curl -s http://localhost:4399/questions/index.json | head -c 300` → tableau JSON contenant les articles (le champ `type` vaut `article`), aucune question.
- Suggestion invalide : `curl -s -X POST -H "Content-Type: application/json" -d '{"texte":"court"}' http://localhost:4399/api/questions-suggestions` → `400`.
- Suggestion avec champ leurre : `curl -s -X POST -H "Content-Type: application/json" -d '{"texte":"Un exosquelette convient-il aux genoux fragiles ?","website":"x"}' http://localhost:4399/api/questions-suggestions` → `200 {"message":"ok"}` **et aucune ligne créée** dans `Questions_suggestions`.
- Suggestion valide : même appel sans `website` → `200`, puis supprimer la ligne de test dans Directus (`DELETE /items/Questions_suggestions/<id>`).
- Dans un navigateur : ouvrir `http://localhost:4399/questions`, taper « exosqelette ski » → des articles s'affichent ; taper « zzzzqqq » → le bloc « Aucune réponse trouvée » et le formulaire apparaissent ; vider le champ → le catalogue réapparaît.

- [ ] **Point de contrôle** : recherche et suggestion fonctionnent en local. Arrêter le serveur de dev.

---

### Task 8: Sitemap

**Files:**
- Modify: `src/pages/sitemap.xml.ts`

**Interfaces:**
- Consumes: `listQuestions` (`content.ts`).

- [ ] **Step 1: Importer `listQuestions`**

Remplacer :

```ts
import { listArticles, listProducts } from '../lib/content';
```

par :

```ts
import { listArticles, listProducts, listQuestions } from '../lib/content';
```

- [ ] **Step 2: Ajouter le hub aux pages fixes**

Dans `staticPages`, après la ligne `{ route: 'methodology', ... },` :

```ts
	{ route: 'questions', freq: { changefreq: 'weekly', priority: '0.7' } },
```

- [ ] **Step 3: Charger les questions et calculer la présence par langue**

Remplacer :

```ts
		const [articles, produits] = await Promise.all([
			listArticles('fr', 'slug,date_publication,date_updated'),
			listProducts('fr', 'slug,marque,date_analyse'),
		]);
```

par :

```ts
		const [articles, produits, questions] = await Promise.all([
			listArticles('fr', 'slug,date_publication,date_updated'),
			listProducts('fr', 'slug,marque,date_analyse'),
			listQuestions('fr', 'slug,date_publication,date_updated').catch(() => []),
		]);
```

Remplacer :

```ts
			shop: newestProduct,
		};
```

par :

```ts
			shop: newestProduct,
			questions: latest(questions.map((q: any) => toIso(q.date_updated || q.date_publication))),
		};
```

Remplacer :

```ts
			articles: locales.filter((l) => has(articles, l)),
		};
```

par :

```ts
			articles: locales.filter((l) => has(articles, l)),
			// Le hub n'existe dans une langue que si elle a au moins une question traduite (aucune, aucune entrée).
			questions: locales.filter((l) => questions.some((q: any) => q.slugs?.[l])),
		};
```

- [ ] **Step 4: Ajouter les questions publiées**

Juste avant la ligne `for (const produit of produits.filter((p: any) => p.slug)) {` :

```ts
		for (const question of questions) {
			groups.push({
				changefreq: 'monthly',
				priority: '0.6',
				lastmod: toIso(question.date_updated || question.date_publication),
				urls: Object.fromEntries(
					locales.filter((l) => question.slugs?.[l]).map((l) => [l, path(l, 'questions', question.slugs[l])]),
				),
			});
		}

```

Attention : `listQuestions('fr', …)` ne renvoie que des questions publiées, et `question.slugs.en` n'existe que si une traduction anglaise existe : aucune page brouillon ni non traduite n'entre dans le sitemap.

- [ ] **Step 5: Vérifier**

Run: `npm run build` → sans erreur. Puis avec le serveur de dev : `curl -s http://localhost:4399/sitemap.xml | grep -c "/questions"` → `0` tant qu'aucune question n'est publiée (aucune entrée, pas d'erreur).

- [ ] **Point de contrôle** : sitemap valide, sans question tant que la collection est vide.

---

### Task 9: Contrôleur qualité et scripts CLI (TDD)

**Files:**
- Create: `src/lib/questionLint.ts`, `scripts/check-question.mjs`, `scripts/publish-question.mjs`
- Test: `tests/questionLint.test.ts`

**Interfaces:**
- Consumes: `tokenize` (`questionSearch.ts`), `stripHtml`, `wordCount` (`questionUtils.ts`), `directus` (`scripts/lib/directus.mjs`).
- Produces: `LIMITS` ; `QuestionRecord { question: string; slug: string; reponse_courte: string; reponse: string; mots_cles: string; categorie?: string | null; article_lie?: number | null }` ; `LintIssue { level: 'error' | 'warning'; code: string; message: string }` ; `lintQuestion(rec: QuestionRecord, locale: 'fr' | 'en'): LintIssue[]` ; `findDuplicates(rec: { question: string; slug: string }, others: { title: string; slug: string; kind: 'question' | 'article' }[], locale: 'fr' | 'en'): LintIssue[]` ; `internalLinks(html: string): string[]`.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts file=tests/questionLint.test.ts
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
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npm test`
Expected: FAIL (`questionLint.ts` introuvable).

- [ ] **Step 3: Écrire le contrôleur**

```ts file=src/lib/questionLint.ts
import { tokenize } from './questionSearch.ts';
import { stripHtml, wordCount } from './questionUtils.ts';

export type LintLocale = 'fr' | 'en';

export interface QuestionRecord {
	question: string;
	slug: string;
	reponse_courte: string;
	reponse: string;
	mots_cles: string;
	categorie?: string | null;
	article_lie?: number | null;
}

export interface LintIssue {
	level: 'error' | 'warning';
	code: string;
	message: string;
}

/** Source unique des limites : le skill et les tests s'y réfèrent. */
export const LIMITS = {
	titleChars: [25, 90],
	slugWords: [3, 10],
	slugChars: 80,
	shortWords: [40, 60],
	bodyWords: { fr: [450, 1000], en: [400, 1000] } as Record<LintLocale, [number, number]>,
	h2: [3, 6],
	sectionMinWords: 60,
	keywordLines: [8, 20],
	keywordMaxChars: 80,
	keywordLongWords: 4,
	keywordLongMin: 2,
	internalLinksMin: 2,
	duplicateJaccard: 0.6,
} as const;

const SOURCES_TITLE = /^(sources?|r[eé]f[eé]rences?)\b/i;
const HEALTH = /arthrose|arthritis|proth[eè]se|prosthe|chirurgi|surgery|m[eé]dic|medic|douleur|\bpain\b|pathologi|hernie|m[eé]nisque|meniscus|ligament/i;
const DISCLAIMER = /pas un avis m[eé]dical|ne (constitue|remplace)|not medical advice|does not replace|is not a substitute/i;
const FORBIDDEN: Record<LintLocale, RegExp[]> = {
	fr: [/nous avons (test[eé]|essay[eé])/i, /notre (test|essai)s?\b/i, /miracle/i, /100\s?%\s?(efficace|garanti|sans)/i, /garanti(e|s|es)? (sans|contre)/i],
	en: [/we (have )?tested/i, /our (test|tests|testing)\b/i, /miracle/i, /100\s?%\s?(effective|guaranteed)/i, /guaranteed (pain|relief)/i],
};

export const internalLinks = (html: string): string[] =>
	[...html.matchAll(/href="(\/[^"/][^"]*|\/)"/g)].map((m) => m[1]).filter((h) => !h.startsWith('//'));
const externalLinks = (html: string): string[] => [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);

function sectionsOf(html: string): { title: string; words: number }[] {
	return html
		.split(/<h2[^>]*>/i)
		.slice(1)
		.map((part) => {
			const [heading, ...rest] = part.split(/<\/h2>/i);
			return { title: stripHtml(heading), words: wordCount(stripHtml(rest.join(' '))) };
		});
}

export function lintQuestion(rec: QuestionRecord, locale: LintLocale): LintIssue[] {
	const issues: LintIssue[] = [];
	const error = (code: string, message: string) => issues.push({ level: 'error', code, message });
	const warning = (code: string, message: string) => issues.push({ level: 'warning', code, message });

	const title = (rec.question ?? '').trim();
	if (!title.endsWith('?')) error('TITLE_NO_QUESTION_MARK', 'Le titre doit se terminer par « ? »');
	if (title.length < LIMITS.titleChars[0] || title.length > LIMITS.titleChars[1])
		error('TITLE_LENGTH', `Titre de ${title.length} caractères (attendu ${LIMITS.titleChars[0]} à ${LIMITS.titleChars[1]})`);

	const slug = rec.slug ?? '';
	const slugWords = slug.split('-').length;
	if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slugWords < LIMITS.slugWords[0] || slugWords > LIMITS.slugWords[1] || slug.length > LIMITS.slugChars)
		error('SLUG_FORMAT', `Slug « ${slug} » invalide (minuscules sans accents, ${LIMITS.slugWords[0]} à ${LIMITS.slugWords[1]} mots, ${LIMITS.slugChars} caractères max)`);

	const shortText = rec.reponse_courte ?? '';
	if (/<[a-z/]/i.test(shortText)) error('SHORT_HTML', 'La réponse courte doit être du texte brut');
	const shortWords = wordCount(shortText);
	if (shortWords < LIMITS.shortWords[0] || shortWords > LIMITS.shortWords[1])
		error('SHORT_LENGTH', `Réponse courte de ${shortWords} mots (attendu ${LIMITS.shortWords[0]} à ${LIMITS.shortWords[1]})`);

	const body = rec.reponse ?? '';
	const [minWords, maxWords] = LIMITS.bodyWords[locale];
	const bodyWords = wordCount(stripHtml(body));
	if (bodyWords < minWords || bodyWords > maxWords) error('BODY_LENGTH', `Réponse de ${bodyWords} mots (attendu ${minWords} à ${maxWords})`);
	if (/<h1[\s>]/i.test(body)) error('BODY_H1', 'Aucun <h1> dans la réponse (le titre de la page est le H1)');

	const main = sectionsOf(body).filter((s) => !SOURCES_TITLE.test(s.title));
	if (main.length < LIMITS.h2[0] || main.length > LIMITS.h2[1]) error('H2_COUNT', `${main.length} sections H2 hors Sources (attendu ${LIMITS.h2[0]} à ${LIMITS.h2[1]})`);
	for (const s of main) if (s.words < LIMITS.sectionMinWords) error('SECTION_THIN', `Section « ${s.title} » : ${s.words} mots (minimum ${LIMITS.sectionMinWords})`);

	const lines = (rec.mots_cles ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
	if (lines.length < LIMITS.keywordLines[0] || lines.length > LIMITS.keywordLines[1])
		error('KEYWORDS_COUNT', `${lines.length} lignes de mots-clés (attendu ${LIMITS.keywordLines[0]} à ${LIMITS.keywordLines[1]})`);
	if (lines.some((l) => l.length > LIMITS.keywordMaxChars)) error('KEYWORDS_TOO_LONG', `Une ligne de mots-clés dépasse ${LIMITS.keywordMaxChars} caractères`);
	if (lines.filter((l) => l.split(/\s+/).length >= LIMITS.keywordLongWords).length < LIMITS.keywordLongMin)
		warning('KEYWORDS_LONG', `Ajouter au moins ${LIMITS.keywordLongMin} formulations complètes (${LIMITS.keywordLongWords} mots ou plus) dans les mots-clés`);

	if (locale === 'fr' && !rec.article_lie) error('ARTICLE_MISSING', 'article_lie est obligatoire');

	const internal = internalLinks(body);
	if (internal.length < LIMITS.internalLinksMin) error('LINKS_INTERNAL_MIN', `${internal.length} lien(s) interne(s) (minimum ${LIMITS.internalLinksMin})`);
	for (const href of internal) {
		const isEn = href.startsWith('/en/') || href === '/en';
		if (locale === 'fr' && isEn) error('LINK_LOCALE', `Lien anglais dans une réponse française : ${href}`);
		if (locale === 'en' && !isEn) error('LINK_LOCALE', `Lien français dans une réponse anglaise : ${href}`);
	}

	const all = `${title} ${shortText} ${stripHtml(body)}`;
	for (const re of FORBIDDEN[locale]) if (re.test(all)) error('FORBIDDEN_PHRASE', `Formulation interdite détectée (${re})`);

	const external = externalLinks(body);
	if (rec.categorie === 'sante-securite' && external.length === 0) error('SOURCES_REQUIRED', 'Au moins une source externe est obligatoire pour la santé et la sécurité');
	else if (external.length === 0 && (/%/.test(all) || /\b(étude|etude|study)\b/i.test(all))) warning('SOURCES_ADVISED', 'Chiffre ou étude cité sans source externe');

	if (HEALTH.test(all) && !DISCLAIMER.test(all)) {
		if (rec.categorie === 'sante-securite') error('DISCLAIMER_REQUIRED', 'Mention « ceci n\'est pas un avis médical » obligatoire');
		else warning('DISCLAIMER_ADVISED', 'Sujet de santé détecté : ajouter la mention « pas un avis médical »');
	}

	if (/[€$]\s?\d|\d\s?(€|\$|euros?|dollars?)/i.test(all)) warning('PRICE_CHECK', 'Prix cité : vérifier chaque montant dans le catalogue Directus');

	return issues;
}

export function findDuplicates(
	rec: { question: string; slug: string },
	others: { title: string; slug: string; kind: 'question' | 'article' }[],
	locale: LintLocale,
): LintIssue[] {
	const mine = new Set(tokenize(rec.question, locale));
	const issues: LintIssue[] = [];
	for (const o of others) {
		if (o.kind === 'question' && o.slug === rec.slug) continue;
		const theirs = new Set(tokenize(o.title, locale));
		const inter = [...mine].filter((t) => theirs.has(t)).length;
		const union = new Set([...mine, ...theirs]).size;
		if (union > 0 && inter / union >= LIMITS.duplicateJaccard)
			issues.push({ level: 'warning', code: 'DUPLICATE_SUSPECT', message: `Très proche de ${o.kind === 'article' ? "l'article" : 'la question'} « ${o.title} » (${o.slug}) : enrichir l'existant plutôt que créer ?` });
	}
	return issues;
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npm test`
Expected: PASS (recherche, utilitaires, validation, contrôleur). Si `BODY_LENGTH` échoue pour la question conforme : le corps de `validFr()` compte 4 × ~131 mots + liens + sources ≈ 540 mots, dans la fenêtre 450 à 1 000. Si `mid` (~430 mots) tombe dans la fenêtre FR, réduire `section('D', 90)` à `section('D', 70)`.

- [ ] **Step 5: Écrire le script de contrôle (CLI)**

```js file=scripts/check-question.mjs
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
```

- [ ] **Step 6: Écrire le script de publication**

```js file=scripts/publish-question.mjs
#!/usr/bin/env node
// Usage : node scripts/publish-question.mjs <fichier.json> [--statut brouillon|publie]
// Le fichier contient { "fr": {...}, "en": {...} } (voir le skill redaction-question-reponse).
// Publier (statut publie) est refusé tant que le contrôleur qualité signale des erreurs.
import { readFileSync } from 'node:fs';
import { directus } from './lib/directus.mjs';
import { lintQuestion } from '../src/lib/questionLint.ts';

const args = process.argv.slice(2);
const statutIdx = args.indexOf('--statut');
const statutValue = statutIdx >= 0 ? args[statutIdx + 1] : undefined;
const file = args.find((a) => !a.startsWith('--') && a !== statutValue);
const statut = statutValue ?? 'brouillon';
if (!file || !['brouillon', 'publie'].includes(statut)) {
	console.error('Usage : node scripts/publish-question.mjs <fichier.json> [--statut brouillon|publie]');
	process.exit(2);
}

const { fr, en } = JSON.parse(readFileSync(file, 'utf8'));
if (!fr?.slug || !en?.slug) throw new Error('Le fichier doit contenir fr.slug et en.slug');

if (statut === 'publie') {
	const issues = [
		...lintQuestion(fr, 'fr').map((i) => ({ ...i, lang: 'fr' })),
		...lintQuestion({ ...en, categorie: fr.categorie, article_lie: fr.article_lie }, 'en').map((i) => ({ ...i, lang: 'en' })),
	].filter((i) => i.level === 'error');
	if (issues.length) {
		for (const i of issues) console.error(`ERREUR [${i.lang}] ${i.code}: ${i.message}`);
		console.error('Publication refusée : corriger les erreurs (ou rester en brouillon).');
		process.exit(1);
	}
}

const today = new Date().toISOString().slice(0, 10);
const existing = (await directus('GET', `/items/Questions?filter[slug][_eq]=${encodeURIComponent(fr.slug)}&fields=id,date_publication&limit=1`))[0];
const row = {
	question: fr.question, slug: fr.slug, categorie: fr.categorie, article_lie: fr.article_lie ?? null, produit_lie: fr.produit_lie ?? null,
	reponse_courte: fr.reponse_courte, reponse: fr.reponse, mots_cles: fr.mots_cles,
	auteur: 'Axel Paupier', date_publication: existing?.date_publication ?? today, date_updated: today, statut,
};
const saved = existing ? await directus('PATCH', `/items/Questions/${existing.id}`, row) : await directus('POST', '/items/Questions', row);

const tr = { question: en.question, slug: en.slug, reponse_courte: en.reponse_courte, reponse: en.reponse, mots_cles: en.mots_cles };
const enRow = (await directus('GET', `/items/Questions_translations?filter[Questions_id][_eq]=${saved.id}&filter[languages_code][_eq]=en&fields=id&limit=1`))[0];
if (enRow) await directus('PATCH', `/items/Questions_translations/${enRow.id}`, tr);
else await directus('POST', '/items/Questions_translations', { Questions_id: saved.id, languages_code: 'en', ...tr });

console.log(`${existing ? 'Mise à jour' : 'Création'} : question ${saved.id} (${statut}) — FR ${fr.slug} / EN ${en.slug}`);
```

- [ ] **Step 7: Vérifier les scripts sur une question jetable**

Créer `content-drafts/questions/_essai.json` avec des textes factices conformes aux limites (générer avec un petit script Node si besoin), puis :
- `node scripts/publish-question.mjs content-drafts/questions/_essai.json` → `Création : question N (brouillon)`.
- `node scripts/check-question.mjs <slug-fr>` → rapports FR/EN ; corriger les erreurs signalées.
- `node scripts/check-question.mjs --duplicates "À quel âge peut-on skier avec un exosquelette ?"` → liste l'article `exosquelette-ski-age-minimum-enfant-senior` en tête.
- Vérifier que le brouillon est invisible : `curl -s -o /dev/null -w "%{http_code}" http://localhost:4399/questions/<slug-fr>` (serveur de dev) → `404` ; `curl -s http://localhost:4399/questions/index.json | grep -c <slug-fr>` → `0` ; `curl -s http://localhost:4399/sitemap.xml | grep -c <slug-fr>` → `0`.
- Publier : `node scripts/publish-question.mjs content-drafts/questions/_essai.json --statut publie` → puis les trois vérifications passent à `200` / `1` / `1`, et `/en/questions/<slug-en>` répond `200`. Vérifier que `/en/questions/<slug-fr>` répond `404`.
- Nettoyer : supprimer la question de test dans Directus (`DELETE /items/Questions/N`, la traduction disparaît en cascade) et le fichier `_essai.json`.

- [ ] **Point de contrôle** : `npm test` vert ; le cycle brouillon → publié → suppression est validé, y compris le refus de publier avec erreurs.

---

### Task 10: Skill de rédaction

**Files:**
- Create: `.claude/skills/redaction-question-reponse/SKILL.md`
- Create: `.claude/skills/redaction-question-reponse/gabarits.md`

**Interfaces:**
- Consumes: `scripts/check-question.mjs`, `scripts/publish-question.mjs`, `LIMITS` (`questionLint.ts`).

- [ ] **Step 1: Écrire `SKILL.md`**

````markdown file=.claude/skills/redaction-question-reponse/SKILL.md
---
name: redaction-question-reponse
description: Use when writing, adding or updating a question/answer page (collection Questions) for neosomatech.com — chaque page suit un plan strict (limites de mots, sections, mots-clés, liens, sources) vérifié par un contrôleur automatique avant publication.
---

# Rédaction d'une page question/réponse — NeoSomaTech

Chaque page du centre de réponses doit être **approfondie, sourcée, unique et identique en structure**. Ce skill impose le plan ; le contrôleur `scripts/check-question.mjs` vérifie les chiffres. Ne saute aucune étape et ne publie jamais avec une erreur.

## Règles chiffrées (non négociables)

Source unique des valeurs : `LIMITS` dans `src/lib/questionLint.ts`. Le contrôleur les applique.

| Élément | Règle |
|---|---|
| `question` (titre) | 25 à 90 caractères, se termine par « ? », formulée comme on la tape dans Google, mot-clé principal dans les 5 premiers mots si possible |
| `slug` | 3 à 10 mots, minuscules, sans accents, tirets, 80 caractères maximum ; slug anglais séparé pour la traduction |
| `reponse_courte` | **40 à 60 mots**, texte brut (pas de balise), la réponse dès la première phrase, compréhensible seule, jamais de « voir ci-dessous » |
| `reponse` FR | **450 à 1 000 mots** (cible 550 à 800) |
| `reponse` EN | 400 à 1 000 mots |
| Sections | **3 à 6 titres `<h2>`** hors « Sources », chacune d'**au moins 60 mots** ; aucun `<h1>` ; `<h3>` autorisés ; au moins une liste `<ul>` ou `<ol>` |
| `mots_cles` | **8 à 20 lignes**, une expression par ligne, 80 caractères maximum chacune, dont au moins 2 formulations complètes de 4 mots ou plus |
| Liens internes | **au moins 2** dans `reponse` (relatifs, `/articles/...`, `/produits/...`) ; FR jamais de `/en/` ; EN uniquement des `/en/...` |
| `article_lie` | **obligatoire** (id de l'article pilier ou satellite le plus proche) ; `produit_lie` si un produit du catalogue est directement concerné |
| Sources | `<h2>Sources</h2>` avec liens externes (`https://`) : **obligatoire** si `categorie = sante-securite`, fortement conseillé dès qu'un chiffre, une étude ou une règle est cité |
| Santé | mention « Ceci n'est pas un avis médical » (EN : « This is not medical advice ») dès qu'il est question de douleur, pathologie, chirurgie, arthrose, prothèse |

## Formulations interdites

Jamais : « nous avons testé », « notre test », « miracle », « 100 % efficace/garanti », « garanti sans/contre… » (EN : « we tested », « our test », « guaranteed relief »…). Le site n'affirme pas avoir testé un produit (voir `/methodologie`). Aucun chiffre inventé. Aucune promesse médicale. Aucune critique nominative d'un concurrent.

## Style

Vouvoiement, phrases courtes, précis, sans emphase ni emoji. Typographie française (espace avant `? ! : ;`, guillemets « »). Chaque affirmation chiffrée est sourcée ou tirée du catalogue. Les prix et caractéristiques viennent uniquement de Directus (collection `Produits`), avec leur devise d'origine.

## Workflow (dans cet ordre)

**Étape 1 — Doublons.** Lancer `node scripts/check-question.mjs --duplicates "<la question>"`. Si un article ou une question couvre déjà la même intention (score élevé), s'arrêter : proposer à l'utilisateur d'enrichir l'existant plutôt que de créer une page concurrente.

**Étape 2 — Intention et gabarit.** Reformuler la question comme dans Google. WebSearch de la question : noter les questions voisines et ce que couvrent les premiers résultats. Choisir la `categorie` (ski, genou, randonnee, dos-travail, achat-prix, sante-securite, technique) et **un gabarit** dans `gabarits.md` (les sections H2 et leurs minimums sont imposés par le gabarit).

**Étape 3 — Faits et sources.** Lister les faits à établir. Pour chacun : catalogue Directus (`GET /items/Produits?filter[slug][_eq]=...`) ou source officielle lue en entier (INRS, HAS, Ameli, EUR-Lex, fabricant). **Ne jamais citer une page qu'on n'a pas lue.** Un fait sans source fiable est supprimé ou formulé comme une opinion clairement attribuée. Retenir l'article à lier (`article_lie`) et vérifier ses slugs FR et EN.

**Étape 4 — Mots-clés.** Écrire 8 à 20 lignes : reformulations complètes de la question (au moins 3), synonymes et termes voisins (au moins 3), fautes d'orthographe courantes (au moins 2, par exemple « exosquelete », « exosqelette »). Pas de variantes d'accents (la recherche les ignore). Faire de même en anglais pour la traduction.

**Étape 5 — Rédaction.** Écrire `content-drafts/questions/<slug-fr>.json` :

```json
{
  "fr": { "question": "…?", "slug": "…", "categorie": "ski", "article_lie": 11, "produit_lie": 8,
          "reponse_courte": "40 à 60 mots", "reponse": "<h2>…</h2><p>…</p>…<h2>Sources</h2><ul><li><a href=\"https://…\">…</a></li></ul>",
          "mots_cles": "une expression\nune autre" },
  "en": { "question": "…?", "slug": "…", "reponse_courte": "…", "reponse": "…", "mots_cles": "…" }
}
```

Suivre le gabarit choisi section par section. Traduire en anglais avec les mêmes règles (slug anglais, liens `/en/...`, pas de calque).

**Étape 6 — Brouillon et contrôle.** `node scripts/publish-question.mjs content-drafts/questions/<slug-fr>.json` (statut brouillon), puis `node scripts/check-question.mjs <slug-fr> --links`. Corriger jusqu'à **zéro erreur**. Chaque avertissement est soit corrigé, soit justifié à l'utilisateur. Vérifier à la main chaque prix cité (`PRICE_CHECK`) contre Directus.

**Étape 7 — Relecture humaine.** Montrer à l'utilisateur, en français : la question, la réponse courte, le plan (titres H2 et nombre de mots), les sources, les avertissements restants. Attendre son accord explicite.

**Étape 8 — Publication et vérification.** `node scripts/publish-question.mjs <fichier> --statut publie` (refusé automatiquement s'il reste une erreur). Vérifier la page FR et la page EN sur le site (serveur de dev ou production déployée) : statut 200, réponse courte affichée, schema `FAQPage` présent, liens fonctionnels. Donner les URLs. Si l'article lié a été modifié, mettre à jour son `date_updated`.

## Liste de contrôle finale

- [ ] Doublons vérifiés (étape 1) et intention distincte
- [ ] Gabarit respecté, toutes les sections présentes avec leur minimum de mots
- [ ] Réponse courte 40–60 mots, autonome
- [ ] `check-question.mjs --links` : zéro erreur
- [ ] Sources lues, liens externes présents pour la santé/le légal
- [ ] Aucun test inventé, aucun chiffre non sourcé, prix vérifiés dans Directus
- [ ] FR et EN publiés, hreflang cohérent (les deux slugs existent)
- [ ] Accord de l'utilisateur avant le passage en `publie`
````

- [ ] **Step 2: Écrire `gabarits.md`**

````markdown file=.claude/skills/redaction-question-reponse/gabarits.md
# Gabarits de réponse

Chaque gabarit fixe les sections `<h2>` (3 à 6, hors « Sources ») et leur minimum de mots. Le total doit rester entre 450 et 1 000 mots (FR). Les intitulés se reformulent selon la question, pas leur fonction ni leur minimum. Ajouter à chaque gabarit : au moins une liste, 2 liens internes, et « Sources » quand c'est requis.

## Gabarit A — Définition / fonctionnement
(« Comment fonctionne… », « C'est quoi… », « À quoi sert… »)

| # | Section | Minimum |
|---|---|---|
| 1 | La réponse en détail | 120 mots |
| 2 | Comment ça marche concrètement | 120 mots |
| 3 | Pour qui et dans quels cas | 80 mots |
| 4 | Limites et précautions | 80 mots |
| 5 | Ce qu'il faut retenir | 60 mots |

## Gabarit B — Choix / comparaison
(« Quel… choisir », « X ou Y », « Lequel pour… »)

| # | Section | Minimum |
|---|---|---|
| 1 | La réponse en détail (recommandation selon le profil) | 100 mots |
| 2 | Les critères qui comptent | 120 mots |
| 3 | Comparaison des options (liste ou tableau, données du catalogue) | 120 mots |
| 4 | Selon votre situation (2 à 3 profils) | 100 mots |
| 5 | Ce qu'il faut retenir | 60 mots |

## Gabarit C — Prix / budget / achat
(« Combien coûte… », « Où acheter… », « Faut-il payer… »)

| # | Section | Minimum |
|---|---|---|
| 1 | La réponse en détail (fourchette, avec devise d'origine) | 100 mots |
| 2 | Ce qui fait varier le prix | 120 mots |
| 3 | Coûts annexes et pièges (livraison, taxes, garantie) | 100 mots |
| 4 | Comment vérifier et économiser | 80 mots |
| 5 | Ce qu'il faut retenir | 60 mots |

Prix : uniquement ceux du catalogue Directus, devise d'origine, et la mention « vérifiez le prix en vigueur chez le vendeur ».

## Gabarit D — Santé / profil
(« À quel âge… », « Est-ce adapté si… arthrose, prothèse, ménisque… »)

| # | Section | Minimum |
|---|---|---|
| 1 | La réponse en détail | 100 mots |
| 2 | Ce que disent les sources (avec liens) | 130 mots |
| 3 | Selon votre situation (profils, cas particuliers) | 100 mots |
| 4 | Ce qu'il faut demander à un professionnel de santé | 80 mots |
| 5 | Ce qu'il faut retenir (avec « Ceci n'est pas un avis médical ») | 60 mots |
| — | Sources (obligatoire, hors comptage) | — |

`categorie = sante-securite` : source externe et mention « pas un avis médical » exigées par le contrôleur.

## Gabarit E — Pratique / réglementation / mode d'emploi
(« Peut-on prendre… en avion », « Qui paie… », « Comment régler… »)

| # | Section | Minimum |
|---|---|---|
| 1 | La réponse en détail | 100 mots |
| 2 | Ce que dit la règle ou la notice (avec source) | 130 mots |
| 3 | Mode d'emploi pas à pas (liste numérotée) | 100 mots |
| 4 | Erreurs fréquentes | 80 mots |
| 5 | Ce qu'il faut retenir | 60 mots |
| — | Sources (obligatoire pour toute règle citée) | — |

## Exemples de réponse courte (40 à 60 mots)

Bon : « Non, il n'existe pas d'âge minimum officiel pour porter un exosquelette de ski. Ce sont le poids et la morphologie qui comptent : les modèles actuels visent les adultes et les adolescents à partir d'environ 50 kg. Pour un jeune enfant, ce type d'équipement n'est pas adapté. » (46 mots)

À éviter : réponse qui commence par « Cela dépend… », renvoie au corps de la page, ou reformule la question sans répondre.
````

- [ ] **Step 3: Vérifier que le skill est reconnu**

Redémarrer la session Claude Code (ou lancer `/skills`) et vérifier que `redaction-question-reponse` apparaît avec sa description.

- [ ] **Step 4: Vérifier la cohérence des chiffres**

Run: `grep -n "450\|1 000\|60 mots\|40 à 60" .claude/skills/redaction-question-reponse/SKILL.md` et comparer avec `LIMITS` dans `src/lib/questionLint.ts` (`shortWords [40,60]`, `bodyWords.fr [450,1000]`, `bodyWords.en [400,1000]`, `h2 [3,6]`, `sectionMinWords 60`, `keywordLines [8,20]`). Expected : aucune divergence.
Calculer aussi que chaque gabarit dépasse 450 mots avec ses minimums : A = 460, B = 480, C = 460, D = 470 (hors Sources), E = 470.

- [ ] **Point de contrôle** : le skill existe, ses chiffres égalent `LIMITS`, chaque gabarit atteint le minimum de 450 mots.

---

### Task 11: Première question pilote et vérification de bout en bout

**Files:**
- Create: `content-drafts/questions/exosquelette-snowboard-compatible.json` (produit par le skill)

**Interfaces:**
- Consumes: le skill `redaction-question-reponse`, les scripts, toutes les pages.

- [ ] **Step 1: Rédiger la question pilote avec le skill**

Invoquer le skill `redaction-question-reponse` pour : « Peut-on utiliser un exosquelette pour faire du snowboard ? » (catégorie `ski`, gabarit A ou E, `article_lie` = 11, `produit_lie` = 8 pour le Ski-Mojo). Faits à établir depuis la fiche Directus du Ski-Mojo (`Produits` id 8 : « exosquelette passif de ski et de snowboard ») ; aucune affirmation absente de la fiche ou d'une source lue.
Expected : `content-drafts/questions/exosquelette-snowboard-compatible.json` ; `node scripts/check-question.mjs exosquelette-snowboard-compatible --links` → zéro erreur.

- [ ] **Step 2: Publier après accord de l'utilisateur**

Montrer le plan et la réponse courte à l'utilisateur, attendre son accord, puis `node scripts/publish-question.mjs content-drafts/questions/exosquelette-snowboard-compatible.json --statut publie`.

- [ ] **Step 3: Vérification de bout en bout en local**

Serveur de dev (`npx astro dev --port 4399`) :
- `/questions` liste la question sous « Ski » ; `/en/questions` la liste sous « Skiing ».
- `/questions/<slug-fr>` : `200`, encadré « Réponse courte », `FAQPage` présent (`curl -s … | grep -c '"@type":"FAQPage"'` → `1`), « Mis à jour le » ou date de publication, lien vers l'article et le produit.
- Recherche dans le navigateur : « snowbord exosqelette », « faire du snow avec exosquelette », « SNOWBOARD » trouvent la question en premier.
- `/questions/index.json` contient la question ; `sitemap.xml` contient les deux URLs avec `hreflang`.
- `npm test` vert ; `npm run build` sans erreur.

- [ ] **Step 4: Ne pas déployer sans accord**

Résumer à l'utilisateur ce qui est prêt en local (code non commité, question publiée dans Directus mais invisible en production tant que le code n'est pas déployé) et demander s'il veut commiter puis déployer. Après déploiement : `curl -s -o /dev/null -w "%{http_code}" https://neosomatech.com/questions/<slug-fr>` → `200`, puis ajouter à l'article réglementation le lien vers `/methodologie` (voir plan précédent), et vérifier `/questions` en ligne.

- [ ] **Point de contrôle** : le cycle complet (skill, brouillon, contrôle, relecture, publication, recherche, sitemap) fonctionne sur une vraie question.

---

### Task 12: Proposition de la première série (validation par l'utilisateur)

**Files:**
- Create: `docs/superpowers/plans/questions-serie-1.md`

- [ ] **Step 1: Écrire la liste candidate pour validation**

```markdown file=docs/superpowers/plans/questions-serie-1.md
# Série 1 — questions candidates (à valider avant rédaction)

Chaque ligne = une page. Gabarit : A définition, B choix, C prix, D santé, E pratique. « Sources » = sujet sensible ou réglementaire, source officielle à lire avant d'écrire. Article lié = pilier ou satellite existant.

| # | Question | Catégorie | Gabarit | Sources | Article lié |
|---|---|---|---|---|---|
| 1 | Peut-on utiliser un exosquelette pour faire du snowboard ? (pilote) | ski | A | fiche Ski-Mojo | ski-genou-guide-complet |
| 2 | Un exosquelette de ski fatigue-t-il vraiment moins les cuisses ? | ski | A | fabricant | ski-genou-guide-complet |
| 3 | Comment enfiler et régler un exosquelette de ski ? | ski | E | notice fabricant | ski-mojo-blue-silver-gold |
| 4 | Peut-on skier avec une prothèse de genou et un exosquelette ? | ski | D | HAS / avis médical | ski-genou-guide-complet |
| 5 | Un exosquelette peut-il retarder l'arthrose du genou ? | genou | D | HAS, études | exosquelette-genou |
| 6 | Exosquelette de genou et ménisque : est-ce utile ? | genou | D | sources médicales | exosquelette-genou |
| 7 | Genouillère ou collant de maintien : quelle différence ? | genou | B | catalogue Stoko/Imbrace | genouillere-vs-exosquelette |
| 8 | Peut-on courir avec un exosquelette de genou ? | genou | E | fabricant | exosquelette-genou |
| 9 | Un exosquelette de marche aide-t-il en descente ? | randonnee | A | fiches Hypershell/Dnsys | hiking-revolution-ou-gadget |
| 10 | Quelle autonomie réelle pour un exosquelette de randonnée ? | randonnee | A | fiches produits | hypershell-vs-dnsys |
| 11 | Peut-on emporter un exosquelette de marche en avion ? | randonnee | E | compagnies aériennes / IATA (batteries) | hiking-revolution-ou-gadget |
| 12 | Combien pèse un exosquelette de randonnée et est-ce gênant ? | randonnee | B | fiches produits | hypershell-vs-dnsys |
| 13 | Faut-il payer des taxes sur un exosquelette acheté hors UE ? | achat-prix | C | douane.gouv.fr | prix-exosquelette |
| 14 | Un exosquelette d'occasion vaut-il le coup ? | achat-prix | C | — (avis argumenté) | comparatif-exosquelette-guide-achat |
| 15 | Quelle garantie sur un exosquelette ? | achat-prix | C | fiches produits (garantie) | prix-exosquelette |
| 16 | Un exosquelette dorsal remplace-t-il une ceinture lombaire ? | dos-travail | B | INRS | mal-de-dos-travail-tms |
| 17 | Qui paie l'exosquelette au travail : l'employeur ou le salarié ? | dos-travail | E | INRS, Code du travail | reglementation-exosquelette-travail |
| 18 | Peut-on porter un exosquelette toute la journée ? | dos-travail | D | INRS | reglementation-exosquelette-travail |
| 19 | Comment se recharge un exosquelette motorisé ? | technique | E | fiches produits | hypershell-vs-dnsys |
| 20 | Un exosquelette motorisé craint-il la pluie ? | technique | A | fabricant (indice IP à vérifier) | hiking-revolution-ou-gadget |

Écartés (déjà couverts par un article, risque de doublon) : âge pour skier (article 30), choix du ressort Ski-Mojo (article 16), genouillère vs exosquelette (article 6), prix (article 32).
Sujets à risque : 4, 5, 6, 18 (santé : sources solides obligatoires, ton prudent) ; 11, 13 (règles à jour : lire la source officielle le jour de la rédaction) ; 14 (opinion : à formuler comme un point de vue, sans chiffre inventé).
```

- [ ] **Step 2: Demander la validation de la liste**

Présenter la liste à l'utilisateur ; il retire, ajoute ou réordonne. Aucune question de la série n'est rédigée avant son accord. Ensuite, rédiger chaque question avec le skill (une à une, relecture avant publication).

- [ ] **Point de contrôle** : liste validée par l'utilisateur.

---

## Auto-revue

**Couverture de la spec** : modèle de données (Task 1) ; pages hub et réponse avec schemas, 404 réel, noindex, fil d'Ariane (Tasks 4, 6) ; menu et footer (Task 5) ; sitemap avec hreflang conditionnel (Task 8) ; recherche tolérante avec pondération, seuil de 60 %, tolérance 1/2 lettres, mots vides, pluriels (Task 2) ; index JSON par langue et rendu sûr (Tasks 4, 7) ; suggestion avec champ leurre et statut forcé (Tasks 3, 7) ; filtre `statut = publie` partout (Task 4, vérifié Task 9 étape 7) ; skill avec workflow, limites et gabarits (Task 10) ; contrôleur qualité (Task 9) ; vérification en local et première série (Tasks 11, 12). Non couvert volontairement : pages de catégorie séparées, IA à la volée, autres langues (hors périmètre de la spec).

**Cohérence des noms** : `SearchDoc`, `search`, `tokenize`, `normalize`, `editDistance` (Task 2) utilisés à l'identique dans les Tasks 4, 7, 9 ; `listQuestions`/`getQuestion` (Task 4) utilisés dans les Tasks 6, 8 ; `relatedQuestions`, `groupByCategory`, `truncate`, `stripHtml`, `wordCount` (Task 3) utilisés dans les Tasks 4, 6, 9 ; `validateSuggestion` (Task 3) dans la Task 7 ; `LIMITS`/`lintQuestion`/`findDuplicates`/`internalLinks` (Task 9) dans les scripts et le skill ; clés `t.questions.*` définies Task 5, consommées Tasks 6, 7.

**Points de vigilance à l'exécution** : (1) la création des relations de traduction via l'API Directus est la partie la moins certaine, d'où l'aller-retour `--verify` de la Task 1 avec le repli manuel ; (2) les seuils de `mid` dans `questionLint.test.ts` (Task 9) dépendent du décompte réel des mots, ajustables sans changer les règles ; (3) la page publique n'existe en production qu'après déploiement, que l'utilisateur doit autoriser.
