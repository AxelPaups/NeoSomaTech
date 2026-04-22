import type { APIRoute } from 'astro';
import { directusUrl, directusToken } from '../../lib/directus';

/**
 * Route API pour gérer l'envoi des messages de contact vers Directus.
 * Utilise une approche JSON pure pour une compatibilité maximale avec Cloudflare/Astro.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    // Lecture du corps de la requête en JSON
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ message: "Le format de la requête est invalide (JSON attendu)." }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { nom, email, telephone, message, rgpd } = body;

    // Validation des données
    if (!nom || !email || !message) {
      return new Response(JSON.stringify({ message: "Veuillez remplir tous les champs obligatoires." }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!rgpd) {
        return new Response(JSON.stringify({ message: "Vous devez accepter la conservation de vos données pour envoyer un message." }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

    // Envoi vers la collection Directus "Messages"
    // On utilise l'en-tête Authorization standard.
    const directusResponse = await fetch(`${directusUrl}/items/Messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${directusToken}`
      },
      body: JSON.stringify({
        nom,
        email,
        telephone: telephone || '',
        message
      }),
    });

    // Gestion de la réponse de Directus
    if (!directusResponse.ok) {
      const errorData = await directusResponse.json().catch(() => ({}));
      console.error('Directus API Error:', directusResponse.status, errorData);
      
      const errorMessage = errorData.errors?.[0]?.message || `Erreur Directus (${directusResponse.status})`;
      throw new Error(errorMessage);
    }

    return new Response(JSON.stringify({ message: "Votre message a été envoyé avec succès !" }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Critical Contact API Error:', error);
    return new Response(JSON.stringify({ 
        message: `Erreur serveur : ${error.message}`,
        details: error.stack // Aide au débogage si besoin
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
