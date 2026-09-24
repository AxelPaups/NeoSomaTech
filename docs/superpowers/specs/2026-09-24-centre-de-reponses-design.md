# Centre de réponses (questions/réponses) : spécification

Date : 2026-09-24 · Statut : en attente de relecture

## Objectif

Créer sur neosomatech.com un espace de questions/réponses approfondies : chaque question a sa propre page indexable, et une barre de recherche tolérante aux fautes oriente le visiteur vers la bonne réponse ou le bon article. But : être présent sur beaucoup plus de requêtes Google (longue traîne), apporter de la valeur au visiteur, et dépasser exosquelette.fr sur le grand public (ski, genou, randonnée, marche motorisée).

**Critères de réussite**
- Une recherche avec fautes ou reformulation (« exosqelette ski genoux », « à quel age skier exosquelette ») renvoie la bonne page dans les premiers résultats.
- Chaque page de réponse est substantielle (450 à 1 000 mots, cible 550 à 800), sourcée quand elle touche à la santé ou au légal, et ne duplique aucun article existant.
- Aucune page en anglais sans traduction (règle existante du site) ; aucune page « brouillon » n'est visible.
- Les questions sans résultat remontent à l'éditeur via un formulaire de suggestion.

**Hors périmètre (v1)** : réponses générées par IA à la volée ; pages de catégorie séparées ; commentaires ou votes ; allemand/espagnol ; pagination du hub (inutile sous ~200 questions).

## Modèle de données (Directus)

**`Questions`** (collection principale)
| Champ | Type | Rôle |
|---|---|---|
| `question` | string | Titre, formulé comme on le tape dans Google |
| `slug` | string | Minuscules, sans accents, tirets |
| `reponse_courte` | text | 40 à 60 mots, autonome, citable par un moteur ou une IA |
| `reponse` | rich text HTML | Développement structuré (H2/H3), même format que `Articles.contenu` |
| `categorie` | dropdown | ski, genou, randonnee, dos-travail, achat-prix, sante-securite, technique |
| `mots_cles` | text | Synonymes, reformulations, fautes courantes, une par ligne |
| `article_lie` | M2O → Articles | Article de référence (pilier ou satellite) |
| `produit_lie` | M2O → Produits | Produit concerné, optionnel |
| `auteur`, `date_publication`, `date_updated` | comme `Articles` | Signature et fraîcheur |
| `statut` | dropdown | `brouillon` ou `publie` |

**`Questions_translations`** : `question`, `slug`, `reponse_courte`, `reponse`, `mots_cles`, `languages_code` (`en`). Même mécanisme que `Articles_translations`.

**`Questions_suggestions`** : `texte`, `email` (optionnel), `langue`, `statut` (`nouvelle`, `traitee`, `rejetee`), `date_created`.

**Garde-fou important** : le jeton utilisé par le site est un compte Admin, donc Directus ne protège pas les brouillons. Toutes les requêtes de lecture (pages, index de recherche, sitemap) filtrent explicitement `statut = publie`. Un brouillon ne doit jamais être servi.

## Pages et routes

Nouveau segment de route `questions` (identique en FR et EN), ajouté à `src/i18n/routes.ts`.

- **`/questions`, `/en/questions`** : hub. Barre de recherche en haut, puis toutes les questions publiées groupées par catégorie (ancres). Indexable, avec `hreflang`.
- **`/questions/[slug]`, `/en/questions/[slug]`** : page de réponse. Structure fixe :
  1. Fil d'Ariane et H1 (la question).
  2. Encadré « Réponse courte ».
  3. 3 à 5 sections de développement.
  4. Rappel santé/légal si le sujet le demande.
  5. Sources externes (au moins une pour la santé et le légal).
  6. Liens : article lié, produit lié, 2 à 3 questions de la même catégorie.
  7. Signature d'auteur et « Mis à jour le ».
  - Schemas : `FAQPage` (une question) et `BreadcrumbList` ; `dateModified` renseigné.
- Statut 404 réel et `noindex` si la question est introuvable ou brouillon (comme les articles).
- **Sitemap** : hub et questions publiées, avec `lastmod` = `date_updated` ou `date_publication`, alternates `hreflang` uniquement pour les langues traduites.
- **Navigation** : lien dans le menu et le footer.

## Recherche tolérante

