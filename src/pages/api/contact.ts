import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('--- TEST STEP 2: formData ---');
    const data = await request.formData();
    const name = data.get('name');
    console.log('Nom reçu:', name);
    
    return new Response(
      JSON.stringify({
        message: `Success reading formData! Name: ${name}`,
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        message: `Erreur dans le test formData : ${error.message}`,
        stack: error.stack
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
