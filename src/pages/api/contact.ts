import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  const data = await request.formData();
  const name = data.get('name');
  const email = data.get('email');
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

  const directusUrl = "https://spirited-squid.pikapod.net";

  try {
    const response = await fetch(`${directusUrl}/items/Messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nom: name,
        email: email,
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