- **Index** : endpoint JSON par langue (`/questions/index.json`, `/en/questions/index.json`), servi en cache. Il contient, pour chaque question publiée : `question`, `slug`, `reponse_courte`, `mots_cles`, `categorie` ; et, pour chaque article : `titre`, `slug`, `description_seo`. La recherche s'exécute dans le navigateur.
- **Module pur** `src/lib/questionSearch.ts` (sans dépendance externe), testable seul :
  1. Normalisation : minuscules, accents supprimés, ponctuation en espaces.
  2. Mots vides FR/EN retirés (quel, est-ce que, comment, the, how...).
  3. Radical léger : pluriels `s`/`x` retirés.
  4. Appariement de chaque mot de la recherche avec les mots du document : exact (1,0), préfixe d'au moins 3 lettres (0,8), distance d'édition (Damerau-Levenshtein) de 1 pour un mot de 4 lettres ou plus et de 2 à partir de 8 lettres (0,6).
  5. Poids par champ : `mots_cles` 3, `question` 2, `reponse_courte` 1, titre d'article 1,5.
  6. Un résultat doit apparier au moins 60 % des mots de la recherche (1 seul mot : il doit apparier).
  7. Tri par score ; 8 résultats maximum, badge « Réponse » ou « Article ».
- **Zéro résultat** : message et formulaire « Proposer une question ». Rien n'est enregistré tant que le visiteur n'envoie pas le formulaire.
- Les états de recherche n'ont pas d'URL propre (pas de pages de résultats à indexer).

## Suggestions de questions

`POST /api/questions-suggestions` : accepte `texte` (10 à 300 caractères), `email` (optionnel, valide), `langue` (`fr` ou `en`) et un champ leurre anti-robot. Le serveur liste les champs un par un et force `statut = nouvelle`, comme l'endpoint des avis. Le jeton vient de `.env` (jamais codé en dur).

## Skill de rédaction

Emplacement : `.claude/skills/redaction-question-reponse/SKILL.md` (dans le projet, versionné avec le code). Plan imposé à chaque question :
1. **Doublons** : chercher dans `Questions` et `Articles` (titres, contenu) ; si l'intention est déjà couverte, proposer d'enrichir l'existant plutôt que de créer.
2. **Intention** : formuler la question comme dans Google, vérifier les questions voisines (WebSearch), définir le mot-clé principal et le slug.
3. **Mots-clés** : générer reformulations, synonymes et fautes courantes (FR, puis EN pour la traduction).
4. **Rédaction** : gabarit de la page de réponse ; réponse courte de 40 à 60 mots ; 450 à 1 000 mots au total (cible 550 à 800) ; aucun chiffre inventé ; prix et caractéristiques uniquement issus du catalogue Directus ; sources vérifiées pour la santé et le légal ; mention « pas un avis médical » si pertinent ; rien qui suggère un test que nous n'avons pas fait (voir la page Méthodologie).
5. **Liens** : vérifier par appel HTTP que chaque lien interne existe.
6. **Traduction EN** : mêmes règles, slug anglais, liens `/en/...` vérifiés.
7. **Publication** : créer en `brouillon`, vérifier le rendu, puis passer en `publie` après l'accord de l'éditeur.
8. **Contrôle qualité** : liste de vérification finale (longueur, réponse courte, sources, liens, mots-clés, hreflang).

## Sécurité et déploiement

- Les collections et champs Directus sont créés via l'API avec le jeton Admin. Cela modifie la base de production : à faire une fois, avec vérification.
- Le code des pages n'est visible en production qu'après déploiement. Tant que le déploiement n'est pas fait, le contenu Directus n'est visible nulle part : aucune page ne doit donc renvoyer vers `/questions` avant.
- Aucun secret dans le code : tous les nouveaux endpoints utilisent la variable d'environnement existante.

## Vérification

- Tests unitaires du module de recherche (`node --test`) : fautes, accents, mots vides, ordre des mots, zéro résultat, requêtes d'un seul mot.
- Build (`npm run build`), puis vérification en local des pages, du schema `FAQPage` et du sitemap.
- Test des endpoints : entrées invalides refusées, `statut` forcé côté serveur, brouillon jamais servi.
- Contrôle des liens de chaque page publiée (200).

## Première série de contenu

Environ 20 questions issues des vraies requêtes Search Console et des trous identifiés (âge, arthrose, prix, remboursement, choix entre modèles, marche en montagne, seniors). La liste est validée par l'éditeur avant toute publication.
