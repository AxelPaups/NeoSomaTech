import type { APIRoute } from 'astro';

import { directusUrl, directusToken } from '../../lib/directus';

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('--- TEST STEP 3: fetch Directus ---');
    const data = await request.formData();
    const name = data.get('name');
    const email = data.get('email');
    const tel = data.get('tel');
    const message = data.get('message');
    
    // On utilise l'access_token en paramètre d'URL pour éviter le bug du header 'Authorization'
    const url = `${directusUrl}/items/Messages?access_token=${directusToken}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nom: name?.toString() || '',
        email: email?.toString() || '',
        telephone: tel?.toString() || '',
        message: message?.toString() || '',
      }),
    });

    console.log('Statut réponse Directus:', response.status);

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Erreur Directus:', errorText);
        throw new Error(`Directus error: ${response.status} - ${errorText}`);
    }

    return new Response(
      JSON.stringify({
        message: 'Message envoyé avec succès à Directus !',
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('Crash dans Step 3:', error.message);
    return new Response(
      JSON.stringify({
        message: `Erreur dans le test fetch : ${error.message}`,
        stack: error.stack
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
