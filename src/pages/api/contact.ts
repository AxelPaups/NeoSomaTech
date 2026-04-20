import type { APIRoute } from 'astro';
import { directusUrl, directusToken } from '../../lib/directus';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.formData();
    const name = data.get('name');
    const email = data.get('email');
    const tel = data.get('tel');
    const message = data.get('message');

    // Validation basique
    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({
          message: 'Tous les champs obligatoires (nom, email, message) doivent être remplis.',
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Préparation de l'envoi à Directus
    // Note : La collection s'appelle "Messages" par défaut dans ce code.
    // Si une erreur 403/404 survient, vérifiez le nom de la collection (ex: "Contact").
    const response = await fetch(`${directusUrl}/items/Messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${directusToken}`
      },
      body: JSON.stringify({
        nom: name,
        email: email,
        telephone: tel || '', // Garantit une chaîne de caractères
        message: message,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Directus API Error:', response.status, errorData);
      
      // Message d'erreur spécifique si possible
      const errorMessage = errorData.errors?.[0]?.message || `Erreur Directus (${response.status})`;
      throw new Error(errorMessage);
    }

    return new Response(
      JSON.stringify({
        message: 'Votre message a été envoyé avec succès ! Nous vous répondrons sous peu.',
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('Submission Error:', error);
    return new Response(
      JSON.stringify({
        message: error.message || 'Une erreur est survenue lors de l’envoi. Veuillez réessayer plus tard.',
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
