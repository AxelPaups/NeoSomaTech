import type { APIRoute } from 'astro';
import { directusUrl, directusToken } from '../../lib/directus';

const json = (body: Record<string, unknown>, status: number) =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export const POST: APIRoute = async ({ request }) => {
	let payload: Record<string, unknown>;
	try {
		payload = await request.json();
	} catch {
		return json({ message: 'Requête invalide' }, 400);
	}

	const prenom = str(payload.prenom, 60);
	const email = str(payload.email, 254);
	const telephone = str(payload.telephone, 30);
	const avisTexte = str(payload.avis_texte, 2000);
	const produitSlug = str(payload.produit_slug, 120);
	const note = Number(payload.note);

	if (!prenom || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ message: 'Prénom ou email invalide' }, 400);
	if (!Number.isInteger(note) || note < 1 || note > 5) return json({ message: 'Note invalide' }, 400);
	if (!/^[a-z0-9-]+$/.test(produitSlug)) return json({ message: 'Produit invalide' }, 400);

	// Champs listés un par un + statut forcé : le client ne peut pas publier un avis lui-même.
	const avis = {
		prenom,
		email,
		note,
		produit_slug: produitSlug,
		avis_texte: avisTexte,
		statut: 'en_attente',
		...(telephone && { telephone }),
	};

	try {
		const response = await fetch(`${directusUrl}/items/Avis`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${directusToken}` },
			body: JSON.stringify(avis),
		});
		if (!response.ok) {
			console.error('Directus Avis error:', response.status, await response.text());
			return json({ message: `Erreur ${response.status}` }, 502);
		}
		return json({ message: 'Avis enregistré, en attente de validation' }, 200);
	} catch (error) {
		console.error('API Avis Error:', error);
		return json({ message: 'Erreur serveur' }, 500);
	}
};
