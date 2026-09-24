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
