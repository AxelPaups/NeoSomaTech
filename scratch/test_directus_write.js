const directusUrl = "https://spirited-squid.pikapod.net";
const directusToken = "0rDg_xkE3nqWlRECA3q3O2vxbh-RwytQ";

async function run() {
  async function testWrite() {
    const url = `${directusUrl}/collections`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${directusToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        collection: 'test_temp_collection',
        schema: {},
        meta: {}
      })
    });
    console.log(`Test writing collections: Status ${response.status} ${response.statusText}`);
    try {
      const data = await response.json();
      console.log("Response data:", JSON.stringify(data, null, 2));
    } catch {
      console.log("No JSON response.");
    }
  }

  await testWrite();
}

run().catch(console.error);
