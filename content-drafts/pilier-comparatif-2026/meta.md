# Pilier — Comparatif / guide d'achat général (cluster 4, manquant)

Cible : la requête *comparatif exosquelette* (6 impressions, 0 clic en juin — page 2). Aucune page ne la capte actuellement ; `exosquelette-actif-vs-soutien-biomecanique-guide-complet` (id 8) couvre un angle technique différent (actif vs passif), pas un guide d'achat large.

## FR — collection `Articles`

- **titre** : Comparatif des exosquelettes 2026 : lequel choisir ?
- **slug** : `comparatif-exosquelette-guide-achat-2026`
- **description_seo** : Ski, genou, randonnée, dos, entrepôt : découvrez les 4 grandes familles d'exosquelettes, leur prix et comment choisir le bon modèle selon votre usage en 2026.
- **meta_description** : Comparatif complet des exosquelettes en 2026 : par usage (ski, genou, randonnée, dos), par prix et actif vs passif. Le guide pour choisir le bon modèle.
- **auteur** : Axel Paupier
- **date_publication** : (date du jour de publication, format ISO `AAAA-MM-JJ`)
- **contenu** : voir `fr.html` (copier-coller le HTML tel quel dans l'éditeur riche, ou basculer en mode code source si l'éditeur échappe les balises)
- **image_principale** : à choisir dans la bibliothèque Directus (visuel générique "exosquelette" — pas de produit unique puisque la page couvre toutes les familles)

## EN — collection `Articles_translations` (languages_code = en, Articles_id = l'id du nouvel article FR)

- **titre** : Exoskeleton Comparison 2026: Which One Should You Choose?
- **slug** : `exoskeleton-comparison-buying-guide-2026`
- **description_seo** : Skiing, knee, hiking, back, warehouse: discover the 4 main exoskeleton families, their price and how to choose the right model for your use case in 2026.
- **meta_description** : Full exoskeleton comparison for 2026: by use case (skiing, knee, hiking, back), by price, and active vs passive. The guide to choosing the right model.
- **contenu** : voir `en.html`

## Maillage à ajouter une fois l'article créé

- Depuis ce nouveau pilier : liens déjà inclus vers les 4 piliers existants + `/comparateur` (et `/en/compare`).
- **Retour** : ajouter un lien montant vers ce nouveau pilier depuis `exosquelette-actif-vs-soutien-biomecanique-guide-complet` (id 8, FR + EN) et depuis le bloc "Pour aller plus loin" des piliers ski/genou/randonnée/hapo/manutention.
- Le schema FAQPage se génère automatiquement (`articleFaq.ts` détecte le `<h2>Questions fréquentes</h2>` / `<h2>Frequently asked questions</h2>` suivi de paires `<h3>`/`<p>` — le format utilisé dans `fr.html`/`en.html` est déjà compatible).

## Blocage restant

Je n'ai pas de jeton d'écriture Directus valide (celui codé en dur dans `import-images-directus.mjs` répond 401 — probablement expiré/révoqué). Je ne peux donc pas créer l'entrée directement : soit tu colles ce contenu toi-même dans Directus, soit tu me donnes un jeton avec droit d'écriture sur `Articles`/`Articles_translations` et je le publie moi-même.
