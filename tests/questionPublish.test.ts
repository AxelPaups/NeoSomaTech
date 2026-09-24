import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planWrite } from '../src/lib/questionPublish.ts';

const TODAY = '2026-09-25';

test('nouvelle question sans statut demandé : brouillon daté du jour', () => {
	assert.deepEqual(planWrite(null, undefined, TODAY), { statut: 'brouillon', date_publication: TODAY, date_updated: TODAY });
});

test('question publiée mise à jour sans --statut : reste publiée, date de publication conservée', () => {
	const r = planWrite({ statut: 'publie', date_publication: '2026-09-01' }, undefined, TODAY);
	assert.deepEqual(r, { statut: 'publie', date_publication: '2026-09-01', date_updated: TODAY });
});

test('brouillon qui passe en publié : la date de publication devient celle du jour', () => {
	const r = planWrite({ statut: 'brouillon', date_publication: '2026-08-01' }, 'publie', TODAY);
	assert.deepEqual(r, { statut: 'publie', date_publication: TODAY, date_updated: TODAY });
});

test('retour explicite en brouillon : accepté, date conservée', () => {
	const r = planWrite({ statut: 'publie', date_publication: '2026-09-01' }, 'brouillon', TODAY);
	assert.deepEqual(r, { statut: 'brouillon', date_publication: '2026-09-01', date_updated: TODAY });
});

test('brouillon existant sans statut demandé : reste brouillon', () => {
	assert.equal(planWrite({ statut: 'brouillon', date_publication: '2026-08-01' }, undefined, TODAY).statut, 'brouillon');
});
