/**
 * Import des images des variantes Dnsys X1 dans Directus
 * → Image principale (champ Image) + galerie (Variantes_files)
 * Usage : node import-images-directus.mjs
 */

const API = 'https://spirited-squid.pikapod.net';
const TOKEN = '0rDg_xkE3nqWlRECA3q3O2vxbh-RwytQ';
const CDN = 'https://cdn.shopify.com/s/files/1/0573/1545/9160/files/';
const headers = { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

// Images par modèle : [principale, galerie_1, galerie_2]
const modeles = [
  {
    modele: 'X1 Lite',
    variantIds: [10, 11, 12],
    images: [
      { url: CDN + '1280X1280_7.jpg',           title: 'Dnsys X1 Lite – Principal' },
      { url: CDN + 'Carbon_lite_non-text.jpg',   title: 'Dnsys X1 Lite – Vue produit' },
      { url: CDN + '20250220-160025.jpg',         title: 'Dnsys X1 Lite – Lifestyle' },
    ]
  },
  {
    modele: 'X1 Carbon',
    variantIds: [13, 14, 15],
    images: [
      { url: CDN + '1280X1280_8.jpg',                                    title: 'Dnsys X1 Carbon – Principal' },
      { url: CDN + 'carbon_995fe168-18f3-4dc4-850f-7fa2290f869a.jpg',    title: 'Dnsys X1 Carbon – Vue produit' },
      { url: CDN + 'a01246736e818f955b7afa7cc5814e33.jpg',                title: 'Dnsys X1 Carbon – Détail' },
    ]
  },
  {
    modele: 'X1 Carbon Pro (Without engraving)',
    variantIds: [16, 17, 18],
    images: [
      { url: CDN + 'x1_pro_3.jpg',                           title: 'Dnsys X1 Carbon Pro – Principal' },
      { url: CDN + 'pro_black_non-text.jpg',                  title: 'Dnsys X1 Carbon Pro – Vue produit' },
      { url: CDN + '3_5f5605f9-b1c3-4519-ad7d-a5de9732a256.png', title: 'Dnsys X1 Carbon Pro – Détail' },
    ]
  },
  {
    modele: 'X1 Carbon Pro (With engraving)',
    variantIds: [19, 20, 21],
    images: [
      { url: CDN + 'x1_pro_3_86f26afe-97e8-4a3f-8183-87def74fc9f3.jpg', title: 'Dnsys X1 Carbon Pro Engraving – Principal' },
      { url: CDN + 'pro_black_non-text.jpg',                             title: 'Dnsys X1 Carbon Pro Engraving – Vue produit' },
      { url: CDN + '1_1f3ec7f8-8ea8-45b8-a0c9-aa289bb5f409.png',        title: 'Dnsys X1 Carbon Pro Engraving – Détail' },
    ]
  },
  {
    modele: 'X1 Carbon+Z1 DualJoint',
    variantIds: [22, 23, 24],
    images: [
      { url: CDN + '1280X1280_6_0e40a151-ec72-42b8-bbe3-a187fb6ba135.jpg', title: 'Dnsys X1+Z1 DualJoint – Principal' },
      { url: CDN + 'bundle_89785fcb-65f5-48a3-bad2-86d51b57f24f.png',      title: 'Dnsys X1+Z1 DualJoint – Bundle' },
      { url: CDN + 'bundle_7e351add-b314-4958-ae45-4472cd37627d.webp',     title: 'Dnsys X1+Z1 DualJoint – Lifestyle' },
    ]
  },
  {
    modele: 'Z1 SingleJoint Left leg+X1 Carbon',
    variantIds: [25, 26, 27],
    images: [
      { url: CDN + '1280X1280_4_29c0af77-614e-498e-82e8-1a6438c550fe.jpg', title: 'Dnsys Z1 SingleJoint Left – Principal' },
      { url: CDN + 'bundle_32276c49-298e-4121-a413-9b074e852225.jpg',       title: 'Dnsys Z1 SingleJoint Left – Bundle' },
      { url: CDN + 'Frame_2121239037_1.png',                                title: 'Dnsys Z1 SingleJoint Left – Détail' },
    ]
  },
  {
    modele: 'Z1 SingleJoint Right Leg+X1 Carbon',
    variantIds: [28, 29, 30],
    images: [
      { url: CDN + '1280X1280_5_b7d8e64a-f07f-49a4-b073-6cb0379c53c4.jpg',     title: 'Dnsys Z1 SingleJoint Right – Principal' },
      { url: CDN + 'bundle_00f726be-5d45-4929-aaf5-eb9955c7a7c0.webp',         title: 'Dnsys Z1 SingleJoint Right – Bundle' },
      { url: CDN + 'Frame_2121239038_1_bdcb4991-c47e-4f81-9b7b-d4adc5348da8.png', title: 'Dnsys Z1 SingleJoint Right – Détail' },
    ]
  },
];

async function importImage({ url, title }) {
  const res = await fetch(`${API}/files/import`, {
    method: 'POST', headers,
    body: JSON.stringify({ url, data: { title } })
  }).then(r => r.json());
  if (!res.data?.id) throw new Error(JSON.stringify(res.errors));
  return res.data.id;
}

async function setMainImage(variantId, uuid) {
  await fetch(`${API}/items/Variantes/${variantId}`, {
    method: 'PATCH', headers,
    body: JSON.stringify({ Image: uuid })
  });
}

async function addToGallery(variantId, uuid) {
  await fetch(`${API}/items/Variantes_files`, {
    method: 'POST', headers,
    body: JSON.stringify({ Variantes_id: variantId, directus_files_id: uuid })
  });
}

// --- Lancement ---
console.log('🚀 Import images Dnsys X1 → Directus\n');

for (const modele of modeles) {
  console.log(`📦 ${modele.modele}`);

  const uuids = [];
  for (const img of modele.images) {
    try {
      process.stdout.write(`   ⬇️  ${img.title} ... `);
      const uuid = await importImage(img);
      uuids.push(uuid);
      console.log(`✅ ${uuid}`);
    } catch (e) {
      console.log(`❌ ${e.message}`);
      uuids.push(null);
    }
  }

  // Appliquer aux 3 variantes (S, M, L)
  for (const variantId of modele.variantIds) {
    // Image principale = première image
    if (uuids[0]) await setMainImage(variantId, uuids[0]);

    // Galerie = toutes les images importées avec succès
    for (const uuid of uuids.filter(Boolean)) {
      await addToGallery(variantId, uuid);
    }
  }
  console.log(`   📎 Appliqué aux variantes : ${modele.variantIds.join(', ')}\n`);
}

console.log('✅ Terminé !');
