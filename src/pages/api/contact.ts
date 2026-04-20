import type { APIRoute } from 'astro';
import { directusUrl, directusToken } from '../../lib/directus';

export const POST: APIRoute = async ({ request }) => {
  const data = await request.formData();
  const name = data.get('name');
  const email = data.get('email');
  const tel = data.get('tel');
  const message = data.get('message');

  // Validation basique
  if (!name || !email || !message) {
    return new Response(
      JSON.stringify({
        message: 'Tous les champs sont obligatoires.',
      }),
      { status: 400 }
    );
  }

  try {
    const response = await fetch(`${directusUrl}/items/Messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${directusToken}`
      },
      body: JSON.stringify({
        nom: name,
        email: email,
        telephone: tel,
        message: message,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Directus Error:', errorData);
      throw new Error('Erreur lors de l’envoi à Directus');
    }

    return new Response(
      JSON.stringify({
        message: 'Votre message a été envoyé avec succès !',
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({
        message: 'Une erreur est survenue. Veuillez réessayer plus tard.',
      }),
      { status: 500 }
    );
  }
};
