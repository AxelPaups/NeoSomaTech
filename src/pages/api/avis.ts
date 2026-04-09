import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await request.json();
    const directusUrl = "https://spirited-squid.pikapod.net";
    const directusToken = "0rDg_xkE3nqWlRECA3q3O2vxbh-RwytQ";

    const response = await fetch(`${directusUrl}/items/Avis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${directusToken}`
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Directus Error:', errorData);
      const msg = errorData.errors?.[0]?.message || `Erreur Directus ${response.status}`;
      return new Response(JSON.stringify({ message: msg }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ message: 'Avis enregistré avec succès' }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('API Avis Error:', error);
    return new Response(JSON.stringify({ message: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
