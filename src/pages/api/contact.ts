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
    
    console.log('Données prêtes, envoi à:', `${directusUrl}/items/Messages`);

    const response = await fetch(`${directusUrl}/items/Messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // 'Authorization': `Bearer ${directusToken}` // Test sans le header
      },
      body: JSON.stringify({
        nom: name,
        email: email,
        telephone: tel || '',
        message: message,
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
