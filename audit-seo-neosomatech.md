# Audit SEO — NeoSomaTech.com

*Réalisé le 24 juin 2026 · Stack : Astro 6 (SSR) sur Cloudflare + Directus (CMS headless, pikapod)*

---

## Synthèse en une page

Le socle technique SEO est **bien construit** : SSR (donc contenu crawlable), balises meta/canonical/Open Graph/Twitter complètes, données structurées riches (Organization, WebSite, Breadcrumb, Product, BlogPosting, FAQ, ItemList), sitemap, RSS, robots.txt, un seul H1 par page, hreflang, titres et meta d'articles riches en mots-clés. La stratégie de contenu long-tail (« exosquelette ski douleur genoux », « exosquelette randonnée GR20 ») est pertinente pour un site jeune.

**Mais un bug critique annule une grande partie de cet effort : toutes les pages d'articles individuelles sont actuellement cassées** (erreur 403 Directus), ce qui sabote directement le blog — votre principal levier d'acquisition SEO. C'est à corriger en priorité absolue, avant tout le reste.

Priorités, de la plus rentable à la moins urgente :

1. **P0 — Réparer les pages articles (403 Directus).** Tout le blog est hors service.
2. **P1 — Gérer les erreurs en vrai 404 + noindex** (au lieu de pages d'erreur indexables).
3. **P1 — Réécrire le H1 de la page d'accueil** avec le mot-clé « exosquelette ».
4. **P1 — Normaliser les slugs d'URL** (minuscules, sans accents).
5. **P1 — Optimiser les images** (poids, dimensions, lazy-load) pour les Core Web Vitals.
6. **P2 — Pages de marque indexables** + cohérence de la navigation + sitemap `lastmod`.
7. **P3 — Contenu, E-E-A-T, maillage, Search Console.**

---

## P0 — Critique : tout le blog est cassé

### Les pages `/articles/[slug]` renvoient une erreur 403

Chaque article individuel testé renvoie systématiquement :

> ⚠️ Erreur : Directus renvoie Erreur 403: Forbidden sur `…/items/Articles?filter[slug][_eq]=…&fields=id,titre,slug,description_seo,meta_description,contenu,date_publication,date_updated,auteur,image_principale`

La page affiche alors le titre **« Article non trouvé »** et le contenu de l'article n'apparaît jamais. La liste `/articles`, la page d'accueil et les fiches produits fonctionnent, **seules les pages d'article détaillées sont touchées**. Et comme Google a déjà indexé ces articles avec leur vrai contenu, il s'agit d'une **régression récente**.

**Pourquoi c'est grave :** le blog est le cœur de votre acquisition SEO (12+ articles bien ciblés). Aujourd'hui, un internaute qui clique depuis Google tombe sur une page d'erreur, et Google finira par déclasser ces URLs (soft-404). Tout le travail de rédaction est neutralisé.

**Cause la plus probable :** la requête de détail demande des champs absents des requêtes qui marchent — notamment `contenu`, `meta_description`, `date_updated`. Dans Directus, demander un champ sur lequel le rôle du token n'a pas la permission de lecture renvoie un **403 sur toute la requête**. Les requêtes de liste fonctionnent car elles ne demandent que `description_seo` (pas `contenu`/`meta_description`).

**À faire :**
- Dans Directus → Settings → Roles & Permissions → rôle du token statique, vérifier que **Read** est activé sur les champs `contenu`, `meta_description` et `date_updated` de la collection `Articles`.
- Test de confirmation : retirer temporairement `meta_description` puis `date_updated` de la liste de `fields` dans `src/pages/articles/[slug].astro` et voir lequel débloque la requête → c'est le champ fautif.
- Vérifier le **même risque sur les fiches produits** : la requête produit utilise `PRODUCT_FIELDS` (beaucoup de champs). Si un champ devient non autorisé, toutes les fiches produits tomberont aussi en 403.

---

## P1 — Impact élevé

### 1. Les pages en erreur sont indexables (soft-404)

Quand l'article est introuvable ou en erreur, la page renvoie un **HTTP 200** avec `<meta name="robots" content="index, follow">` et le titre « Article non trouvé ». Google peut donc indexer des pages d'erreur vides.

**À faire :** dans `articles/[slug].astro` (et `produits/[slug].astro`), en cas d'erreur ou d'absence de contenu, renvoyer un **statut HTTP 404** et passer la page en **`noindex`**. Astro permet `return new Response(html, { status: 404 })` ou `Astro.response.status = 404`. La redirection `/404` n'est déclenchée que si `!article && !errorMessage` — or ici `errorMessage` est défini, donc la page d'erreur s'affiche en 200. À corriger.

### 2. Le H1 de la page d'accueil ne contient aucun mot-clé

Actuel : **« L'avenir du corps commence ici »**. Le H1 est le signal on-page le plus fort, et celui-ci ne contient pas « exosquelette ». La page se positionne sur votre marque, pas sur votre marché.

**À faire :** intégrer le mot-clé principal dans le H1, par ex. *« Exosquelettes : comparatifs, analyses et guide d'achat »*, ou garder l'accroche en sur-titre et mettre le mot-clé dans le H1. Le `<title>` (« Expert Exosquelettes Médicaux, Sportifs et Industriels ») est lui très bien.

### 3. Slugs d'URL avec majuscules et accents

Exemple en production : `/articles/Exosquelette-de-Randonnée-Révolution-ou-Gadget-Sentiers`. Les majuscules et accents dans les URLs provoquent des problèmes d'encodage (`%C3%A9`), des risques de duplication (sensibilité à la casse) et nuisent au partage.

**À faire :** standardiser tous les slugs en **minuscules, sans accents, séparés par des tirets** (`exosquelette-randonnee-revolution-ou-gadget`). Corriger dans Directus, et mettre en place une **redirection 301** des anciennes URLs vers les nouvelles pour ne pas perdre l'historique d'indexation.

### 4. Images non optimisées → Core Web Vitals

Toutes les images sont servies brutes depuis Directus (`spirited-squid.pikapod.net/assets/…`), sans dimensions `width`/`height`, sans `srcset` responsive, sans format moderne (WebP/AVIF), et sans `loading="lazy"` apparent. Cela pèse sur le **LCP** (image héro / images produits) et provoque du **CLS** (décalage de mise en page).

**À faire :**
- Ajouter `width` et `height` explicites sur chaque `<img>` (supprime le CLS).
- Ajouter `loading="lazy"` et `decoding="async"` sur les images sous la ligne de flottaison ; garder l'image héro/LCP en chargement prioritaire (`fetchpriority="high"`).
- Utiliser les **transformations Directus** dans les URLs : `?width=800&format=webp&quality=80` pour réduire le poids et servir du WebP.
- Vérifier le résultat avec PageSpeed Insights (`pagespeed.web.dev`) sur la home, une fiche produit et un article.

---

## P2 — Impact moyen

### 5. Pages de marque non indexables + casse incohérente

`robots.txt` bloque `/boutique?*`, donc les pages filtrées par marque (`/boutique?marque=hypershell`) **ne sont pas indexables**. Or « exosquelette hypershell », « ski-mojo avis » etc. sont des requêtes à fort potentiel. De plus, les libellés de marque sont incohérents (`hypershell`, `ski mojo` en minuscules dans le footer vs `Hypershell`/`Stoko` ailleurs) — le filtre `?marque=hypershell` renvoie d'ailleurs une page vide (sensibilité à la casse côté Directus).

**À faire :**
- Créer de **vraies pages de marque indexables** en chemin propre (`/boutique/hypershell`) avec un titre, une intro unique et la liste des produits — plutôt que des paramètres `?marque=` bloqués.
- Normaliser la casse des marques dans Directus (« Hypershell », « Ski-Mojo », « Stoko », « Dnsys »).

### 6. Navigation incohérente entre les templates

La page d'accueil et la page comparateur affichent le menu complet (avec **Comparateur**), mais les **fiches produits et la liste d'articles affichent un menu sans le lien Comparateur** (et un logo « ⚡ » différent). Il existe donc deux en-têtes en parallèle.

**À faire :** unifier toutes les pages sur le composant `Header.astro` unique. Bénéfice SEO : maillage interne cohérent (le Comparateur reçoit des liens depuis toutes les pages) et meilleure UX.

### 7. `lastmod` du sitemap non fiable

Le sitemap parse des dates au format texte français (« 22 Mars 2026 ») que `new Date()` ne sait pas lire → repli systématique sur **la date du jour**. Résultat : toutes les URLs semblent modifiées « aujourd'hui » à chaque build, ce qui décrédibilise le signal `lastmod` auprès de Google.

**À faire :** stocker les dates en **format ISO** (`2026-03-22`) dans Directus, ou parser correctement le texte français avant génération. Idem pour l'affichage.

### 8. Contenu mince / placeholders sur les pages clés

- Fiches produits : bloc FAQ = « Les questions fréquentes seront disponibles prochainement » et « Soyez le premier à donner votre avis ». La FAQ alimente pourtant le **schema FAQPage** (rich snippets) — actuellement vide.
- Comparateur : les cellules de specs (Poids, Autonomie…) sont **vides dans le HTML rendu** (remplies par JS), donc invisibles pour Google → page à faible valeur SEO.

**À faire :** rédiger 4-6 vraies questions/réponses par produit (active les rich snippets FAQ), amorcer quelques avis authentiques, et s'assurer que le comparateur rend ses données **dans le HTML serveur** (pas seulement en JS).

### 9. Liens d'affiliation sortants en `follow`

« Acheter maintenant » pointe vers `ski-mojo.com` (lien commercial) en lien normal. Les liens d'affiliation doivent être balisés `rel="sponsored nofollow"` (+ `target="_blank" rel="noopener"`) pour respecter les consignes Google et ne pas diluer votre PageRank.

---

## P3 — Opportunités de fond

### 10. E-E-A-T et confiance
- `Organization.sameAs` est **vide** : ajoutez vos profils (LinkedIn, Instagram, YouTube…) pour renforcer l'entité « NeoSomaTech ».
- Créez une **page auteur** pour Axel Paupier (bio, expertise) reliée au schema `author` des articles. Vos contenus touchent à la santé (genoux, rééducation, « 33 % de charge en moins ») : Google valorise l'expertise démontrable et les **sources citées**. Ajoutez des références aux études/fabricants sur les affirmations chiffrées.

### 11. Stratégie de contenu / clusters thématiques
Votre ciblage long-tail est bon. Passez à l'étape supérieure avec des **clusters** : une page pilier par usage (Ski, Randonnée/Trail, Médical & rééducation, Industrie/manutention, Sport de force) qui lie vers les articles détaillés et les produits correspondants. Cela construit l'autorité topique et le maillage interne.

### 12. Maillage interne
`linkifyProducts` (liens auto des noms de produits dans les articles) est une bonne base. À étendre : bloc « articles liés » sur les fiches produits (la logique existe via `articlesLies`), et liens contextuels article → produit et article → article au sein d'un même cluster.

### 13. Google Search Console (à brancher)
Si ce n'est pas déjà fait : vérifiez le domaine dans **Search Console**, soumettez `sitemap.xml`, et surveillez le rapport **Couverture/Indexation**. Le bug des articles (P0) y apparaîtra en « soft 404 » / pages exclues — c'est aussi votre meilleur outil pour voir les mots-clés réels sur lesquels vous remontez. *(Donne-moi un accès en lecture si tu veux que j'analyse les données réelles.)*

### 14. Performance fine
Les polices Google (Inter + Outfit, nombreuses graisses) sont chargées en asynchrone (bien) avec `preconnect` (bien). Pour gratter du LCP : self-hoster les polices ou réduire le nombre de graisses chargées.

---

## Ce qui est déjà très bien (à conserver)

- Rendu **SSR** : tout le contenu est dans le HTML, parfaitement crawlable.
- Balises **meta, canonical, Open Graph, Twitter Card** complètes et propres.
- **Données structurées** étendues et correctes (Organization, WebSite + SearchAction, Breadcrumb, Product avec offers, BlogPosting, FAQPage, ItemList).
- **Sitemap dynamique**, **flux RSS**, **robots.txt** présents.
- **Un seul H1** par page, structure de titres saine, `hreflang` fr-fr.
- **Titres et meta-descriptions d'articles** riches en mots-clés et orientés intention de recherche.
- Descriptions produits **longues et substantielles** (~600 mots, bien structurées).

---

## Plan d'action résumé (par ordre de priorité)

| # | Action | Priorité | Où |
|---|--------|----------|-----|
| 1 | Réparer le 403 Directus des articles (permissions champs `contenu`/`meta_description`/`date_updated`) | P0 | Directus |
| 2 | Renvoyer 404 + noindex sur erreur/article introuvable | P1 | `articles/[slug].astro`, `produits/[slug].astro` |
| 3 | Réécrire le H1 de l'accueil avec « exosquelette » | P1 | `index.astro` |
| 4 | Slugs en minuscules sans accents + redirections 301 | P1 | Directus + config |
| 5 | Optimiser images (dimensions, lazy, WebP via Directus) | P1 | Composants images |
| 6 | Pages de marque indexables + casse cohérente | P2 | Directus + nouvelle route |
| 7 | Unifier l'en-tête (composant Header unique) | P2 | Templates |
| 8 | Dates ISO pour un `lastmod` fiable | P2 | Directus + sitemap |
| 9 | Vraies FAQ + avis + specs comparateur rendus serveur | P2 | Directus + comparateur |
| 10 | `rel="sponsored nofollow"` sur liens affiliés | P2 | Fiches produits |
| 11 | E-E-A-T : sameAs, page auteur, sources | P3 | Schema + contenu |
| 12 | Clusters thématiques + maillage interne | P3 | Contenu |
| 13 | Brancher/surveiller Search Console | P3 | GSC |
