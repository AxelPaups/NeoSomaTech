import type { APIRoute } from 'astro';
import { directusUrl, directusToken } from '../../lib/directus';

/**
 * Route API pour gérer l'envoi des messages de contact vers Directus.
 * Utilise une approche JSON pure pour une compatibilité maximale avec Cloudflare/Astro.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { nom, email, telephone, message, rgpd } = body;

    // Validation
    if (!nom || !email || !message || !rgpd) {
      return new Response(JSON.stringify({ message: "Champs obligatoires manquants ou RGPD non accepté." }), { status: 400 });
    }

    // Envoi vers Directus (Utilisation de l'access_token en query param pour la stabilité Cloudflare)
    const url = `${directusUrl}/items/Messages?access_token=${directusToken}`;

    const directusResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nom,
        email,
        telephone: telephone || '',
        message
      }),
    });

    if (!directusResponse.ok) {
      const errorData = await directusResponse.json().catch(() => ({}));
      console.error('Directus API Error:', errorData);
      throw new Error(`Erreur Directus (${directusResponse.status})`);
    }

    return new Response(JSON.stringify({ message: "Votre message a été envoyé avec succès !" }), { status: 200 });

  } catch (error: any) {
    console.error('Contact API Error:', error.message);
    return new Response(JSON.stringify({ 
        message: "Une erreur est survenue lors de l'envoi du message. Veuillez réessayer plus tard.",
        error: error.message
    }), { status: 500 });
  }
};
