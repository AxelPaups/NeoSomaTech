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
