const directusUrl = "https://spirited-squid.pikapod.net";
const directusToken = "0rDg_xkE3nqWlRECA3q3O2vxbh-RwytQ";

async function run() {
  async function fetchDirectus(path) {
    const url = `${directusUrl}${path}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${directusToken}`,
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) {
        throw new Error(`Directus error ${response.status}: ${response.statusText} on ${url}`);
    }
    const json = await response.json();
    return json.data;
  }

  const collectionsToCheck = ['Pages', 'SEO_Pages', 'FAQ', 'Avis', 'Messages'];

  for (const coll of collectionsToCheck) {
    try {
      const items = await fetchDirectus(`/items/${coll}?limit=5`);
      console.log(`=== Collection: ${coll} (count: ${items ? items.length : 0}) ===`);
      if (items && items.length > 0) {
        console.log("Sample item:", JSON.stringify(items[0], null, 2));
      } else {
        console.log("No items.");
      }
    } catch (e) {
      console.log(`Error checking collection ${coll}:`, e.message);
    }
  }
}

run().catch(console.error);
