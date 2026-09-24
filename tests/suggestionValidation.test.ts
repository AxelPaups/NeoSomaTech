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
