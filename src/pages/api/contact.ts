import type { APIRoute } from 'astro';
import { directusUrl, directusToken } from '../../lib/directus';

/**
 * Route API pour gérer l'envoi des messages de contact vers Directus.
 * Utilise une approche JSON pure pour une compatibilité maximale avec Cloudflare/Astro.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('API: Etape 1 - Début');
    let body;
    try {
      body = await request.json();
      console.log('API: Etape 2 - JSON lu');
    } catch (e) {
      console.log('API: Erreur lecture JSON');
      return new Response(JSON.stringify({ message: "Le format de la requête est invalide." }), { status: 400 });
    }

    const { nom, email, telephone, message, rgpd } = body;
    console.log('API: Etape 3 - Champs extraits');

    if (!nom || !email || !message || !rgpd) {
      console.log('API: Validation échouée');
      return new Response(JSON.stringify({ message: "Champs manquants ou RGPD non coché." }), { status: 400 });
    }

    const url = `${directusUrl}/items/Messages?access_token=${directusToken}`;
    console.log('API: Etape 4 - URL préparée:', url);

    console.log('API: Etape 5 - Tentative fetch...');
    const directusResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, email, telephone: telephone || '', message }),
    });
    console.log('API: Etape 6 - Fetch terminé, statut:', directusResponse.status);

    if (!directusResponse.ok) {
      console.log('API: Etape 7 - Directus Error');
      const errorData = await directusResponse.json().catch(() => ({}));
      console.error('Détails erreur Directus:', errorData);
      throw new Error(`Directus error ${directusResponse.status}: ${JSON.stringify(errorData)}`);
    }

    console.log('API: Etape 8 - Succès');
    return new Response(JSON.stringify({ message: "Message envoyé !" }), { status: 200 });

  } catch (error: any) {
    console.error('API: CRASH FINAL', error);
    return new Response(JSON.stringify({
      message: `Erreur serveur : ${error.message}`,
      details: error.stack
    }), { status: 500 });
  }
};
