import type { APIRoute } from 'astro';
import { directusUrl, directusToken } from '../../lib/directus';

export const POST: APIRoute = async ({ request }) => {
  console.log('--- DÉBUT SOUMISSION CONTACT ---');
  
  try {
    // Vérification de l'objet request
    if (!request) {
        console.error('Erreur: Objet Request indéfini');
        throw new Error('Objet Request manquant au niveau du serveur.');
    }

    console.log('Méthode:', request.method);
    console.log('Content-Type:', request.headers.get('content-type'));

    let name, email, tel, message;

    // Tentative de lecture sécurisée des données
    try {
        console.log('Tentative de lecture formData...');
        const data = await request.formData();
        name = data.get('name');
        email = data.get('email');
        tel = data.get('tel');
        message = data.get('message');
        console.log('FormData lu avec succès');
    } catch (formError: any) {
        console.warn('formData() a échoué, tentative via JSON...', formError.message);
        try {
            const data = await request.json();
            name = data.name;
            email = data.email;
            tel = data.tel;
            message = data.message;
            console.log('JSON lu avec succès');
        } catch (jsonError: any) {
            console.error('Toutes les méthodes de lecture ont échoué');
            throw new Error('Impossible de lire les données du formulaire.');
        }
    }

    // Validation basique
    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({
          message: 'Champs obligatoires manquants (nom, email ou message).',
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Envoi à Directus: ${directusUrl}/items/Messages`);

    const response = await fetch(`${directusUrl}/items/Messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${directusToken}`
      },
      body: JSON.stringify({
        nom: name.toString(),
        email: email.toString(),
        telephone: tel ? tel.toString() : '',
        message: message.toString(),
      }),
    });

    console.log('Réponse Directus reçue, statut:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Directus API Error Detail:', errorData);
      
      const errorMessage = errorData.errors?.[0]?.message || `Erreur Directus (${response.status})`;
      throw new Error(errorMessage);
    }

    console.log('--- SUCCÈS SOUMISSION ---');
    return new Response(
      JSON.stringify({
        message: 'Votre message a été envoyé avec succès !',
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('ERREUR CRITIQUE API CONTACT:', error.message);
    console.error('Stack trace:', error.stack);
    
    return new Response(
      JSON.stringify({
        message: `Erreur serveur : ${error.message}`,
        debug: error.stack // Optionnel, aide à identifier d'où vient 'verify'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
