import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('--- TEST MINIMAL API ---');
    
    // Si l'erreur persiste ici, c'est qu'elle vient d'Astro/Cloudflare avant même notre code
    return new Response(
      JSON.stringify({
        message: 'Test réussi. Si vous voyez ceci, l\'erreur ne vient pas de l\'initialisation de la route.',
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        message: `Erreur dans le test minimal : ${error.message}`,
        stack: error.stack
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
