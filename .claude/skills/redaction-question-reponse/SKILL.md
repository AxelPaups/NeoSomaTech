---
name: redaction-question-reponse
description: Use when writing, adding or updating a question/answer page (collection Questions) for neosomatech.com — chaque page suit un plan strict (limites de mots, sections, mots-clés, liens, sources) vérifié par un contrôleur automatique avant publication.
---

# Rédaction d'une page question/réponse — NeoSomaTech

Chaque page du centre de réponses doit être **approfondie, sourcée, unique et identique en structure**. Ce skill impose le plan ; le contrôleur `scripts/check-question.mjs` vérifie les chiffres. Ne saute aucune étape et ne publie jamais avec une erreur.

## Règles chiffrées (non négociables)

Source unique des valeurs : `LIMITS` dans `src/lib/questionLint.ts`. Le contrôleur les applique.

| Élément | Règle |
|---|---|
| `question` (titre) | 25 à 90 caractères, se termine par « ? », formulée comme on la tape dans Google, mot-clé principal dans les 5 premiers mots si possible |
| `slug` | 3 à 10 mots, minuscules, sans accents, tirets, 80 caractères maximum ; slug anglais séparé pour la traduction |
| `reponse_courte` | **40 à 60 mots**, texte brut (pas de balise), la réponse dès la première phrase, compréhensible seule, jamais de « voir ci-dessous » |
| `reponse` FR | **450 à 1 000 mots** (cible 550 à 800) |
| `reponse` EN | 400 à 1 000 mots |
| Sections | **3 à 6 titres `<h2>`** hors « Sources », chacune d'**au moins 60 mots** ; aucun `<h1>` ; `<h3>` autorisés ; au moins une liste `<ul>` ou `<ol>` |
| `mots_cles` | **8 à 20 lignes**, une expression par ligne, 80 caractères maximum chacune, dont au moins 2 formulations complètes de 4 mots ou plus |
| Liens internes | **au moins 2** dans `reponse` (relatifs, `/articles/...`, `/produits/...`) ; FR jamais de `/en/` ; EN uniquement des `/en/...` |
| `article_lie` | **obligatoire** (id de l'article pilier ou satellite le plus proche) ; `produit_lie` si un produit du catalogue est directement concerné |
| Sources | `<h2>Sources</h2>` avec liens externes (`https://`) : **obligatoire** si `categorie = sante-securite`, fortement conseillé dès qu'un chiffre, une étude ou une règle est cité |
| Santé | mention « Ceci n'est pas un avis médical » (EN : « This is not medical advice ») dès qu'il est question de douleur, pathologie, chirurgie, arthrose, prothèse |

## Formulations interdites

Jamais : « nous avons testé », « notre test », « miracle », « 100 % efficace/garanti », « garanti sans/contre… » (EN : « we tested », « our test », « guaranteed relief »…). Le site n'affirme pas avoir testé un produit (voir `/methodologie`). Aucun chiffre inventé. Aucune promesse médicale. Aucune critique nominative d'un concurrent.

## Style

Vouvoiement, phrases courtes, précis, sans emphase ni emoji. Typographie française (espace avant `? ! : ;`, guillemets « »). Chaque affirmation chiffrée est sourcée ou tirée du catalogue. Les prix et caractéristiques viennent uniquement de Directus (collection `Produits`), avec leur devise d'origine.

## Workflow (dans cet ordre)

**Étape 1 — Doublons.** Lancer `node scripts/check-question.mjs --duplicates "<la question>"`. Si un article ou une question couvre déjà la même intention (score élevé), s'arrêter : proposer à l'utilisateur d'enrichir l'existant plutôt que de créer une page concurrente.

**Étape 2 — Intention et gabarit.** Reformuler la question comme dans Google. WebSearch de la question : noter les questions voisines et ce que couvrent les premiers résultats. Choisir la `categorie` (ski, genou, randonnee, dos-travail, achat-prix, sante-securite, technique) et **un gabarit** dans `gabarits.md` (les sections H2 et leurs minimums sont imposés par le gabarit).

**Étape 3 — Faits et sources.** Lister les faits à établir. Pour chacun : catalogue Directus (`GET /items/Produits?filter[slug][_eq]=...`) ou source officielle lue en entier (INRS, HAS, Ameli, EUR-Lex, fabricant). **Ne jamais citer une page qu'on n'a pas lue.** Un fait sans source fiable est supprimé ou formulé comme une opinion clairement attribuée. Retenir l'article à lier (`article_lie`) et vérifier ses slugs FR et EN.

**Étape 4 — Mots-clés.** Écrire 8 à 20 lignes : reformulations complètes de la question (au moins 3), synonymes et termes voisins (au moins 3), fautes d'orthographe courantes (au moins 2, par exemple « exosquelete », « exosqelette »). Pas de variantes d'accents (la recherche les ignore). Faire de même en anglais pour la traduction.

**Étape 5 — Rédaction.** Écrire `content-drafts/questions/<slug-fr>.json` :

```json
{
  "fr": { "question": "…?", "slug": "…", "categorie": "ski", "article_lie": 11, "produit_lie": 8,
          "reponse_courte": "40 à 60 mots", "reponse": "<h2>…</h2><p>…</p>…<h2>Sources</h2><ul><li><a href=\"https://…\">…</a></li></ul>",
          "mots_cles": "une expression\nune autre" },
  "en": { "question": "…?", "slug": "…", "reponse_courte": "…", "reponse": "…", "mots_cles": "…" }
}
```

Suivre le gabarit choisi section par section. Traduire en anglais avec les mêmes règles (slug anglais, liens `/en/...`, pas de calque).

**Étape 6 — Brouillon et contrôle.** `node scripts/publish-question.mjs content-drafts/questions/<slug-fr>.json` (statut brouillon), puis `node scripts/check-question.mjs <slug-fr> --links`. Corriger jusqu'à **zéro erreur**. Chaque avertissement est soit corrigé, soit justifié à l'utilisateur. Vérifier à la main chaque prix cité (`PRICE_CHECK`) contre Directus.

**Étape 7 — Relecture humaine.** Montrer à l'utilisateur, en français : la question, la réponse courte, le plan (titres H2 et nombre de mots), les sources, les avertissements restants. Attendre son accord explicite.

**Étape 8 — Publication et vérification.** `node scripts/publish-question.mjs <fichier> --statut publie` (refusé automatiquement s'il reste une erreur). Vérifier la page FR et la page EN sur le site (serveur de dev ou production déployée) : statut 200, réponse courte affichée, schema `FAQPage` présent, liens fonctionnels. Donner les URLs. Si l'article lié a été modifié, mettre à jour son `date_updated`.

## Liste de contrôle finale

- [ ] Doublons vérifiés (étape 1) et intention distincte
- [ ] Gabarit respecté, toutes les sections présentes avec leur minimum de mots
- [ ] Réponse courte 40–60 mots, autonome
- [ ] `check-question.mjs --links` : zéro erreur
- [ ] Sources lues, liens externes présents pour la santé/le légal
- [ ] Aucun test inventé, aucun chiffre non sourcé, prix vérifiés dans Directus
- [ ] FR et EN publiés, hreflang cohérent (les deux slugs existent)
- [ ] Accord de l'utilisateur avant le passage en `publie`
